// Lógica de la captura de un compromiso. Funciones puras, con pruebas.
// Reproducen exactamente lo que hacía el formulario anterior dentro de App.js.

const dos = (n) => String(n).padStart(2, '0');

export const TIPOS = ['Reunión', 'Tarea', 'Recordatorio'];
export const REPETICIONES = ['Ninguna', 'Diaria', 'Semanal', 'Mensual'];
export const IMPORTANCIAS = [
  { valor: 'Muy alta', texto: 'Muy alta — crítico' },
  { valor: 'Alta', texto: 'Alta — importante' },
  { valor: 'Media', texto: 'Media — normal' },
  { valor: 'Baja', texto: 'Baja — puede esperar' },
  { valor: 'Muy baja', texto: 'Muy baja — cuando haya tiempo' },
];
export const CANALES = [
  { valor: 'App', texto: 'Notificación en la app' },
  { valor: 'Correo', texto: 'Correo' },
  { valor: 'Push', texto: 'Push al teléfono' },
  { valor: 'WhatsApp', texto: 'WhatsApp' },
];
export const HORAS = Array.from({ length: 12 }, (_, i) => String(i + 1));
export const MINUTOS = Array.from({ length: 12 }, (_, i) => dos(i * 5));

/** Estado inicial del formulario. `hoyISO` es la fecha local AAAA-MM-DD. */
export function formularioVacio(hoyISO) {
  return {
    titulo: '',
    tipo: 'Tarea',
    fecha: hoyISO,
    hora12: '9',
    minutos: '00',
    ampm: 'AM',
    categoria: '',
    importancia: 'Media',
    lugar: '',
    participantes: '',
    notas: '',
    repeticion: 'Ninguna',
    repeticionTieneFin: false,
    repeticionFin: '',
    tieneFechaLimite: false,
    fechaLimite: '',
    requiereConfirmacion: false,
    tiempoEstimado: '30',
    quiereNotificacion: false,
    canalNotificacion: 'App',
    minutosAntes: '15',
    tendraSubtareas: false,
    tieneFechaHora: false,
    subtareas: [],
    nuevaSubtareaTitulo: '',
    nuevaSubtareaTiempo: '30',
    textoLista: '',
    tiempoLista: '30',
  };
}

