// Puntaje de prioridad de una tarea (bloque 3-A). Es la fórmula de la
// metodología de priorización del propietario, la misma de su Excel:
//
//   base    = (E+ × 30 + E− × 25 + Político × 20 + Personal × 25) ÷ 2    (0 a 100)
//   puntaje = base × urgencia, a un decimal
//   orden   = puntaje + desempate por esfuerzo y por si alguien lo espera
//
// Funciones puras: no leen ni guardan nada, y reciben la fecha del día, así
// que el puntaje se calcula al mostrar y cambia solo cuando pasa un día.
// Los pesos y los multiplicadores están fijos aquí (decisión #56, D1).

/** Peso de cada impacto, en puntos porcentuales. Perfil "Balanceado". Suman 100. */
export const PESOS = { impact_generar: 30, impact_proteger: 25, impact_politico: 20, impact_personal: 25 };

/** Catálogos, iguales a los de la base y a los del Excel. */
export const URGENCIAS = ['Fecha dura', 'Ventana', 'Sin fecha'];
export const ESFUERZOS = ['Rápido', 'Medio', 'Grande'];

// Multiplicadores de urgencia, en centésimas para hacer las cuentas con
// números enteros y redondear exacto.
const POR_CATEGORIA = { 'Fecha dura': 150, Ventana: 120, 'Sin fecha': 100 };
// Con fecha límite: [días que faltan como máximo, multiplicador]. Más de 30 días: 100.
const POR_DIAS = [[0, 200], [3, 180], [7, 150], [14, 130], [30, 115]];
const SIN_URGENCIA = 100;

// Desempate, en milésimas de punto.
const POR_ESFUERZO = { 'Rápido': 30, Medio: 20, Grande: 10 };
const SI_ME_ESPERAN = 3;

const vacio = (v) => v === null || v === undefined || v === '';

// Un impacto guardado: 0, 1 o 2; cualquier otra cosa es "sin llenar".
function impacto(v) {
  if (vacio(v)) return null;
  const n = Number(v);
  return n === 0 || n === 1 || n === 2 ? n : null;
}

// Día de una fecha de la base ("2026-11-20" o "2026-11-20T..."), como número
// de día corrido. null si no es una fecha.
function numeroDeDia(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor === null || valor === undefined ? '' : valor));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}

/** Días que faltan para la fecha límite (0 es hoy, negativo es vencida). null si no hay fecha. */
export function diasParaElLimite(t, hoyISO) {
  const limite = numeroDeDia(t && t.deadline);
  const hoy = numeroDeDia(hoyISO);
  return limite === null || hoy === null ? null : limite - hoy;
}

/** ¿La tarea tiene al menos un impacto lleno? Sin ninguno, no tiene puntaje. */
export function estaCalificada(t) {
  return Boolean(t) && Object.keys(PESOS).some((columna) => impacto(t[columna]) !== null);
}

// Suma ponderada de los impactos: de 0 a 200 (el doble de la base).
function sumaDeImpactos(t) {
  return Object.keys(PESOS).reduce((s, columna) => s + (impacto(t[columna]) || 0) * PESOS[columna], 0);
}

/** Base de impacto, de 0 a 100. Un impacto sin llenar cuenta como 0. null si no hay ninguno. */
export function baseDeImpacto(t) {
  return estaCalificada(t) ? sumaDeImpactos(t) / 2 : null;
}

// Multiplicador de urgencia en centésimas y de dónde sale.
function urgencia(t, hoyISO) {
  const dias = diasParaElLimite(t, hoyISO);
  if (dias !== null) {
    const tramo = POR_DIAS.find(([hasta]) => dias <= hasta);
    return { centesimas: tramo ? tramo[1] : SIN_URGENCIA, dias };
  }
  const categoria = t && Object.prototype.hasOwnProperty.call(POR_CATEGORIA, t.urgency_category) ? t.urgency_category : null;
  return { centesimas: categoria ? POR_CATEGORIA[categoria] : SIN_URGENCIA, dias: null, categoria };
}

/**
 * Multiplicador de urgencia. Con fecha límite manda la fecha (vencida o hoy
 * ×2.0; 3 días o menos ×1.8; 7 ×1.5; 14 ×1.3; 30 ×1.15; más ×1.0); sin ella,
 * la categoría (Fecha dura ×1.5, Ventana ×1.2, Sin fecha o vacío ×1.0).
 */
