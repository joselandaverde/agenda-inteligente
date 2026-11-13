import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Renglon from './componentes/Renglon';
import Actividad from './pantallas/Actividad';
import Capturar from './pantallas/Capturar';
import Categorias from './pantallas/Categorias';
import Detalle from './pantallas/Detalle';
import Respaldo, { AvisoRespaldo, leerMarcas, guardarMarca } from './pantallas/Respaldo';
import Semana from './pantallas/Semana';
import { Encabezado, EncabezadoDia, BarraNavegacion, BotonDictar, TiraSemana, Vacio, usarComputadora } from './componentes/Armazon';
import { alternarHecho } from './datos/compromisos';
import { SUGERIDAS_EN_HOY, fechaLocalISO, fechaLarga, formatoDuracion, gruposDeHoy, gruposProximos, resumen, sugeridas } from './logica/agenda.mjs';
import { debeAvisar } from './logica/respaldo.mjs';

// Armazón de la app: sesión, carga de datos y navegación. Cada pantalla vive
// en su archivo. En pantallas anchas se muestra la vista de computadora.
export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [categorias, setCategorias] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [subtareas, setSubtareas] = useState([]);

  // Pantalla visible en el teléfono, compromiso abierto, captura y aviso breve.
  // `captura` es null si está cerrada; abierta, lleva la fecha con la que nace
  // el compromiso (la de una columna) o null.
  const [pantalla, setPantalla] = useState('hoy');
  const [detalleId, setDetalleId] = useState(null);
  const [captura, setCaptura] = useState(null);
  const [aviso, setAviso] = useState('');

  // Respaldo (bloque 0-C): fechas recordadas en este equipo
  const [marcas, setMarcas] = useState({ ultimo: null, pospuesto: null });

  // Registro de acciones (bloque 0-D): cambia cuando algo pudo anotarse, para
  // que la lista de Actividad se vuelva a leer.
  const [senalActividad, setSenalActividad] = useState(0);

  const computadora = usarComputadora();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, sesionNueva) => {
      setSesion(sesionNueva);
    });

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
    const { data, error } = await supabase.from('tasks').select('*').order('date_promised', { ascending: true });
    if (!error) setTareas(data);
  }

  async function cargarCategorias() {
    const { data, error } = await supabase.from('projects').select('*').order('priority_order', { ascending: true });
    if (!error) setCategorias(data);
  }

  // Todas las subtareas, de todos los compromisos, para calcular avances
  async function cargarSubtareas() {
    const { data, error } = await supabase.from('subtasks').select('*').order('orden', { ascending: true });
    if (!error) setSubtareas(data);
  }

  function cargarTodo() {
    cargarCategorias();
    cargarTareas();
    cargarSubtareas();
    setSenalActividad((n) => n + 1);
  }

  // Subtareas de una tarea concreta, ordenadas
  function subtareasDe(taskId) {
    return subtareas.filter((s) => s.task_id === taskId).sort((a, b) => a.orden - b.orden);
  }

  // Marcar como hecha o reabrir, desde la lista
  async function alternarConcluida(t) {
    const { error } = await alternarHecho(supabase, t);
    if (!error) cargarTareas();
  }

  async function salir() {
    await supabase.auth.signOut();
  }

  function mostrarAviso(texto) {
    setAviso(texto);
    setSenalActividad((n) => n + 1);
    setTimeout(() => setAviso(''), 3500);
  }

  if (cargando) {
    return <p className="ag-cargando">Cargando...</p>;
  }

  if (!sesion) {
    return <Login />;
  }

  // Datos para las pantallas: todo se calcula con lo que ya existe.
  const hoyISO = fechaLocalISO();
  const tareaAbierta = detalleId ? tareas.find((t) => t.id === detalleId) || null : null;
  const hayDatos = categorias.length + tareas.length + subtareas.length > 0;
  const avisarRespaldo = debeAvisar(marcas.ultimo, marcas.pospuesto, new Date(), hayDatos);

  function marcarRespaldo(cual) {
    const iso = new Date().toISOString();
    guardarMarca(sesion.user.id, cual, iso);
    setMarcas((m) => ({ ...m, [cual]: iso }));
    setSenalActividad((n) => n + 1);
  }

  // Categorías, respaldo y actividad: lo mismo en el teléfono y en la computadora.
  const administracion = (
    <>
      <Categorias cliente={supabase} categorias={categorias} tareas={tareas} alCambiar={cargarTodo} alAvisar={mostrarAviso} />
      <Respaldo cliente={supabase} ultimo={marcas.ultimo} hayDatos={hayDatos} alDescargar={() => marcarRespaldo('ultimo')} alRestaurar={cargarTodo} />
      <Actividad cliente={supabase} senal={senalActividad} />
    </>
  );

  // Hojas que se abren encima de cualquier vista: captura, detalle y aviso.
  const encima = (
    <>
      {captura && (
        <Capturar
          categorias={categorias}
          fechaInicial={captura.fecha}
          alCerrar={() => setCaptura(null)}
          alGuardar={(texto) => {
            cargarTareas();
            cargarSubtareas();
            setCaptura(null);
            mostrarAviso(texto);
          }}
        />
      )}
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
    </>
  );

  if (computadora) {
    return (
      <div className="ag-app ancha">
        <Semana
          tareas={tareas}
          subtareasDe={subtareasDe}
          categorias={categorias}
          hoyISO={hoyISO}
          cuenta={sesion.user.email}
          respaldo={{ mostrar: avisarRespaldo, ultimo: marcas.ultimo, alPosponer: () => marcarRespaldo('pospuesto') }}
          administracion={administracion}
          alMarcar={alternarConcluida}
          alAbrir={(t) => setDetalleId(t.id)}
          alCapturar={(fecha) => setCaptura({ fecha })}
          alSalir={salir}
        />
        {encima}
      </div>
    );
  }

  const gruposDelDia = gruposDeHoy(tareas, hoyISO);
  // Debajo de lo de hoy, las cuatro tareas de mayor puntaje (calculado con la
  // fecha del día) que no estén ya en la lista.
  const tareasSugeridas = sugeridas(tareas, hoyISO, SUGERIDAS_EN_HOY, gruposDelDia.flatMap((g) => g.tareas));
  const gruposHoy = tareasSugeridas.length > 0 ? [...gruposDelDia, { clave: 'sugeridas', tipo: 'sugeridas', tareas: tareasSugeridas }] : gruposDelDia;
  const proximos = gruposProximos(tareas, hoyISO);
  const gruposVisibles = pantalla === 'hoy' ? gruposHoy : proximos;
  const resumenHoy = resumen((gruposHoy.find((g) => g.clave === hoyISO) || { tareas: [] }).tareas, subtareasDe);
  const abiertos = tareas.filter((t) => t.state !== 'Hecho').length;
  const diasConAlgo = new Set(proximos.filter((g) => g.tipo === 'dia').map((g) => g.clave));

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
                ? (formatoDuracion(resumenHoy.hechoMin) || '0:00') + ' de ' + formatoDuracion(resumenHoy.totalMin) + ' planeadas · '
                : '') +
              resumenHoy.hechos +
              ' de ' +
              resumenHoy.total +
              (resumenHoy.total === 1 ? ' hecho' : ' hechos')
            : ''
        }
      />

      {/* Categorías, respaldo y cuenta */}
      {pantalla === 'categorias' && (
        <div className="ag-pantalla">
          {administracion}
          <div className="ag-cuenta">
            <span>{sesion.user.email}</span>
            <button type="button" className="ag-boton-secundario" onClick={salir}>
              Salir
            </button>
          </div>
        </div>
      )}

      {/* Lista de compromisos, agrupada por día */}
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
          {pantalla === 'hoy' && avisarRespaldo && (
            <AvisoRespaldo ultimo={marcas.ultimo} alIr={() => setPantalla('categorias')} alPosponer={() => marcarRespaldo('pospuesto')} />
          )}
          {gruposVisibles.length === 0 && (
            <Vacio titulo={pantalla === 'hoy' ? 'Nada para hoy' : 'No hay compromisos'} pista="Toca el botón redondo para dictar o escribir uno." />
          )}
          {gruposVisibles.map((g) => (
            <section key={g.clave} id={'grupo-' + g.clave} className="ag-grupo">
              <EncabezadoDia grupo={g} hoyISO={hoyISO} extra={formatoDuracion(resumen(g.tareas.filter((x) => x.state !== 'Hecho'), subtareasDe).totalMin)} />
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

      {encima}
      <BotonDictar alPulsar={() => setCaptura({ fecha: null })} />
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
