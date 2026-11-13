// Lógica de la pantalla de detalle de un compromiso. Funciones puras, con
// pruebas. Reproducen lo que hacía el panel de edición dentro de App.js.
import { hora24 } from './compromiso.mjs';

const dos = (n) => String(n).padStart(2, '0');

/** Valores editables de un compromiso, tal como se muestran al abrirlo. */
export function edicionDe(t) {
  const e = {
    titulo: t.title || '',
    categoria: t.project_id || '',
    importancia: t.priority || 'Media',
    notas: t.notes || '',
    tiempoEstimado: t.time_estimated ? String(t.time_estimated) : '30',
    fecha: '',
    hora12: '9',
    minutos: '00',
    ampm: 'AM',
  };
  if (t.date_promised) {
    const d = new Date(t.date_promised);
    if (!isNaN(d)) {
      e.fecha = d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
      const h = d.getHours();
      e.hora12 = String(h % 12 === 0 ? 12 : h % 12);
      e.minutos = dos(Math.floor(d.getMinutes() / 5) * 5);
      e.ampm = h >= 12 ? 'PM' : 'AM';
    }
  }
  return e;
}

/**
 * Cambios a guardar. Si no se eligió fecha, la fecha y hora del compromiso se
 * quedan como estaban. El tiempo estimado solo se guarda en las tareas.
 */
export function armarActualizacion(t, e) {
  const cambios = {
    title: e.titulo,
    project_id: e.categoria || null,
    priority: e.importancia,
    date_promised: e.fecha ? e.fecha + 'T' + hora24(e.hora12, e.ampm) + ':' + e.minutos + ':00' : t.date_promised,
    notes: e.notas || null,
  };
  if (t.type === 'Tarea') {
    const tiempo = parseInt(e.tiempoEstimado, 10);
    cambios.time_estimated = !isNaN(tiempo) && tiempo > 0 ? tiempo : 30;
  }
  return cambios;
}

/** Minutos válidos para una subtarea, o null si no lo son. */
export function minutosValidos(valor) {
  const n = parseInt(valor, 10);
  return !isNaN(n) && n > 0 ? n : null;
}

/** Vecina con la que se intercambia el orden al subir o bajar una subtarea. */
export function vecinaDe(subtareas, sub, direccion) {
  const posicion = subtareas.findIndex((s) => s.id === sub.id);
  const destino = direccion === 'subir' ? posicion - 1 : posicion + 1;
  if (posicion < 0 || destino < 0 || destino >= subtareas.length) return null;
  return subtareas[destino];
}

/** Los siete días (lunes a domingo) de la semana que contiene a `hoyISO`. */
export function semanaDe(hoyISO) {
  const [a, m, d] = hoyISO.split('-').map(Number);
  const hoy = new Date(a, m - 1, d);
  const desdeLunes = (hoy.getDay() + 6) % 7; // lunes = 0
  const letras = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return letras.map((letra, i) => {
    const f = new Date(a, m - 1, d - desdeLunes + i);
    const iso = f.getFullYear() + '-' + dos(f.getMonth() + 1) + '-' + dos(f.getDate());
    return { iso, letra, numero: f.getDate(), esHoy: iso === hoyISO, pasado: iso < hoyISO };
  });
}

// ---------- Prioridad (bloque 1-A) ----------

export const DELEGABLES = ['Solo yo', 'Parcial', 'Delegable'];

/** ¿La base ya tiene las columnas de prioridad? Antes de la migración no vienen en la fila. */
export function admitePrioridad(t) {
  return Boolean(t) && Object.prototype.hasOwnProperty.call(t, 'retomar_el');
}

/** Los dos datos de prioridad que se editan en el detalle. */
export function edicionPrioridad(t) {
  return { retomarEl: t.retomar_el ? String(t.retomar_el).slice(0, 10) : '', delegable: t.delegable || '' };
}

/** Cambios de prioridad a guardar. */
export function cambiosPrioridad(e) {
  return {
    retomar_el: /^\d{4}-\d{2}-\d{2}$/.test(e.retomarEl || '') ? e.retomarEl : null,
    delegable: DELEGABLES.includes(e.delegable) ? e.delegable : null,
  };
}

/**
 * Datos de prioridad que solo se consultan, en lenguaje llano. Devuelve una
 * lista de { nombre, valor }; vacía si la tarea no tiene ninguno.
 */
export function datosDePrioridad(t) {
  const datos = [];
  const numero = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const puntaje = numero(t.puntaje);
  if (puntaje !== null && Number.isFinite(puntaje)) datos.push({ nombre: 'Puntaje', valor: String(Math.round(puntaje * 10) / 10) });
  const impactos = [['Generar', t.impact_generar], ['Proteger', t.impact_proteger], ['Político', t.impact_politico], ['Personal', t.impact_personal]]
    .filter(([, v]) => numero(v) !== null)
    .map(([n, v]) => n + ' ' + Number(v));
  if (impactos.length > 0) datos.push({ nombre: 'Impacto (0 a 2)', valor: impactos.join(' · ') });
  if (t.urgency_category) datos.push({ nombre: 'Urgencia', valor: t.urgency_category });
  if (t.esfuerzo) datos.push({ nombre: 'Esfuerzo', valor: t.esfuerzo });
  if (t.me_esperan === true || t.me_esperan === false) datos.push({ nombre: '¿Te esperan?', valor: t.me_esperan ? 'Sí' : 'No' });
  if (t.grupo) datos.push({ nombre: 'Grupo', valor: t.grupo });
  return datos;
}
