// Lógica de la pantalla de detalle de un compromiso. Funciones puras, con
// pruebas. Reproducen lo que hacía el panel de edición dentro de App.js.
import { hora24 } from './compromiso.mjs';
import { prioridadDe, cambiosDePrioridad } from './prioridad.mjs';
import { explicarPuntaje } from './puntaje.mjs';

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

// ---------- Prioridad (bloques 1-A y 3-A) ----------

export const DELEGABLES = ['Solo yo', 'Parcial', 'Delegable'];

/** ¿La base ya tiene las columnas de prioridad? Antes de la migración no vienen en la fila. */
export function admitePrioridad(t) {
  return Boolean(t) && Object.prototype.hasOwnProperty.call(t, 'retomar_el');
}

/** Datos de prioridad editables en el detalle: los de calificación y los dos de 1-A. */
export function edicionPrioridad(t) {
  return { ...prioridadDe(t), retomarEl: t.retomar_el ? String(t.retomar_el).slice(0, 10) : '', delegable: t.delegable || '' };
}

/**
 * Cambios de prioridad a guardar. Con la tarea y la fecha del día, si algo que
 * cuenta para el puntaje cambió se actualiza también el puntaje de referencia.
 */
export function cambiosPrioridad(e, t, hoyISO) {
  return {
    ...cambiosDePrioridad(t, e, hoyISO),
    retomar_el: /^\d{4}-\d{2}-\d{2}$/.test(e.retomarEl || '') ? e.retomarEl : null,
    delegable: DELEGABLES.includes(e.delegable) ? e.delegable : null,
  };
}

/**
 * Datos de prioridad que solo se consultan, en lenguaje llano: el puntaje de
 * hoy y de dónde sale, y el grupo. Lista de { nombre, valor }.
 */
export function datosDePrioridad(t, hoyISO) {
  const datos = [];
  const p = explicarPuntaje(t, hoyISO);
  if (p.puntaje === null) datos.push({ nombre: 'Puntaje', valor: 'Sin puntaje: califica al menos un impacto' });
  else {
    datos.push({ nombre: 'Puntaje', valor: String(p.puntaje) });
    datos.push({ nombre: 'De dónde sale', valor: p.texto });
  }
  if (t.grupo) datos.push({ nombre: 'Grupo', valor: t.grupo });
  return datos;
}