/** Hora de 12 horas con AM/PM a hora de 24 ("00" a "23"). */
export function hora24(hora12, ampm) {
  let h = parseInt(hora12, 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return dos(h);
}

const minutosOTreinta = (valor) => {
  const n = parseInt(valor, 10);
  return !isNaN(n) && n > 0 ? n : 30;
};

/** Renglones no vacíos de un texto pegado. */
export function lineasDe(texto) {
  return String(texto || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** ¿Se muestran fecha, hora y repetición para este formulario? */
export function llevaFechaHora(f) {
  if (f.tipo !== 'Tarea') return true;
  return !f.tendraSubtareas && f.tieneFechaHora;
}

/**
 * Convierte el formulario en lo que se guarda. Devuelve:
 *  - error: texto si falta algo y no debe guardarse;
 *  - datos: la fila para la tabla de compromisos;
 *  - subtareas: lista de { titulo, tiempo } a crear después;
 *  - confirmarRepeticion: true si hay que pedir confirmación antes de guardar.
 */
export function armarCompromiso(f) {
  if (!String(f.titulo || '').trim()) return { error: 'Escribe un título primero' };

  const esContenedor = f.tipo === 'Tarea' && f.tendraSubtareas;

  // Si escribió una subtarea o pegó una lista y no pulsó "Agregar", se recoge
  // aquí para no perderla.
  let subtareas = [];
  if (esContenedor) {
    subtareas = [...(f.subtareas || [])];
    if (String(f.nuevaSubtareaTitulo || '').trim()) {
      subtareas.push({ titulo: f.nuevaSubtareaTitulo.trim(), tiempo: minutosOTreinta(f.nuevaSubtareaTiempo) });
    }
    const tiempoLista = minutosOTreinta(f.tiempoLista);
    subtareas.push(...lineasDe(f.textoLista).map((l) => ({ titulo: l, tiempo: tiempoLista })));
    if (subtareas.length === 0) {
      return { error: 'Agrega al menos una subtarea, o desmarca la casilla de dividir.' };
    }
  }

  const confirmarRepeticion = !esContenedor && f.repeticion !== 'Ninguna' && !f.repeticionTieneFin;
  const sinFechaHora = f.tipo === 'Tarea' && (esContenedor || !f.tieneFechaHora);
  const fechaHora = sinFechaHora ? null : f.fecha + 'T' + hora24(f.hora12, f.ampm) + ':' + f.minutos + ':00';

  const datos = {
    title: f.titulo,
    type: f.tipo,
    date_promised: fechaHora,
    project_id: f.categoria || null,
    priority: f.importancia,
    state: 'Pendiente',
    notes: f.notas || null,
    repetition: esContenedor ? 'Ninguna' : f.repeticion,
    repetition_end:
      !esContenedor && f.repeticion !== 'Ninguna' && f.repeticionTieneFin && f.repeticionFin ? f.repeticionFin : null,
    notification_channels: f.quiereNotificacion ? [f.canalNotificacion] : null,
    reminder_minutes_before: f.quiereNotificacion ? parseInt(f.minutosAntes, 10) || 15 : null,
  };

  if (f.tipo === 'Reunión') {
    datos.location = f.lugar || null;
    datos.participantes = f.participantes ? f.participantes.split(',').map((p) => p.trim()) : null;
    datos.time_estimated = minutosOTreinta(f.tiempoEstimado);
  }

  if (f.tipo === 'Tarea') {
    datos.deadline = f.tieneFechaLimite && f.fechaLimite ? f.fechaLimite : null;
    datos.requires_confirmation = f.requiereConfirmacion;
    datos.time_estimated = minutosOTreinta(f.tiempoEstimado);
  }

  return { error: null, datos, subtareas, confirmarRepeticion };
}

/**
 * Cambios que la respuesta de la IA hace en el formulario. Solo toca los
 * campos que la IA sí entendió; lo demás queda como estaba.
 */
export function aplicarInterpretacion(datosIA, opciones = {}) {
  const d = datosIA || {};
  const cambios = {};
  if (d.titulo) cambios.titulo = d.titulo;
  if (d.tipo) cambios.tipo = d.tipo;
  if (d.importancia) cambios.importancia = d.importancia;
  if (d.fecha) {
    cambios.fecha = d.fecha;
    if (d.tipo === 'Tarea') cambios.tieneFechaHora = true;
  }
  if (d.hora12) cambios.hora12 = String(d.hora12);
  if (d.minutos !== null && d.minutos !== undefined) cambios.minutos = dos(d.minutos);
  if (d.ampm) cambios.ampm = d.ampm;
  if (d.duracionMinutos) cambios.tiempoEstimado = String(d.duracionMinutos);
  const advertencias = Array.isArray(d.advertencias) ? d.advertencias.filter((a) => typeof a === 'string' && a) : [];

  // Datos ampliados (bloque IA-2). Llegan aparte, en "mas", ya validados por
  // el servidor. `abrirMas` indica que se llenó o quedó en duda algo que vive
  // dentro de "Más opciones", para mostrarlo antes de crear.
  const mas = d.mas && typeof d.mas === 'object' && !Array.isArray(d.mas) ? d.mas : {};
  let abrirMas = false;

  const subtareas = Array.isArray(mas.subtareas) ? mas.subtareas.filter((s) => s && typeof s.titulo === 'string' && s.titulo.trim()) : [];
  if (subtareas.length > 0) {
    cambios.tendraSubtareas = true;
    cambios.subtareas = subtareas.map((s) => ({ titulo: s.titulo.trim(), tiempo: Number.isInteger(s.minutos) && s.minutos > 0 ? s.minutos : 30 }));
    abrirMas = true;
  }
  if (typeof mas.lugar === 'string' && mas.lugar) {
    cambios.lugar = mas.lugar;
    abrirMas = true;
  }
  if (Array.isArray(mas.participantes) && mas.participantes.length > 0) {
    cambios.participantes = mas.participantes.filter((p) => typeof p === 'string' && p).join(', ');
    abrirMas = true;
  }
  if (typeof mas.fechaLimite === 'string' && mas.fechaLimite) {
    cambios.tieneFechaLimite = true;
    cambios.fechaLimite = mas.fechaLimite;
    abrirMas = true;
  }
  if (REPETICIONES.includes(mas.repeticion) && mas.repeticion !== 'Ninguna') {
    cambios.repeticion = mas.repeticion;
    if (typeof mas.repeticionFin === 'string' && mas.repeticionFin) {
      cambios.repeticionTieneFin = true;
      cambios.repeticionFin = mas.repeticionFin;
    }
  }
  if (Number.isInteger(mas.avisoMinutosAntes) && mas.avisoMinutosAntes >= 0) {
    cambios.quiereNotificacion = true;
    cambios.minutosAntes = String(mas.avisoMinutosAntes);
  }
  if (typeof mas.notas === 'string' && mas.notas) {
    cambios.notas = mas.notas;
    abrirMas = true;
  }
  if (typeof mas.categoria === 'string' && mas.categoria) {
    const hallada = (opciones.categorias || []).find((c) => c && c.name === mas.categoria);
    if (hallada) cambios.categoria = hallada.id;
  }
  if (DATOS_EN_MAS_OPCIONES.some((dato) => esDudoso(advertencias, dato))) abrirMas = true;

  return { cambios, advertencias, abrirMas };
}

/**
 * Formulario que resulta de una interpretación. Parte siempre de un formulario
 * vacío: cada dictado describe un compromiso nuevo, así que nada de lo que
 * dejó una interpretación anterior (subtareas, lugar, fecha...) se arrastra.
 */
export function formularioInterpretado(hoyISO, datosIA, opciones = {}) {
  const { cambios, advertencias, abrirMas } = aplicarInterpretacion(datosIA, opciones);
  const formulario = { ...formularioVacio(hoyISO), ...cambios };
  // Captura desde la columna de un día: si el dictado no dijo fecha, se queda
  // la de la columna.
  if (opciones.fechaInicial && !cambios.fecha) {
    formulario.fecha = opciones.fechaInicial;
    formulario.tieneFechaHora = true;
  }
  return { formulario, advertencias, abrirMas };
}

/**
 * Formulario para capturar desde un día concreto (la columna de un día en la
 * vista de computadora): el compromiso nace con esa fecha. Sin día, es el
 * formulario vacío de siempre.
 */
export function formularioDelDia(hoyISO, fechaISO) {
  if (!fechaISO) return formularioVacio(hoyISO);
  return { ...formularioVacio(fechaISO), tieneFechaHora: true };
}

// Datos que viven dentro de "Más opciones" en la captura.
const DATOS_EN_MAS_OPCIONES = ['subtareas', 'lugar', 'participantes', 'fecha límite', 'notas'];

/** Mensaje para el usuario según la respuesta del servidor de IA. */
export function mensajeDeRespuesta(estado) {
  if (estado === 401) return 'Tu sesión expiró. Vuelve a entrar para usar la IA.';
  if (estado === 413) return 'El texto es demasiado largo (máximo 1,000 caracteres).';
  if (estado === 429) return 'Alcanzaste el límite de interpretaciones por hora. Intenta más tarde.';
  return 'No se pudo interpretar. Intenta de nuevo.';
}

/** ¿La advertencia de la IA se refiere a este dato? ("hora", "fecha", "duración"...) */
export function esDudoso(advertencias, dato) {
  const limpio = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (advertencias || []).some((a) => limpio(a) === limpio(dato));
}
