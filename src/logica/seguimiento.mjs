// Reglas del bloque 3-A2: tareas de esfuerzo "Grande" que necesitan un plan
// (subtareas) y tareas delegadas que pasan a seguimiento. Funciones puras, sin
// leer ni guardar datos. Es un archivo "hoja": no importa a los demás de la
// lógica, para que agenda.mjs y semana.mjs puedan usarlo.

/** Subtareas que hacen falta para que una tarea Grande esté completa. */
export const SUBTAREAS_MINIMAS = 2;
/** Días de plazo que se proponen para la primera revisión de una tarea delegada. */
export const DIAS_PARA_REVISAR = 7;
/** Longitud máxima del nombre de a quién se delega (igual que la columna de la base). */
export const MAXIMO_NOMBRE = 80;

export const LEYENDA_INCOMPLETA = 'Incompleta: falta el plan de trabajo';
export const AYUDA_INCOMPLETA = 'Se guarda así para no perderla. Cuando tengas el plan, pega sus hitos como subtareas (al menos ' + SUBTAREAS_MINIMAS + '); mientras tanto no se sugiere para hoy.';

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

// ---------- fechas (AAAA-MM-DD), sin depender de la zona horaria ----------

/** ¿Es una fecha real con formato AAAA-MM-DD? */
export function esFechaISO(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || ''));
  if (!m) return false;
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return f.getUTCFullYear() === Number(m[1]) && f.getUTCMonth() === Number(m[2]) - 1 && f.getUTCDate() === Number(m[3]);
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDiasISO(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Fecha de revisión que se propone al delegar: dentro de 7 días. */
export function revisionPropuesta(hoyISO) {
  return sumarDiasISO(hoyISO, DIAS_PARA_REVISAR);
}

// ---------- esfuerzo Grande sin plan ----------

/** Cuántas subtareas tiene cada tarea: Map(id de tarea → cantidad). */
export function conteoDeSubtareas(subtareas) {
  const conteo = new Map();
  for (const s of subtareas || []) conteo.set(s.task_id, (conteo.get(s.task_id) || 0) + 1);
  return conteo;
}

/**
 * Una tarea abierta de esfuerzo Grande con menos de 2 subtareas está
 * incompleta: se puede guardar (para no perderla), pero no se sugiere hasta
 * tener su plan. No se guarda como dato: se deduce de lo que tiene.
 */
export function estaIncompleta(tarea, cuantasSubtareas) {
  return Boolean(tarea) && tarea.type === 'Tarea' && tarea.state !== 'Hecho' && tarea.esfuerzo === 'Grande' && (Number(cuantasSubtareas) || 0) < SUBTAREAS_MINIMAS;
}

// ---------- delegación ----------

/** ¿La base ya tiene las columnas de delegación? Antes de la migración no vienen en la fila. */
export function admiteDelegacion(tarea) {
  return Boolean(tarea) && Object.prototype.hasOwnProperty.call(tarea, 'delegada_a');
}

/** Una tarea abierta con alguien a quien se le delegó. */
export function estaDelegada(tarea) {
  return Boolean(tarea) && tarea.type === 'Tarea' && tarea.state !== 'Hecho' && texto(tarea.delegada_a) !== '';
}

/**
 * Valida lo que se pide al delegar y devuelve las columnas a guardar. A quién
 * es obligatorio y la revisión también: hoy o después.
 */
export function validarDelegacion({ aQuien, revisarEl } = {}, hoyISO) {
  const nombre = texto(aQuien);
  if (!nombre) return { error: 'Escribe a quién se la delegas.', cambios: null };
  if (nombre.length > MAXIMO_NOMBRE) return { error: 'El nombre es demasiado largo (máximo ' + MAXIMO_NOMBRE + ' caracteres).', cambios: null };
  if (!esFechaISO(revisarEl) || revisarEl < hoyISO) return { error: 'Elige el día en que revisarás cómo va (hoy o después).', cambios: null };
  return { error: null, cambios: { delegada_a: nombre, delegada_el: hoyISO, revisar_el: revisarEl } };
}

/** Cambio de la fecha de revisión de una tarea ya delegada. */
export function cambioDeRevision(revisarEl, hoyISO) {
  if (!esFechaISO(revisarEl) || revisarEl < hoyISO) return { error: 'Elige el día en que revisarás cómo va (hoy o después).', cambios: null };
  return { error: null, cambios: { revisar_el: revisarEl } };
}

/** "Retomarla yo": la tarea vuelve a ser propia, sin delegado ni revisión. */
export function cambiosDeRetomar() {
  return { delegada_a: null, delegada_el: null, revisar_el: null };
}

/** "Ya la entregaron": la tarea queda hecha y se cierra su seguimiento. Se conserva a quién se delegó. */
export function cambiosDeEntregada(ahoraISO) {
  return { state: 'Hecho', date_completed: ahoraISO, revisar_el: null };
}

/** Nombres a quienes ya se ha delegado, sin repetir y en orden alfabético (para sugerir al escribir). */
export function delegadosConocidos(tareas) {
  const vistos = new Map();
  for (const t of tareas || []) {
    const n = texto(t && t.delegada_a);
    if (n && !vistos.has(n.toLowerCase())) vistos.set(n.toLowerCase(), n);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b));
}

// ---------- la siguiente subtarea (D6) ----------

/**
 * La siguiente subtarea pendiente de una tarea: la primera, en el orden en que
 * se acomodaron, que no esté hecha. null si no tiene o ya están todas hechas.
 */
export function proximaSubtarea(subtareas) {
  const pendientes = (subtareas || []).filter((s) => s && s.state !== 'Hecho');
  if (pendientes.length === 0) return null;
  return [...pendientes].sort((x, y) => (Number(x.orden) || 0) - (Number(y.orden) || 0))[0];
}