export function factorDeUrgencia(t, hoyISO) {
  return urgencia(t || {}, hoyISO).centesimas / 100;
}

// Puntaje en décimas (entero), o null. base × urgencia × 10 = suma × centésimas ÷ 20;
// la mitad exacta sube, como el REDONDEAR del Excel.
function decimasDePuntaje(t, hoyISO) {
  if (!estaCalificada(t)) return null;
  return Math.floor((sumaDeImpactos(t) * urgencia(t, hoyISO).centesimas + 10) / 20);
}

/** Puntaje de la tarea con la fecha del día, a un decimal. null si no tiene ningún impacto. */
export function puntajeDe(t, hoyISO) {
  const decimas = decimasDePuntaje(t, hoyISO);
  return decimas === null ? null : decimas / 10;
}

/**
 * Orden: el puntaje más un desempate mínimo. Rápido antes que Medio y Medio
 * antes que Grande (+0.03, +0.02, +0.01), y antes lo que alguien espera
 * (+0.003). null si la tarea no tiene puntaje.
 */
export function ordenDe(t, hoyISO) {
  const decimas = decimasDePuntaje(t, hoyISO);
  if (decimas === null) return null;
  const milesimas = decimas * 100 + (POR_ESFUERZO[t.esfuerzo] || 0) + (t.me_esperan === true ? SI_ME_ESPERAN : 0);
  return milesimas / 1000;
}

/** Los dos números que se guardan como referencia al guardar una tarea. */
export function referenciaDe(t, hoyISO) {
  return { puntaje: puntajeDe(t, hoyISO), orden_sugerido: ordenDe(t, hoyISO) };
}

const numero = (n) => String(Math.round(n * 100) / 100);

/**
 * De dónde sale el puntaje, en lenguaje llano:
 * { puntaje, base, factor, motivo, texto }. Sin impactos, puntaje es null.
 */
export function explicarPuntaje(t, hoyISO) {
  const puntaje = puntajeDe(t, hoyISO);
  if (puntaje === null) {
    return { puntaje: null, base: null, factor: null, motivo: '', texto: 'Sin puntaje: falta calificar al menos un impacto.' };
  }
  const u = urgencia(t, hoyISO);
  let motivo;
  if (u.dias !== null) {
    if (u.dias < 0) motivo = 'la fecha límite ya pasó';
    else if (u.dias === 0) motivo = 'la fecha límite es hoy';
    else if (u.dias === 1) motivo = 'falta 1 día para la fecha límite';
    else motivo = 'faltan ' + u.dias + ' días para la fecha límite';
  } else if (u.categoria) {
    motivo = u.categoria === 'Sin fecha' ? 'sin fecha' : u.categoria.toLowerCase();
  } else {
    motivo = 'sin urgencia definida';
  }
  const base = sumaDeImpactos(t) / 2;
  const factor = u.centesimas / 100;
  return { puntaje, base, factor, motivo, texto: 'Impacto ' + numero(base) + ' × urgencia ' + numero(factor) + ' (' + motivo + ')' };
}

// Número de una tarea que entró en la carga inicial ("excel:23" → 23).
function numeroDeOrigen(t) {
  const m = /^excel:(\d+)$/.exec(String(t.origen || ''));
  return m ? Number(m[1]) : Infinity;
}

const creada = (t) => String(t.created_at || t.date_created || '');

/**
 * Comparador para ordenar tareas calificadas: mayor orden primero. Si
 * empatan, la más antigua primero: entre las de la carga inicial, la de
 * menor número; después, por fecha de creación; al final, por nombre.
 * Las que no tienen puntaje van después de todas las que sí.
 */
export function compararPorOrden(hoyISO) {
  return (x, y) => {
    const ox = ordenDe(x, hoyISO);
    const oy = ordenDe(y, hoyISO);
    if (ox !== oy) {
      if (ox === null) return 1;
      if (oy === null) return -1;
      return oy - ox;
    }
    const nx = numeroDeOrigen(x);
    const ny = numeroDeOrigen(y);
    if (nx !== ny) return nx < ny ? -1 : 1;
    const porCreacion = creada(x).localeCompare(creada(y));
    if (porCreacion !== 0) return porCreacion;
    return String(x.title || '').localeCompare(String(y.title || ''));
  };
}
