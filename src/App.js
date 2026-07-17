import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [tarea, setTarea] = useState('');
  const [tipo, setTipo] = useState('Tarea');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  const [hora12, setHora12] = useState('9');
  const [minutos, setMinutos] = useState('00');
  const [ampm, setAmpm] = useState('AM');

  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [importancia, setImportancia] = useState('Media');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevaPosicion, setNuevaPosicion] = useState('1');
  const [mensaje, setMensaje] = useState('');
  const [tareas, setTareas] = useState([]);

  const [lugar, setLugar] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [notas, setNotas] = useState('');

  const [repeticion, setRepeticion] = useState('Ninguna');
  const [repeticionTieneFin, setRepeticionTieneFin] = useState(false);
  const [repeticionFin, setRepeticionFin] = useState('');
  const [tieneFechaLimite, setTieneFechaLimite] = useState(false);
  const [fechaLimite, setFechaLimite] = useState('');
  const [requiereConfirmacion, setRequiereConfirmacion] = useState(false);
  const [tiempoEstimado, setTiempoEstimado] = useState('30');
  const [quiereNotificacion, setQuiereNotificacion] = useState(false);
  const [canalNotificacion, setCanalNotificacion] = useState('App');
  const [minutosAntes, setMinutosAntes] = useState('15');
  const [tendraSubtareas, setTendraSubtareas] = useState(false);
  const [tieneFechaHora, setTieneFechaHora] = useState(false);
  const [subtareasTemp, setSubtareasTemp] = useState([]);
  const [nuevaSubtareaTempTitulo, setNuevaSubtareaTempTitulo] = useState('');
  const [nuevaSubtareaTempTiempo, setNuevaSubtareaTempTiempo] = useState('30');
  const [mostrarPegarListaTemp, setMostrarPegarListaTemp] = useState(false);
  const [textoListaTemp, setTextoListaTemp] = useState('');
  const [tiempoListaTemp, setTiempoListaTemp] = useState('30');

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

  // % de avance de una tarea (subtareas hechas / total)
  function avanceDe(taskId) {
    const subs = subtareasDe(taskId);
    if (subs.length === 0) return null;
    const hechas = subs.filter((s) => s.state === 'Hecho').length;
    return Math.round((hechas / subs.length) * 100);
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
  function agregarSubtareaTemp() {
    if (!nuevaSubtareaTempTitulo.trim()) return;
    const tiempo = parseInt(nuevaSubtareaTempTiempo, 10);
    if (isNaN(tiempo) || tiempo <= 0) {
      alert('El tiempo estimado es obligatorio.');
      return;
    }
    setSubtareasTemp([
      ...subtareasTemp,
      { titulo: nuevaSubtareaTempTitulo.trim(), tiempo },
    ]);
    setNuevaSubtareaTempTitulo('');
    setNuevaSubtareaTempTiempo('30');
  }

  function quitarSubtareaTemp(indice) {
    setSubtareasTemp(subtareasTemp.filter((_, i) => i !== indice));
  }

  function procesarListaTemp() {
    const lineas = textoListaTemp
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lineas.length === 0) {
      alert('Pega al menos una línea de texto.');
      return;
    }
    const tiempo = parseInt(tiempoListaTemp, 10);
    if (isNaN(tiempo) || tiempo <= 0) {
      alert('El tiempo por subtarea es obligatorio.');
      return;
    }
    const nuevas = lineas.map((l) => ({ titulo: l, tiempo }));
    setSubtareasTemp([...subtareasTemp, ...nuevas]);
    setTextoListaTemp('');
    setTiempoListaTemp('30');
    setMostrarPegarListaTemp(false);
  }

  async function crearTarea() {
    if (!tarea.trim()) {
      setMensaje('Escribe un título primero');
      return;
    }

    const esContenedorDeSubtareas = tipo === 'Tarea' && tendraSubtareas;

    // Por si el usuario escribió una subtarea (o pegó texto) y le dio
    // "Crear" sin antes darle a "+ Agregar" / "Agregar subtareas de la
    // lista": la recogemos aquí para no perderla ni bloquear sin motivo.
    let listaFinal = subtareasTemp;
    if (esContenedorDeSubtareas) {
      if (nuevaSubtareaTempTitulo.trim()) {
        const tiempoSuelto = parseInt(nuevaSubtareaTempTiempo, 10);
        listaFinal = [
          ...listaFinal,
          {
            titulo: nuevaSubtareaTempTitulo.trim(),
            tiempo:
              !isNaN(tiempoSuelto) && tiempoSuelto > 0 ? tiempoSuelto : 30,
          },
        ];
      }
      if (textoListaTemp.trim()) {
        const lineas = textoListaTemp
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const tiempoLista = parseInt(tiempoListaTemp, 10);
        const tFinal =
          !isNaN(tiempoLista) && tiempoLista > 0 ? tiempoLista : 30;
        listaFinal = [
          ...listaFinal,
          ...lineas.map((l) => ({ titulo: l, tiempo: tFinal })),
        ];
      }
    }

    if (esContenedorDeSubtareas && listaFinal.length === 0) {
      setMensaje(
        'Agrega al menos una subtarea, o desmarca la casilla de dividir.'
      );
      return;
    }

    if (
      !esContenedorDeSubtareas &&
      repeticion !== 'Ninguna' &&
      !repeticionTieneFin
    ) {
      const ok = window.confirm(
        'Esta repetición no tiene fecha final: se repetirá indefinidamente hasta que la cambies. ¿Continuar?'
      );
      if (!ok) return;
    }

    setMensaje('Guardando...');

    const sinFechaHora =
      tipo === 'Tarea' && (esContenedorDeSubtareas || !tieneFechaHora);

    let fechaHora = null;
    if (!sinFechaHora) {
      let hora24 = parseInt(hora12, 10);
      if (ampm === 'PM' && hora24 !== 12) hora24 = hora24 + 12;
      if (ampm === 'AM' && hora24 === 12) hora24 = 0;
      const horaStr = String(hora24).padStart(2, '0');
      fechaHora = fecha + 'T' + horaStr + ':' + minutos + ':00';
    }

    const datos = {
      title: tarea,
      type: tipo,
      // Obligatoria en Reunión/Recordatorio. Opcional en Tarea (lo que
      // importa ahí es la fecha límite, no un momento exacto fijo).
      date_promised: fechaHora,
      project_id: categoria || null,
      priority: importancia,
      state: 'Pendiente',
      notes: notas || null,
      repetition: esContenedorDeSubtareas ? 'Ninguna' : repeticion,
      repetition_end:
        !esContenedorDeSubtareas &&
        repeticion !== 'Ninguna' &&
        repeticionTieneFin &&
        repeticionFin
          ? repeticionFin
          : null,
      notification_channels: quiereNotificacion ? [canalNotificacion] : null,
      reminder_minutes_before: quiereNotificacion
        ? parseInt(minutosAntes, 10) || 15
        : null,
    };

    if (tipo === 'Reunión') {
      datos.location = lugar || null;
      datos.participantes = participantes
        ? participantes.split(',').map((p) => p.trim())
        : null;
    }

    if (tipo === 'Tarea') {
      datos.deadline = tieneFechaLimite && fechaLimite ? fechaLimite : null;
      datos.requires_confirmation = requiereConfirmacion;
      // Si tendrá subtareas, el tiempo se calculará como suma; se guarda el
      // default por ahora (se recalculará visualmente cuando existan subtareas)
      const t = parseInt(tiempoEstimado, 10);
      datos.time_estimated = !isNaN(t) && t > 0 ? t : 30;
    }

    const { data: creada, error } = await supabase
      .from('tasks')
      .insert([datos])
      .select()
      .single();

    if (error) {
      setMensaje('Error: ' + error.message);
      return;
    }

    // Si tenía subtareas armadas, crearlas ahora vinculadas a la tarea recién creada
    if (esContenedorDeSubtareas && creada) {
      let orden = 1;
      for (const s of listaFinal) {
        await supabase.from('subtasks').insert([
          {
            task_id: creada.id,
            title: s.titulo,
            time_estimated: s.tiempo,
            state: 'Pendiente',
            orden: orden,
          },
        ]);
        orden++;
      }
      cargarSubtareas();
    }

    setMensaje(
      esContenedorDeSubtareas
        ? 'Tarea y ' + listaFinal.length + ' subtarea(s) guardadas'
        : 'Tarea guardada'
    );
    setTarea('');
    setLugar('');
    setParticipantes('');
    setNotas('');
    setRepeticion('Ninguna');
    setRepeticionTieneFin(false);
    setRepeticionFin('');
    setTieneFechaLimite(false);
    setFechaLimite('');
    setRequiereConfirmacion(false);
    setTiempoEstimado('30');
    setTendraSubtareas(false);
    setQuiereNotificacion(false);
    setCanalNotificacion('App');
    setMinutosAntes('15');
    setTieneFechaHora(false);
    setSubtareasTemp([]);
    setNuevaSubtareaTempTitulo('');
    setNuevaSubtareaTempTiempo('30');
    setTextoListaTemp('');
    setTiempoListaTemp('30');
    setMostrarPegarListaTemp(false);
    cargarTareas();
  }

  // Marcar concluida / reabrir (rápido, sin expandir)
  async function alternarConcluida(t) {
    const nuevoEstado = t.state === 'Hecho' ? 'Pendiente' : 'Hecho';
    const { error } = await supabase
      .from('tasks')
      .update({
        state: nuevoEstado,
        date_completed:
          nuevoEstado === 'Hecho' ? new Date().toISOString() : null,
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

  function formatearFechaHora(valor) {
    if (!valor) return '';
    const d = new Date(valor);
    const fechaTxt = d.toLocaleDateString('es-MX');
    const horaTxt = d.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return fechaTxt + ' ' + horaTxt;
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

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'Arial',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>Mi Agenda</h1>
        <button
          onClick={salir}
          style={{
            padding: '8px 16px',
            backgroundColor: '#eee',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Salir
        </button>
      </div>
      <p style={{ color: '#666', fontSize: '13px' }}>{sesion.user.email}</p>

      {/* Tipo, categoría, importancia */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          style={estiloCampo}
        >
          <option value="Reunión">Reunión</option>
          <option value="Tarea">Tarea</option>
          <option value="Recordatorio">Recordatorio</option>
        </select>

        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
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
          value={importancia}
          onChange={(e) => setImportancia(e.target.value)}
          style={estiloCampo}
        >
          {opcionesImportancia.map((op) => (
            <option key={op.valor} value={op.valor}>
              {op.texto}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha y hora: obligatoria para Reunión/Recordatorio; opcional (con casilla) para Tarea */}
      {tipo !== 'Tarea' && !(tipo === 'Tarea' && tendraSubtareas) && (
        <>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
          >
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={estiloCampo}
            />
            <select
              value={hora12}
              onChange={(e) => setHora12(e.target.value)}
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
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
              style={estiloHora}
            >
              {opcionesMinutos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={ampm}
              onChange={(e) => setAmpm(e.target.value)}
              style={estiloHora}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>

          {/* Repetición + fin opcional */}
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <label style={{ fontSize: '14px', marginRight: '8px' }}>
                Repetir:
              </label>
              <select
                value={repeticion}
                onChange={(e) => {
                  setRepeticion(e.target.value);
                  if (e.target.value === 'Ninguna') {
                    setRepeticionTieneFin(false);
                    setRepeticionFin('');
                  }
                }}
                style={estiloCampo}
              >
                <option value="Ninguna">Ninguna</option>
                <option value="Diaria">Diaria</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensual">Mensual</option>
              </select>
            </div>

            {repeticion !== 'Ninguna' && (
              <div style={{ marginLeft: '4px' }}>
                <label
                  style={{
                    fontSize: '14px',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={repeticionTieneFin}
                    onChange={(e) => setRepeticionTieneFin(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  ¿Termina en una fecha?
                </label>
                {repeticionTieneFin && (
                  <label style={{ fontSize: '14px', display: 'block' }}>
                    Repetir hasta:
                    <input
                      type="date"
                      value={repeticionFin}
                      onChange={(e) => setRepeticionFin(e.target.value)}
                      style={{ ...estiloHora, marginLeft: '8px' }}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Tarea: fecha/hora OPCIONAL con casilla (lo que importa es la fecha límite) */}
      {tipo === 'Tarea' && !tendraSubtareas && (
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={tieneFechaHora}
              onChange={(e) => setTieneFechaHora(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            ¿Tiene fecha y hora definidas?
          </label>
          {!tieneFechaHora && (
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Sin fecha/hora, la tarea queda pendiente de agendar (útil si lo
              importante es la fecha límite, no un momento exacto).
            </div>
          )}
          {tieneFechaHora && (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginTop: '6px',
                }}
              >
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  style={estiloCampo}
                />
                <select
                  value={hora12}
                  onChange={(e) => setHora12(e.target.value)}
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
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  style={estiloHora}
                >
                  {opcionesMinutos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={ampm}
                  onChange={(e) => setAmpm(e.target.value)}
                  style={estiloHora}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>

              <div style={{ marginTop: '6px' }}>
                <label style={{ fontSize: '14px', marginRight: '8px' }}>
                  Repetir:
                </label>
                <select
                  value={repeticion}
                  onChange={(e) => {
                    setRepeticion(e.target.value);
                    if (e.target.value === 'Ninguna') {
                      setRepeticionTieneFin(false);
                      setRepeticionFin('');
                    }
                  }}
                  style={estiloCampo}
                >
                  <option value="Ninguna">Ninguna</option>
                  <option value="Diaria">Diaria</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensual">Mensual</option>
                </select>
                {repeticion !== 'Ninguna' && (
                  <div style={{ marginLeft: '4px', marginTop: '6px' }}>
                    <label
                      style={{
                        fontSize: '14px',
                        display: 'block',
                        marginBottom: '6px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={repeticionTieneFin}
                        onChange={(e) =>
                          setRepeticionTieneFin(e.target.checked)
                        }
                        style={{ marginRight: '8px' }}
                      />
                      ¿Termina en una fecha?
                    </label>
                    {repeticionTieneFin && (
                      <label style={{ fontSize: '14px', display: 'block' }}>
                        Repetir hasta:
                        <input
                          type="date"
                          value={repeticionFin}
                          onChange={(e) => setRepeticionFin(e.target.value)}
                          style={{ ...estiloHora, marginLeft: '8px' }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Preferencia de notificación — disponible para los 3 tipos, siempre opcional */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={quiereNotificacion}
            onChange={(e) => setQuiereNotificacion(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          ¿Quiero que me avise?
        </label>
        {quiereNotificacion && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: '6px',
            }}
          >
            <select
              value={canalNotificacion}
              onChange={(e) => setCanalNotificacion(e.target.value)}
              style={estiloCampo}
            >
              <option value="App">Notificación en la app</option>
              <option value="Correo">Correo</option>
              <option value="Push">Push al teléfono</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
            <label style={{ fontSize: '14px', marginRight: '8px' }}>
              Minutos antes:
            </label>
            <input
              type="number"
              value={minutosAntes}
              onChange={(e) => setMinutosAntes(e.target.value)}
              style={{ ...estiloHora, width: '70px' }}
            />
            <div
              style={{
                fontSize: '12px',
                color: '#888',
                width: '100%',
                marginTop: '4px',
              }}
            >
              Por ahora solo se guarda tu preferencia — el envío real llegará
              más adelante.
            </div>
          </div>
        )}
      </div>

      {/* Campos SOLO para Reunión */}
      {tipo === 'Reunión' && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#eef5ff',
            borderRadius: '6px',
            marginBottom: '10px',
          }}
        >
          <input
            type="text"
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Lugar (ej. Oficina, Zoom...)"
            style={{ ...estiloCampo, width: '100%', marginRight: 0 }}
          />
          <input
            type="text"
            value={participantes}
            onChange={(e) => setParticipantes(e.target.value)}
            placeholder="Participantes (separados por comas)"
            style={{ ...estiloCampo, width: '100%', marginRight: 0 }}
          />
        </div>
      )}

      {/* Campos SOLO para Tarea */}
      {tipo === 'Tarea' && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff6e5',
            borderRadius: '6px',
            marginBottom: '10px',
          }}
        >
          <label
            style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}
          >
            <input
              type="checkbox"
              checked={tieneFechaLimite}
              onChange={(e) => setTieneFechaLimite(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            ¿Tiene fecha límite?
          </label>
          {tieneFechaLimite && (
            <label
              style={{
                fontSize: '14px',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Fecha límite (deadline):
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                style={{ ...estiloHora, marginLeft: '8px' }}
              />
            </label>
          )}
          <label
            style={{ fontSize: '14px', display: 'block', marginBottom: '10px' }}
          >
            <input
              type="checkbox"
              checked={requiereConfirmacion}
              onChange={(e) => setRequiereConfirmacion(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Reagendar si no la marco como terminada
          </label>
          {!tendraSubtareas && (
            <label style={{ fontSize: '14px', display: 'block' }}>
              Tiempo estimado (minutos):
              <input
                type="number"
                value={tiempoEstimado}
                onChange={(e) => setTiempoEstimado(e.target.value)}
                style={{ ...estiloHora, marginLeft: '8px', width: '80px' }}
              />
              <span
                style={{ fontSize: '12px', color: '#888', marginLeft: '6px' }}
              >
                (30 min por defecto — el auto-llenado lo necesita para ubicarla
                en la agenda)
              </span>
            </label>
          )}
          {tendraSubtareas && (
            <div style={{ fontSize: '12px', color: '#888' }}>
              El tiempo se calculará automáticamente sumando las subtareas de
              arriba.
            </div>
          )}
        </div>
      )}

      {/* Título */}
      <input
        type="text"
        value={tarea}
        onChange={(e) => setTarea(e.target.value)}
        placeholder="Escribe un título..."
        style={{ ...estiloCampo, width: '100%', marginRight: 0 }}
      />

      {/* Notas (etiqueta contextual según el tipo) */}
      <label
        style={{
          fontSize: '13px',
          color: '#555',
          display: 'block',
          marginBottom: '4px',
        }}
      >
        {tipo === 'Reunión'
          ? 'Comentarios / lo que se trató (opcional):'
          : 'Notas (opcional):'}
      </label>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder={
          tipo === 'Reunión'
            ? 'Agenda, temas a tratar, o lo que se acordó...'
            : 'Notas (opcional)...'
        }
        style={{
          ...estiloCampo,
          width: '100%',
          marginRight: 0,
          minHeight: '60px',
          fontFamily: 'Arial',
        }}
      />

      {tipo === 'Tarea' && (
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={tendraSubtareas}
              onChange={(e) => setTendraSubtareas(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            ¿La voy a dividir en subtareas?
          </label>
          {tendraSubtareas && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f0f7f0',
                borderRadius: '6px',
                marginTop: '8px',
              }}
            >
              <div
                style={{ fontSize: '12px', color: '#777', marginBottom: '8px' }}
              >
                Como cada subtarea se agenda por separado, esta tarea no
                necesita fecha/hora/repetición propias.
              </div>

              {subtareasTemp.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  {subtareasTemp.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 0',
                      }}
                    >
                      <span
                        style={{
                          color: '#007bff',
                          marginRight: '6px',
                          fontSize: '13px',
                        }}
                      >
                        {i + 1}.
                      </span>
                      <span style={{ flex: 1, fontSize: '14px' }}>
                        {s.titulo} ({s.tiempo} min)
                      </span>
                      <button
                        onClick={() => quitarSubtareaTemp(i)}
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
                      fontSize: '12px',
                      color: '#555',
                      marginTop: '4px',
                    }}
                  >
                    Total: {subtareasTemp.reduce((s, x) => s + x.tiempo, 0)} min
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={nuevaSubtareaTempTitulo}
                  onChange={(e) => setNuevaSubtareaTempTitulo(e.target.value)}
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
                  value={nuevaSubtareaTempTiempo}
                  onChange={(e) => setNuevaSubtareaTempTiempo(e.target.value)}
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
                  onClick={agregarSubtareaTemp}
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
                onClick={() => setMostrarPegarListaTemp(!mostrarPegarListaTemp)}
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
                {mostrarPegarListaTemp ? 'Cerrar' : '📋 Pegar lista de tareas'}
              </button>

              {mostrarPegarListaTemp && (
                <div style={{ marginTop: '10px' }}>
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
                    value={textoListaTemp}
                    onChange={(e) => setTextoListaTemp(e.target.value)}
                    placeholder={
                      'Investigar proveedores\nComparar precios\nHacer pedido'
                    }
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      minHeight: '80px',
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
                    Minutos para cada una (obligatorio):
                  </label>
                  <input
                    type="number"
                    value={tiempoListaTemp}
                    onChange={(e) => setTiempoListaTemp(e.target.value)}
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
                    onClick={procesarListaTemp}
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
                    Agregar subtareas de la lista
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={crearTarea}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Crear
      </button>

      {mensaje && <p>{mensaje}</p>}

      {/* Gestión de categorías */}
      <div
        style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f0f4f8',
          borderRadius: '6px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Mis categorías (orden de prioridad)</h3>

        <div
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nueva categoría..."
            style={{
              padding: '8px',
              fontSize: '15px',
              marginRight: '10px',
              marginBottom: '8px',
            }}
          />
          <label style={{ fontSize: '14px', marginRight: '6px' }}>
            Posición:
          </label>
          <select
            value={nuevaPosicion}
            onChange={(e) => setNuevaPosicion(e.target.value)}
            style={{
              padding: '8px',
              fontSize: '15px',
              marginRight: '10px',
              marginBottom: '8px',
            }}
          >
            {opcionesPosicion.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            onClick={agregarCategoria}
            style={{
              padding: '8px 16px',
              fontSize: '15px',
              marginBottom: '8px',
            }}
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
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      marginRight: '8px',
                    }}
                  >
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
                          indice === categorias.length - 1
                            ? 'default'
                            : 'pointer',
                        backgroundColor:
                          indice === categorias.length - 1
                            ? '#f0f0f0'
                            : '#dde7f5',
                        color:
                          indice === categorias.length - 1 ? '#bbb' : '#333',
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
                    onClick={() =>
                      borrarCategoria(c.id, c.name, c.priority_order)
                    }
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

      {/* Lista de tareas */}
      <h2 style={{ marginTop: '30px' }}>Mis tareas ({tareas.length})</h2>
      {tareas.map((t, indiceTarea) => {
        const concluida = t.state === 'Hecho';
        const expandida = tareaExpandidaId === t.id;
        const numeroTarea = indiceTarea + 1;
        const subs = subtareasDe(t.id);
        const avance = avanceDe(t.id);
        const tiempoTotal = tiempoTotalDe(t.id);
        return (
          <div
            key={t.id}
            style={{
              backgroundColor: concluida ? '#eef7ee' : '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '10px',
              borderLeft: '4px solid ' + (concluida ? '#4caf50' : '#007bff'),
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '15px',
              }}
            >
              {/* Casilla concluir (solo Tareas) */}
              {t.type === 'Tarea' && (
                <input
                  type="checkbox"
                  checked={concluida}
                  onChange={() => alternarConcluida(t)}
                  style={{
                    marginRight: '12px',
                    marginTop: '3px',
                    width: '18px',
                    height: '18px',
                    flexShrink: 0,
                  }}
                />
              )}
              {/* Contenido: click para expandir */}
              <div
                onClick={() => alternarExpansion(t)}
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <strong
                  style={{
                    textDecoration: concluida ? 'line-through' : 'none',
                    color: concluida ? '#888' : '#000',
                  }}
                >
                  <span style={{ color: '#007bff', marginRight: '6px' }}>
                    {numeroTarea}.
                  </span>
                  {t.title}
                </strong>
                <br />
                <small style={{ color: concluida ? '#999' : '#555' }}>
                  {t.type} — {t.priority} — {t.state} —{' '}
                  {t.date_promised
                    ? formatearFechaHora(t.date_promised)
                    : 'Sin fecha definida'}
                </small>
                {subs.length > 0 && (
                  <div style={{ marginTop: '6px' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#555',
                        marginBottom: '3px',
                      }}
                    >
                      Avance: {avance}% (
                      {subs.filter((s) => s.state === 'Hecho').length}/
                      {subs.length} subtareas)
                      {tiempoTotal > 0
                        ? ' · ' + tiempoTotal + ' min estimados'
                        : ''}
                    </div>
                    <div
                      style={{
                        height: '6px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: avance + '%',
                          height: '100%',
                          backgroundColor: '#4caf50',
                        }}
                      />
                    </div>
                  </div>
                )}
                {t.type === 'Tarea' &&
                  subs.length === 0 &&
                  t.time_estimated && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#555',
                        marginTop: '4px',
                      }}
                    >
                      ⏱ {t.time_estimated} min estimados
                    </div>
                  )}
                {t.repetition && t.repetition !== 'Ninguna' && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#555',
                      marginTop: '4px',
                    }}
                  >
                    🔁 Se repite: {t.repetition}
                    {t.repetition_end
                      ? ' (hasta ' +
                        new Date(t.repetition_end).toLocaleDateString('es-MX') +
                        ')'
                      : ''}
                  </div>
                )}
                {t.type === 'Tarea' && t.deadline && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#c55',
                      marginTop: '4px',
                    }}
                  >
                    ⏰ Fecha límite:{' '}
                    {new Date(t.deadline).toLocaleDateString('es-MX')}
                  </div>
                )}
                {t.type === 'Reunión' && t.location && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#555',
                      marginTop: '4px',
                    }}
                  >
                    📍 {t.location}
                  </div>
                )}
                {t.notes && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#555',
                      marginTop: '4px',
                    }}
                  >
                    {t.type === 'Reunión' ? '💬' : '📝'} {t.notes}
                  </div>
                )}
                {t.notification_channels &&
                  t.notification_channels.length > 0 && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#888',
                        marginTop: '4px',
                      }}
                    >
                      🔔 {t.notification_channels[0]} ·{' '}
                      {t.reminder_minutes_before || 15} min antes
                    </div>
                  )}
              </div>
            </div>

            {/* Panel de edición expandible */}
            {expandida && (
              <div
                style={{
                  padding: '15px',
                  backgroundColor: '#fbfbfb',
                  borderTop: '1px solid #e5e5e5',
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
                  Título:
                </label>
                <input
                  type="text"
                  value={etTitulo}
                  onChange={(e) => setEtTitulo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                    marginBottom: '10px',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
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

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
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
                  <span style={{ marginRight: '6px', fontSize: '18px' }}>
                    :
                  </span>
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

                <label
                  style={{
                    fontSize: '13px',
                    color: '#555',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
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
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    minHeight: '50px',
                    fontFamily: 'Arial',
                    boxSizing: 'border-box',
                    marginBottom: '10px',
                  }}
                />

                {t.type === 'Tarea' && subs.length === 0 && (
                  <label
                    style={{
                      fontSize: '14px',
                      display: 'block',
                      marginBottom: '10px',
                    }}
                  >
                    Tiempo estimado (minutos):
                    <input
                      type="number"
                      value={etTiempoEstimado}
                      onChange={(e) => setEtTiempoEstimado(e.target.value)}
                      style={{
                        ...estiloHora,
                        marginLeft: '8px',
                        width: '80px',
                      }}
                    />
                  </label>
                )}
                {t.type === 'Tarea' && subs.length > 0 && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#888',
                      marginBottom: '10px',
                    }}
                  >
                    Tiempo tomado de la suma de sus {subs.length} subtarea(s):{' '}
                    {tiempoTotal} min
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
                        <span
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            marginRight: '6px',
                          }}
                        >
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
                              cursor:
                                i === subs.length - 1 ? 'default' : 'pointer',
                              backgroundColor:
                                i === subs.length - 1 ? '#f0f0f0' : '#dde7f5',
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
                          style={{
                            marginRight: '8px',
                            width: '16px',
                            height: '16px',
                          }}
                        />
                        <span
                          style={{
                            color: '#007bff',
                            marginRight: '6px',
                            fontSize: '13px',
                          }}
                        >
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
    </div>
  );
}
