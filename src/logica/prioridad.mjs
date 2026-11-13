// Datos de prioridad de una tarea tal como se editan en pantalla (bloque 3-A):
// del formulario a las columnas de la base y de vuelta. Funciones puras.
// El cálculo del puntaje vive en puntaje.mjs.
import { URGENCIAS, ESFUERZOS, referenciaDe } from './puntaje.mjs';

/** Opciones de un impacto: la calificación va de 0 (nulo) a 2 (alto). */
export const IMPACTOS = [
  { valor: '', texto: 'Sin calificar' },
  { valor: '0', texto: 'Nulo' },
  { valor: '1', texto: 'Moderado' },
  { valor: '2', texto: 'Alto' },
];

/** Los cuatro impactos: clave del formulario, columna de la base y cómo se nombran. */
export const CAMPOS_IMPACTO = [
  { clave: 'generar', columna: 'impact_generar', nombre: 'Ganar dinero', ayuda: 'Ingresos o ahorro (E+ en tu Excel)' },
  { clave: 'proteger', columna: 'impact_proteger', nombre: 'Evitar pérdidas', ayuda: 'Multas, riesgos o problemas que esto previene (E−)' },
  { clave: 'politico', columna: 'impact_politico', nombre: 'Imagen y relaciones', ayuda: 'Jefes, clientes, reputación, posición (P, Político)' },
  { clave: 'personal', columna: 'impact_personal', nombre: 'Beneficio personal', ayuda: 'Salud, familia, bienestar (Personal)' },
];

export { URGENCIAS, ESFUERZOS };

/** Opciones de "¿te esperan?": vacío es "sin definir". */
export const ME_ESPERAN = [
  { valor: '', texto: 'Sin definir' },
  { valor: 'si', texto: 'Sí' },
  { valor: 'no', texto: 'No' },
];

const vacio = (v) => v === null || v === undefined || v === '';

/** Datos de prioridad vacíos, como los de una tarea nueva. */
export function prioridadVacia() {
  return { generar: '', proteger: '', politico: '', personal: '', urgencia: '', fechaLimite: '', esfuerzo: '', meEsperan: '', avance: '' };
}

/** Datos de prioridad de una tarea de la base, tal como se muestran al abrirla. */
export function prioridadDe(t) {
  const x = t || {};
  const e = prioridadVacia();
  for (const c of CAMPOS_IMPACTO) {
    const n = vacio(x[c.columna]) ? NaN : Number(x[c.columna]);
    e[c.clave] = n === 0 || n === 1 || n === 2 ? String(n) : '';
  }
  e.urgencia = URGENCIAS.includes(x.urgency_category) ? x.urgency_category : '';
  e.fechaLimite = x.deadline ? String(x.deadline).slice(0, 10) : '';
  e.esfuerzo = ESFUERZOS.includes(x.esfuerzo) ? x.esfuerzo : '';
  e.meEsperan = x.me_esperan === true ? 'si' : x.me_esperan === false ? 'no' : '';
  e.avance = vacio(x.progress) ? '' : String(x.progress);
  return e;
}

/**
 * Columnas de la base que salen de los datos de prioridad. Lo vacío o fuera de
 * catálogo se guarda como sin dato (null); el avance se limita a 0-100.
 */
export function columnasDePrioridad(e) {
  const x = e || {};
  const columnas = {};
  for (const c of CAMPOS_IMPACTO) columnas[c.columna] = ['0', '1', '2'].includes(String(x[c.clave])) ? Number(x[c.clave]) : null;
  columnas.urgency_category = URGENCIAS.includes(x.urgencia) ? x.urgencia : null;
  columnas.deadline = /^\d{4}-\d{2}-\d{2}$/.test(x.fechaLimite || '') ? x.fechaLimite : null;
  columnas.esfuerzo = ESFUERZOS.includes(x.esfuerzo) ? x.esfuerzo : null;
  columnas.me_esperan = x.meEsperan === 'si' ? true : x.meEsperan === 'no' ? false : null;
  const avance = parseInt(x.avance, 10);
  columnas.progress = Number.isFinite(avance) ? Math.min(100, Math.max(0, avance)) : null;
  return columnas;
}

/** La tarea como quedaría con esos datos de prioridad (para calcular su puntaje al editar). */
export function tareaConPrioridad(t, e) {
  return { ...t, ...columnasDePrioridad(e) };
}

/** ¿Los datos de prioridad editados son distintos de los que tiene la tarea? */
export function cambioDePrioridad(t, e) {
  return JSON.stringify(columnasDePrioridad(prioridadDe(t))) !== JSON.stringify(columnasDePrioridad(e));
}

// Las columnas que entran a la fórmula del puntaje (el avance no).
const CUENTAN = ['impact_generar', 'impact_proteger', 'impact_politico', 'impact_personal', 'urgency_category', 'deadline', 'esfuerzo', 'me_esperan'];

/** ¿Cambió algo que cuenta para el puntaje? */
export function cambiaElPuntaje(t, e) {
  const antes = columnasDePrioridad(prioridadDe(t));
  const despues = columnasDePrioridad(e);
  return CUENTAN.some((c) => antes[c] !== despues[c]);
}

/**
 * Columnas a guardar. Si algo que cuenta para el puntaje cambió, incluye
 * también el puntaje y el orden de referencia (el orden que se ve siempre se
 * calcula al mostrar); si no cambió nada, no los toca.
 */
export function cambiosDePrioridad(t, e, hoyISO) {
  const columnas = columnasDePrioridad(e);
  if (t && cambiaElPuntaje(t, e)) Object.assign(columnas, referenciaDe({ ...t, ...columnas }, hoyISO));
  return columnas;
}

/** Columnas de prioridad que se insertan al crear una tarea: solo las que se llenaron. */
export function columnasParaCrear(e, hoyISO) {
  const columnas = columnasDePrioridad(e);
  const llenas = {};
  for (const [columna, valor] of Object.entries(columnas)) if (valor !== null) llenas[columna] = valor;
  if (CAMPOS_IMPACTO.some((c) => columnas[c.columna] !== null)) Object.assign(llenas, referenciaDe(columnas, hoyISO));
  return llenas;
}
