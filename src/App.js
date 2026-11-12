import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Renglon from './componentes/Renglon';
import Capturar from './pantallas/Capturar';
import Detalle from './pantallas/Detalle';
import Respaldo, { AvisoRespaldo, leerMarcas, guardarMarca } from './pantallas/Respaldo';
import { Encabezado, EncabezadoDia, BarraNavegacion, BotonDictar, TiraSemana, Vacio } from './componentes/Armazon';
import { fechaLocalISO, fechaLarga, formatoDuracion, gruposDeHoy, gruposProximos, resumen } from './logica/agenda.mjs';
import { debeAvisar } from './logica/respaldo.mjs';

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevaPosicion, setNuevaPosicion] = useState('1');
  const [tareas, setTareas] = useState([]);

  const [editandoId, setEditandoId] = useState(null);
  const [editContext, setEditContext] = useState('');

  // Subtareas de todos los compromisos y compromiso abierto en detalle
  const [subtareas, setSubtareas] = useState([]);
  const [detalleId, setDetalleId] = useState(null);

  // Armazon nuevo (bloque I): pantalla visible, hoja de captura y aviso breve
  const [pantalla, setPantalla] = useState('hoy');
  const [capturaAbierta, setCapturaAbierta] = useState(false);
  const [aviso, setAviso] = useState('');

  // Respaldo (bloque 0-C): fechas recordadas en este equipo
  const [marcas, setMarcas] = useState({ ultimo: null, pospuesto: null });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, sesionNueva) => {
        setSesion(sesionNueva);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sesion) {
      cargarTareas();
      cargarCategorias();
      cargarSubtareas();
      setMarcas(leerMarcas(sesion.user.id));
    }
  }, [sesion]);

  async function cargarTareas() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('date_promised', { ascending: true });
    if (!error) setTareas(data);
  }

  async function cargarCategorias() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('priority_order', { ascending: true });
    if (!error) setCategorias(data);
  }

  // Cargar TODAS las subtareas (de todas las tareas) para calcular avances
  async function cargarSubtareas() {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .order('orden', { ascending: true });
    if (!error) setSubtareas(data);
  }

  // Subtareas de una tarea concreta, ordenadas
  function subtareasDe(taskId) {
    return subtareas
      .filter((s) => s.task_id === taskId)
      .sort((a, b) => a.orden - b.orden);
  }

  async function agregarCategoria() {
    if (!nuevaCategoria.trim()) return;

    const total = categorias.length;
    let pos = parseInt(nuevaPosicion, 10);
    if (isNaN(pos) || pos < 1) pos = 1;
    if (pos > total + 1) pos = total + 1;

    const aRecorrer = categorias.filter((c) => c.priority_order >= pos);
    for (const c of aRecorrer) {
      await supabase
        .from('projects')
        .update({ priority_order: c.priority_order + 1 })
        .eq('id', c.id);
    }

    const { error } = await supabase
      .from('projects')
      .insert([{ name: nuevaCategoria.trim(), priority_order: pos }]);

    if (!error) {
      setNuevaCategoria('');
      setNuevaPosicion('1');
      cargarCategorias();
    }
  }

  async function borrarCategoria(id, nombre, ordenBorrado) {
    const conEstaCategoria = tareas.filter((t) => t.project_id === id);
    if (conEstaCategoria.length > 0) {
      const ok = window.confirm(
        'La categoría "' +
          nombre +
          '" tiene ' +
          conEstaCategoria.length +
          ' tarea(s). Si la borras, esas tareas quedarán sin categoría. ¿Confirmas?'
      );
      if (!ok) return;
    }

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) {
      const aSubir = categorias.filter((c) => c.priority_order > ordenBorrado);
      for (const c of aSubir) {
        await supabase
          .from('projects')
          .update({ priority_order: c.priority_order - 1 })
          .eq('id', c.id);
      }
      if (editandoId === id) setEditandoId(null);
      cargarCategorias();
      cargarTareas();
    }
  }

  async function moverCategoria(cat, direccion) {
    const ordenActual = cat.priority_order;
    const ordenVecina =
      direccion === 'subir' ? ordenActual - 1 : ordenActual + 1;

    const vecina = categorias.find((c) => c.priority_order === ordenVecina);
    if (!vecina) return;

    await supabase
      .from('projects')
      .update({ priority_order: ordenVecina })
      .eq('id', cat.id);
    await supabase
      .from('projects')
      .update({ priority_order: ordenActual })
      .eq('id', vecina.id);

    cargarCategorias();
  }

  function abrirEdicion(cat) {
    if (editandoId === cat.id) {
      setEditandoId(null);
      return;
    }
    setEditandoId(cat.id);
    setEditContext(cat.context || '');
  }

  async function guardarCategoria(id) {
    const { error } = await supabase
      .from('projects')
      .update({ context: editContext || null })
      .eq('id', id);
    if (!error) {
      setEditandoId(null);
      cargarCategorias();
    }
  }

  // Marcar concluida / reabrir (rápido, sin expandir)
  async function alternarConcluida(t) {
    const nuevoEstado = t.state === 'Hecho' ? 'Pendiente' : 'Hecho';
    const { error } = await supabase
      .from('tasks')
      .update({
        state: nuevoEstado,
        date_completed: nuevoEstado === 'Hecho' ? new Date().toISOString() : null,
      })
      .eq('id', t.id);
    if (!error) cargarTareas();
  }

  async function salir() {
    await supabase.auth.signOut();
  }

  if (cargando) {
    return <p style={{ padding: '40px', fontFamily: 'Arial' }}>Cargando...</p>;
  }

  if (!sesion) {
    return <Login />;
  }

  const opcionesPosicion = [];
  for (let i = 1; i <= categorias.length + 1; i++)
    opcionesPosicion.push(String(i));

  // Datos para las pantallas nuevas: todo se calcula con lo que ya existe.
  const hoyISO = fechaLocalISO();
  const gruposHoy = gruposDeHoy(tareas, hoyISO);
  const gruposVisibles = pantalla === 'hoy' ? gruposHoy : gruposProximos(tareas, hoyISO);
  const resumenHoy = resumen((gruposHoy.find((g) => g.clave === hoyISO) || { tareas: [] }).tareas, subtareasDe);
  const abiertos = tareas.filter((t) => t.state !== 'Hecho').length;
  const tareaAbierta = detalleId ? tareas.find((t) => t.id === detalleId) || null : null;
  const diasConAlgo = new Set(gruposProximos(tareas, hoyISO).filter((g) => g.tipo === 'dia').map((g) => g.clave));

  const hayDatos = categorias.length + tareas.length + subtareas.length > 0;

  function marcarRespaldo(cual) {
    const iso = new Date().toISOString();
    guardarMarca(sesion.user.id, cual, iso);
    setMarcas((m) => ({ ...m, [cual]: iso }));
  }

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(''), 3500);
  }

  return (
    <div className="ag-app">
      <Encabezado
        titulo={pantalla === 'hoy' ? 'Hoy' : pantalla === 'proximos' ? 'Próximos' : 'Categorías'}
        subtitulo={
          pantalla === 'hoy'
            ? fechaLarga(hoyISO)
            : pantalla === 'proximos'
            ? abiertos + (abiertos === 1 ? ' compromiso abierto' : ' compromisos abiertos')
            : 'En orden de prioridad'
        }
        total={pantalla === 'hoy' ? formatoDuracion(resumenHoy.totalMin) : ''}
        porcentaje={pantalla === 'hoy' && resumenHoy.total > 0 ? resumenHoy.porcentaje : null}
        nota={
          pantalla === 'hoy' && resumenHoy.total > 0
            ? (resumenHoy.totalMin > 0
                ? (formatoDuracion(resumenHoy.hechoMin) || '0:00') +
                  ' de ' +
                  formatoDuracion(resumenHoy.totalMin) +
                  ' planeadas · '
                : '') +
              resumenHoy.hechos +
              ' de ' +
              resumenHoy.total +
              (resumenHoy.total === 1 ? ' hecho' : ' hechos')
            : ''
        }
      />

      {/* Captura de un compromiso nuevo: pantalla propia */}
      {capturaAbierta && (
        <Capturar
          categorias={categorias}
          alCerrar={() => setCapturaAbierta(false)}
          alGuardar={(texto) => {
            cargarTareas();
            cargarSubtareas();
            setCapturaAbierta(false);
            setAviso(texto);
            setTimeout(() => setAviso(''), 3500);
          }}
        />
      )}

      {/* Gestión de categorías */}
      {pantalla === 'categorias' && (
        <div className="ag-pantalla">
      <div
        style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f0f4f8',
          borderRadius: '6px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Mis categorías (orden de prioridad)</h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nueva categoría..."
            style={{ padding: '8px', fontSize: '15px', marginRight: '10px', marginBottom: '8px' }}
          />
          <label style={{ fontSize: '14px', marginRight: '6px' }}>
            Posición:
          </label>
          <select
            value={nuevaPosicion}
            onChange={(e) => setNuevaPosicion(e.target.value)}
            style={{ padding: '8px', fontSize: '15px', marginRight: '10px', marginBottom: '8px' }}
          >
            {opcionesPosicion.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            onClick={agregarCategoria}
            style={{ padding: '8px 16px', fontSize: '15px', marginBottom: '8px' }}
          >
            Agregar
          </button>
        </div>

        <div style={{ marginTop: '15px' }}>
          {categorias.map((c, indice) => (
            <div
              key={c.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '4px',
                marginBottom: '6px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', marginRight: '8px' }}>
                    <button
                      onClick={() => moverCategoria(c, 'subir')}
                      disabled={indice === 0}
                      style={{
                        fontSize: '11px',
                        lineHeight: '1',
                        padding: '1px 5px',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: indice === 0 ? 'default' : 'pointer',
                        backgroundColor: indice === 0 ? '#f0f0f0' : '#dde7f5',
                        color: indice === 0 ? '#bbb' : '#333',
                        marginBottom: '2px',
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moverCategoria(c, 'bajar')}
                      disabled={indice === categorias.length - 1}
                      style={{
                        fontSize: '11px',
                        lineHeight: '1',
                        padding: '1px 5px',
                        border: 'none',
                        borderRadius: '3px',
                        cursor:
                          indice === categorias.length - 1 ? 'default' : 'pointer',
                        backgroundColor:
                          indice === categorias.length - 1 ? '#f0f0f0' : '#dde7f5',
                        color: indice === categorias.length - 1 ? '#bbb' : '#333',
                      }}
                    >
                      ▼
                    </button>
                  </span>
                  <strong style={{ color: '#007bff', marginRight: '8px' }}>
                    {c.priority_order}º
                  </strong>
                  {c.name}
                </span>
                <div>
                  <button
                    onClick={() => abrirEdicion(c)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '13px',
                      backgroundColor: '#dde7f5',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '6px',
                    }}
                  >
                    {editandoId === c.id ? 'Cerrar' : 'Editar'}
                  </button>
                  <button
                    onClick={() => borrarCategoria(c.id, c.name, c.priority_order)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '13px',
                      backgroundColor: '#fdd',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>

              {editandoId === c.id && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#f7faff',
                    borderTop: '1px solid #e0e8f0',
                  }}
                >
                  <label
                    style={{
                      fontSize: '13px',
                      color: '#555',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Contexto de la categoría:
                  </label>
                  <textarea
                    value={editContext}
                    onChange={(e) => setEditContext(e.target.value)}
                    placeholder="Describe de qué va esta categoría, sus objetivos, situación..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      minHeight: '70px',
                      fontFamily: 'Arial',
                      boxSizing: 'border-box',
                      marginBottom: '10px',
                    }}
                  />
                  <button
                    onClick={() => guardarCategoria(c.id)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Guardar contexto
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
          <Respaldo
            cliente={supabase}
            ultimo={marcas.ultimo}
            hayDatos={hayDatos}
            alDescargar={() => marcarRespaldo('ultimo')}
            alRestaurar={() => {
              cargarCategorias();
              cargarTareas();
              cargarSubtareas();
            }}
          />
          <div className="ag-cuenta">
            <span>{sesion.user.email}</span>
            <button type="button" className="ag-boton-secundario" onClick={salir}>
              Salir
            </button>
          </div>
        </div>
      )}

      {/* Lista de compromisos, agrupada por dia */}
      {pantalla !== 'categorias' && (
        <div className="ag-lista">
          {pantalla === 'proximos' && (
            <TiraSemana
              hoyISO={hoyISO}
              diasConAlgo={diasConAlgo}
              alElegir={(iso) => {
                const grupo = document.getElementById('grupo-' + iso);
                if (grupo) grupo.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          )}
          {pantalla === 'hoy' && debeAvisar(marcas.ultimo, marcas.pospuesto, new Date(), hayDatos) && (
            <AvisoRespaldo
              ultimo={marcas.ultimo}
              alIr={() => setPantalla('categorias')}
              alPosponer={() => marcarRespaldo('pospuesto')}
            />
          )}
          {gruposVisibles.length === 0 && (
            <Vacio
              titulo={pantalla === 'hoy' ? 'Nada para hoy' : 'No hay compromisos'}
              pista="Toca el botón redondo para dictar o escribir uno."
            />
          )}
          {gruposVisibles.map((g) => (
            <section key={g.clave} id={'grupo-' + g.clave} className="ag-grupo">
              <EncabezadoDia
                grupo={g}
                hoyISO={hoyISO}
                extra={formatoDuracion(
                  resumen(g.tareas.filter((x) => x.state !== 'Hecho'), subtareasDe).totalMin
                )}
              />
              {g.tareas.map((t) => (
                <div key={t.id} className="ag-item">
                  <Renglon
                    tarea={t}
                    subtareas={subtareasDe(t.id)}
                    categoria={categorias.find((c) => c.id === t.project_id) || null}
                    indiceCategoria={categorias.findIndex((c) => c.id === t.project_id)}
                    abierta={false}
                    hoyISO={hoyISO}
                    alMarcar={() => alternarConcluida(t)}
                    alAbrir={() => setDetalleId(t.id)}
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* Detalle de un compromiso: pantalla propia */}
      {tareaAbierta && (
        <Detalle
          key={tareaAbierta.id}
          tarea={tareaAbierta}
          subtareas={subtareasDe(tareaAbierta.id)}
          categorias={categorias}
          hoyISO={hoyISO}
          alCerrar={() => setDetalleId(null)}
          alCambiar={() => {
            cargarTareas();
            cargarSubtareas();
          }}
          alAvisar={mostrarAviso}
        />
      )}

      {aviso && (
        <div className="ag-aviso" role="status">
          {aviso}
        </div>
      )}
      <BotonDictar
        alPulsar={() => {
          setCapturaAbierta(true);
        }}
      />
      <BarraNavegacion
        pantalla={pantalla}
        alCambiar={(p) => {
          setDetalleId(null);
          setPantalla(p);
        }}
      />
    </div>
  );
}
