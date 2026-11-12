import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Renglon from './componentes/Renglon';
import Capturar from './pantallas/Capturar';
import { Encabezado, EncabezadoDia, BarraNavegacion, BotonDictar, Vacio } from './componentes/Armazon';
import { fechaLocalISO, fechaLarga, formatoDuracion, gruposDeHoy, gruposProximos, resumen } from './logica/agenda.mjs';

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevaPosicion, setNuevaPosicion] = useState('1');
  const [tareas, setTareas] = useState([]);

  const [editandoId, setEditandoId] = useState(null);
  const [editContext, setEditContext] = useState('');

  // Edición de tarea (panel expandible al hacer click)
  const [tareaExpandidaId, setTareaExpandidaId] = useState(null);
  const [subtareas, setSubtareas] = useState([]);
  const [nuevaSubtarea, setNuevaSubtarea] = useState('');
  const [nuevaSubtareaTiempo, setNuevaSubtareaTiempo] = useState('30');
  const [mostrarPegarLista, setMostrarPegarLista] = useState(null);
  const [textoListaPegada, setTextoListaPegada] = useState('');
  const [tiempoListaPegada, setTiempoListaPegada] = useState('30');
  const [etTitulo, setEtTitulo] = useState('');
  const [etCategoria, setEtCategoria] = useState('');
  const [etImportancia, setEtImportancia] = useState('Media');
  const [etFecha, setEtFecha] = useState('');
  const [etHora12, setEtHora12] = useState('9');
  const [etMinutos, setEtMinutos] = useState('00');
  const [etAmpm, setEtAmpm] = useState('AM');
  const [etNotas, setEtNotas] = useState('');
  const [etTiempoEstimado, setEtTiempoEstimado] = useState('30');

  // Armazon nuevo (bloque I): pantalla visible, hoja de captura y aviso breve
  const [pantalla, setPantalla] = useState('hoy');
  const [capturaAbierta, setCapturaAbierta] = useState(false);
  const [aviso, setAviso] = useState('');

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

  // Tiempo total estimado de una tarea (suma de sus subtareas)
  function tiempoTotalDe(taskId) {
    return subtareasDe(taskId).reduce(
      (suma, s) => suma + (s.time_estimated || 0),
      0
    );
  }

  async function agregarSubtarea(taskId) {
    if (!nuevaSubtarea.trim()) return;
    const tiempo = parseInt(nuevaSubtareaTiempo, 10);
    if (isNaN(tiempo) || tiempo <= 0) {
      alert(
        'El tiempo estimado es obligatorio (el auto-llenado lo necesita para ubicarla en la agenda).'
      );
      return;
    }
    const subsActuales = subtareasDe(taskId);
    const nuevoOrden = subsActuales.length + 1;
    const { error } = await supabase.from('subtasks').insert([
      {
        task_id: taskId,
        title: nuevaSubtarea.trim(),
        time_estimated: tiempo,
        state: 'Pendiente',
        orden: nuevoOrden,
      },
    ]);
    if (!error) {
      setNuevaSubtarea('');
      setNuevaSubtareaTiempo('30');
      cargarSubtareas();
    }
  }

  async function alternarSubtarea(sub) {
    const nuevoEstado = sub.state === 'Hecho' ? 'Pendiente' : 'Hecho';
    const { error } = await supabase
      .from('subtasks')
      .update({ state: nuevoEstado })
      .eq('id', sub.id);
    if (!error) cargarSubtareas();
  }

  async function borrarSubtarea(sub, taskId) {
    const { error } = await supabase.from('subtasks').delete().eq('id', sub.id);
    if (!error) {
      // Renumerar las que quedan
      const restantes = subtareasDe(taskId).filter((s) => s.id !== sub.id);
      let orden = 1;
      for (const s of restantes) {
        await supabase.from('subtasks').update({ orden }).eq('id', s.id);
        orden++;
      }
      cargarSubtareas();
    }
  }

  // Mover una subtarea arriba o abajo (intercambia orden con su vecina)
  async function moverSubtarea(sub, taskId, direccion) {
    const subs = subtareasDe(taskId);
    const posActual = subs.findIndex((s) => s.id === sub.id);
    const posVecina = direccion === 'subir' ? posActual - 1 : posActual + 1;
    if (posVecina < 0 || posVecina >= subs.length) return;

    const vecina = subs[posVecina];
    const ordenActual = sub.orden;
    const ordenVecina = vecina.orden;

    await supabase
      .from('subtasks')
      .update({ orden: ordenVecina })
      .eq('id', sub.id);
    await supabase
      .from('subtasks')
      .update({ orden: ordenActual })
      .eq('id', vecina.id);

    cargarSubtareas();
  }

  // Pegar una lista de texto: cada línea se convierte en una subtarea,
  // todas con el mismo tiempo (obligatorio, porque el auto-llenado lo necesita)
  async function procesarListaPegada(taskId) {
    const lineas = textoListaPegada
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lineas.length === 0) {
      alert('Pega al menos una línea de texto.');
      return;
    }
    const tiempo = parseInt(tiempoListaPegada, 10);
    if (!tiempoListaPegada || isNaN(tiempo) || tiempo <= 0) {
      alert(
        'El tiempo por subtarea es obligatorio (el auto-llenado lo necesita para saber si cabe en un hueco de la agenda).'
      );
      return;
    }

    const subsActuales = subtareasDe(taskId);
    let orden = subsActuales.length + 1;

    for (const linea of lineas) {
      await supabase.from('subtasks').insert([
        {
          task_id: taskId,
          title: linea,
          time_estimated: tiempo,
          state: 'Pendiente',
          orden: orden,
        },
      ]);
      orden++;
    }

    setTextoListaPegada('');
    setTiempoListaPegada('30');
    setMostrarPegarLista(null);
    cargarSubtareas();
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

  // Armador temporal de subtareas (antes de que exista la tarea madre)
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

  // Abrir/cerrar el panel de edición de una tarea
  function alternarExpansion(t) {
    if (tareaExpandidaId === t.id) {
      setTareaExpandidaId(null);
      return;
    }
    setTareaExpandidaId(t.id);
    setEtTitulo(t.title || '');
    setEtCategoria(t.project_id || '');
    setEtImportancia(t.priority || 'Media');
    setEtNotas(t.notes || '');
    setEtTiempoEstimado(t.time_estimated ? String(t.time_estimated) : '30');
    // Descomponer fecha/hora
    if (t.date_promised) {
      const d = new Date(t.date_promised);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setEtFecha(yyyy + '-' + mm + '-' + dd);
      let h = d.getHours();
      const min = String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0');
      const ap = h >= 12 ? 'PM' : 'AM';
      let h12 = h % 12;
      if (h12 === 0) h12 = 12;
      setEtHora12(String(h12));
      setEtMinutos(min);
      setEtAmpm(ap);
    } else {
      setEtFecha('');
      setEtHora12('9');
      setEtMinutos('00');
      setEtAmpm('AM');
    }
  }

  async function guardarEdicionTarea(t) {
    let hora24 = parseInt(etHora12, 10);
    if (etAmpm === 'PM' && hora24 !== 12) hora24 = hora24 + 12;
    if (etAmpm === 'AM' && hora24 === 12) hora24 = 0;
    const horaStr = String(hora24).padStart(2, '0');
    const fechaHora = etFecha
      ? etFecha + 'T' + horaStr + ':' + etMinutos + ':00'
      : t.date_promised;

    const actualizacion = {
      title: etTitulo,
      project_id: etCategoria || null,
      priority: etImportancia,
      date_promised: fechaHora,
      notes: etNotas || null,
    };

    if (t.type === 'Tarea') {
      const tiempo = parseInt(etTiempoEstimado, 10);
      actualizacion.time_estimated = !isNaN(tiempo) && tiempo > 0 ? tiempo : 30;
    }

    const { error } = await supabase
      .from('tasks')
      .update(actualizacion)
      .eq('id', t.id);

    if (!error) {
      setTareaExpandidaId(null);
      cargarTareas();
    }
  }

  async function borrarTarea(t) {
    const ok = window.confirm(
      '¿Borrar "' + t.title + '"? Esta acción no se puede deshacer.'
    );
    if (!ok) return;
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (!error) {
      if (tareaExpandidaId === t.id) setTareaExpandidaId(null);
      cargarTareas();
    }
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

  const estiloCampo = {
    padding: '10px',
    fontSize: '16px',
    marginRight: '10px',
    marginBottom: '10px',
    boxSizing: 'border-box',
  };

  const estiloHora = {
    padding: '10px',
    fontSize: '16px',
    marginRight: '6px',
    marginBottom: '10px',
    boxSizing: 'border-box',
  };

  const opcionesHora = [];
  for (let h = 1; h <= 12; h++) opcionesHora.push(String(h));
  const opcionesMinutos = [];
  for (let m = 0; m < 60; m += 5)
    opcionesMinutos.push(String(m).padStart(2, '0'));

  const opcionesImportancia = [
    { valor: 'Muy alta', texto: 'Muy alta — crítico' },
    { valor: 'Alta', texto: 'Alta — importante' },
    { valor: 'Media', texto: 'Media — normal' },
    { valor: 'Baja', texto: 'Baja — puede esperar' },
    { valor: 'Muy baja', texto: 'Muy baja — cuando haya tiempo' },
  ];

  const opcionesPosicion = [];
  for (let i = 1; i <= categorias.length + 1; i++)
    opcionesPosicion.push(String(i));

  // Datos para las pantallas nuevas: todo se calcula con lo que ya existe.
  const hoyISO = fechaLocalISO();
  const gruposHoy = gruposDeHoy(tareas, hoyISO);
  const gruposVisibles = pantalla === 'hoy' ? gruposHoy : gruposProximos(tareas, hoyISO);
  const resumenHoy = resumen((gruposHoy.find((g) => g.clave === hoyISO) || { tareas: [] }).tareas, subtareasDe);
  const abiertos = tareas.filter((t) => t.state !== 'Hecho').length;

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
          {gruposVisibles.length === 0 && (
            <Vacio
              titulo={pantalla === 'hoy' ? 'Nada para hoy' : 'No hay compromisos'}
              pista="Toca el botón redondo para dictar o escribir uno."
            />
          )}
          {gruposVisibles.map((g) => (
            <section key={g.clave} className="ag-grupo">
              <EncabezadoDia
                grupo={g}
                hoyISO={hoyISO}
                extra={formatoDuracion(
                  resumen(g.tareas.filter((x) => x.state !== 'Hecho'), subtareasDe).totalMin
                )}
              />
              {g.tareas.map((t) => {
                const expandida = tareaExpandidaId === t.id;
                const numeroTarea = tareas.findIndex((x) => x.id === t.id) + 1;
                const subs = subtareasDe(t.id);
                const tiempoTotal = tiempoTotalDe(t.id);
                return (
                  <div key={t.id} className={'ag-item' + (expandida ? ' abierta' : '')}>
                    <Renglon
                      tarea={t}
                      subtareas={subs}
                      categoria={categorias.find((c) => c.id === t.project_id) || null}
                      indiceCategoria={categorias.findIndex((c) => c.id === t.project_id)}
                      abierta={expandida}
                      hoyISO={hoyISO}
                      alMarcar={() => alternarConcluida(t)}
                      alAbrir={() => alternarExpansion(t)}
                    />

            {/* Panel de edición expandible */}
            {expandida && (
              <div
                style={{
                  padding: '15px',
                  backgroundColor: '#fbfbfb',
                  borderTop: '1px solid #e5e5e5',
                }}
              >
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px' }}>
                  Título:
                </label>
                <input
                  type="text"
                  value={etTitulo}
                  onChange={(e) => setEtTitulo(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '10px' }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={etCategoria}
                    onChange={(e) => setEtCategoria(e.target.value)}
                    style={estiloCampo}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={etImportancia}
                    onChange={(e) => setEtImportancia(e.target.value)}
                    style={estiloCampo}
                  >
                    {opcionesImportancia.map((op) => (
                      <option key={op.valor} value={op.valor}>
                        {op.texto}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={etFecha}
                    onChange={(e) => setEtFecha(e.target.value)}
                    style={estiloCampo}
                  />
                  <select
                    value={etHora12}
                    onChange={(e) => setEtHora12(e.target.value)}
                    style={estiloHora}
                  >
                    {opcionesHora.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span style={{ marginRight: '6px', fontSize: '18px' }}>:</span>
                  <select
                    value={etMinutos}
                    onChange={(e) => setEtMinutos(e.target.value)}
                    style={estiloHora}
                  >
                    {opcionesMinutos.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={etAmpm}
                    onChange={(e) => setEtAmpm(e.target.value)}
                    style={estiloHora}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>

                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px' }}>
                  {t.type === 'Reunión'
                    ? 'Comentarios / lo que se trató:'
                    : 'Notas:'}
                </label>
                <textarea
                  value={etNotas}
                  onChange={(e) => setEtNotas(e.target.value)}
                  placeholder={
                    t.type === 'Reunión'
                      ? 'Qué se acordó, pendientes, siguientes pasos...'
                      : 'Notas...'
                  }
                  style={{ width: '100%', padding: '8px', fontSize: '14px', minHeight: '50px', fontFamily: 'Arial', boxSizing: 'border-box', marginBottom: '10px' }}
                />

                {t.type === 'Tarea' && subs.length === 0 && (
                  <label style={{ fontSize: '14px', display: 'block', marginBottom: '10px' }}>
                    Tiempo estimado (minutos):
                    <input
                      type="number"
                      value={etTiempoEstimado}
                      onChange={(e) => setEtTiempoEstimado(e.target.value)}
                      style={{ ...estiloHora, marginLeft: '8px', width: '80px' }}
                    />
                  </label>
                )}
                {t.type === 'Tarea' && subs.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
                    Tiempo tomado de la suma de sus {subs.length} subtarea(s): {tiempoTotal} min
                  </div>
                )}

                <button
                  onClick={() => guardarEdicionTarea(t)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '8px',
                  }}
                >
                  Guardar cambios
                </button>
                <button
                  onClick={() => borrarTarea(t)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: '#fdd',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Borrar
                </button>

                {/* Subtareas (incisos) — SOLO para Tareas */}
                {t.type === 'Tarea' && (
                <div
                  style={{
                    marginTop: '15px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e5e5',
                  }}
                >
                  <strong style={{ fontSize: '14px', color: '#333' }}>
                    Subtareas
                  </strong>

                  {subs.map((s, i) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 0',
                      }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', marginRight: '6px' }}>
                        <button
                          onClick={() => moverSubtarea(s, t.id, 'subir')}
                          disabled={i === 0}
                          style={{
                            fontSize: '10px',
                            lineHeight: '1',
                            padding: '1px 4px',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: i === 0 ? 'default' : 'pointer',
                            backgroundColor: i === 0 ? '#f0f0f0' : '#dde7f5',
                            color: i === 0 ? '#bbb' : '#333',
                            marginBottom: '1px',
                          }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moverSubtarea(s, t.id, 'bajar')}
                          disabled={i === subs.length - 1}
                          style={{
                            fontSize: '10px',
                            lineHeight: '1',
                            padding: '1px 4px',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: i === subs.length - 1 ? 'default' : 'pointer',
                            backgroundColor: i === subs.length - 1 ? '#f0f0f0' : '#dde7f5',
                            color: i === subs.length - 1 ? '#bbb' : '#333',
                          }}
                        >
                          ▼
                        </button>
                      </span>
                      <input
                        type="checkbox"
                        checked={s.state === 'Hecho'}
                        onChange={() => alternarSubtarea(s)}
                        style={{ marginRight: '8px', width: '16px', height: '16px' }}
                      />
                      <span style={{ color: '#007bff', marginRight: '6px', fontSize: '13px' }}>
                        {numeroTarea}.{i + 1}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: '14px',
                          textDecoration:
                            s.state === 'Hecho' ? 'line-through' : 'none',
                          color: s.state === 'Hecho' ? '#999' : '#000',
                        }}
                      >
                        {s.title}
                        {s.time_estimated
                          ? ' (' + s.time_estimated + ' min)'
                          : ''}
                      </span>
                      <button
                        onClick={() => borrarSubtarea(s, t.id)}
                        style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          backgroundColor: '#fdd',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      marginTop: '8px',
                    }}
                  >
                    <input
                      type="text"
                      value={nuevaSubtarea}
                      onChange={(e) => setNuevaSubtarea(e.target.value)}
                      placeholder="Nueva subtarea..."
                      style={{
                        flex: 1,
                        minWidth: '140px',
                        padding: '6px',
                        fontSize: '14px',
                        marginRight: '6px',
                        marginBottom: '6px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type="number"
                      value={nuevaSubtareaTiempo}
                      onChange={(e) => setNuevaSubtareaTiempo(e.target.value)}
                      placeholder="min"
                      style={{
                        width: '70px',
                        padding: '6px',
                        fontSize: '14px',
                        marginRight: '6px',
                        marginBottom: '6px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => agregarSubtarea(t.id)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '14px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '6px',
                      }}
                    >
                      + Agregar
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setMostrarPegarLista(
                        mostrarPegarLista === t.id ? null : t.id
                      )
                    }
                    style={{
                      padding: '4px 10px',
                      fontSize: '13px',
                      backgroundColor: '#f0f0f0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginTop: '4px',
                    }}
                  >
                    {mostrarPegarLista === t.id
                      ? 'Cerrar'
                      : '📋 Pegar lista de tareas'}
                  </button>

                  {mostrarPegarLista === t.id && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#f7faff',
                        borderRadius: '6px',
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
                        Pega tu lista (una subtarea por renglón):
                      </label>
                      <textarea
                        value={textoListaPegada}
                        onChange={(e) => setTextoListaPegada(e.target.value)}
                        placeholder={
                          'Calentamiento\nRutina de fuerza\nEnfriamiento'
                        }
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '14px',
                          minHeight: '90px',
                          fontFamily: 'Arial',
                          boxSizing: 'border-box',
                          marginBottom: '8px',
                        }}
                      />
                      <label
                        style={{
                          fontSize: '13px',
                          color: '#555',
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        Minutos para CADA UNA (obligatorio — el auto-llenado
                        lo necesita):
                      </label>
                      <input
                        type="number"
                        value={tiempoListaPegada}
                        onChange={(e) => setTiempoListaPegada(e.target.value)}
                        placeholder="ej. 30"
                        style={{
                          width: '100px',
                          padding: '6px',
                          fontSize: '14px',
                          marginBottom: '8px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <br />
                      <button
                        onClick={() => procesarListaPegada(t.id)}
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
                        Crear subtareas de la lista
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>
        );
              })}
            </section>
          ))}
        </div>
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
          setTareaExpandidaId(null);
          setPantalla(p);
        }}
      />
    </div>
  );
}
