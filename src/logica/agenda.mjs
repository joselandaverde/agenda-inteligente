// Lógica de presentación de la agenda. Funciones puras: no leen ni escriben
// datos, solo ordenan y resumen lo que ya existe. Se prueban con node --test.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

import { compararPorOrden, estaCalificada } from './puntaje.mjs';

/** Cuántas tareas sugeridas muestra Hoy: las cuatro de mayor puntaje (decisión #56). */
export const SUGERIDAS_EN_HOY = 4;

const dos = (n) => String(n).padStart(2, '0');

/** Fecha local de un Date como AAAA-MM-DD. */
export function fechaLocalISO(d = new Date()) {
  return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
}

// La base guarda fecha y hora sin zona ("2026-11-12T10:00:00"): es hora local
// tal cual. Si llegara con zona (Z o +hh:mm), se convierte a la hora local.
function aFechaLocal(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor) ? null : valor;
  const texto = String(valor);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(texto);
  if (!m) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(texto)) {
    const d = new Date(texto);
    return isNaN(d) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
}

/** Día (AAAA-MM-DD) de un valor de fecha de la base, o null. */
export function diaDe(valor) {
  const d = aFechaLocal(valor);
  return d ? fechaLocalISO(d) : null;
}

/** Hora en formato de 12 horas: "10:00 a. m.". Cadena vacía si no hay fecha. */
export function horaCorta(valor) {
  const d = aFechaLocal(valor);
  if (!d) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + dos(d.getMinutes()) + (h >= 12 ? ' p. m.' : ' a. m.');
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return fechaLocalISO(new Date(a, m - 1, d + n));
}

/** "miércoles 11 de noviembre". */
export function fechaLarga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return DIAS[f.getDay()] + ' ' + d + ' de ' + MESES[m - 1];
}

/** Partes para el encabezado de un día: número, nombre y si es hoy, mañana o ayer. */
export function partesDia(iso, hoyISO) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  let relativo = '';
  if (iso === hoyISO) relativo = 'hoy';
  else if (iso === sumarDias(hoyISO, 1)) relativo = 'mañana';
  else if (iso === sumarDias(hoyISO, -1)) relativo = 'ayer';
  return { numero: d, nombre: DIAS[f.getDay()], mes: MESES[m - 1], relativo };
}

/** Duración en minutos como "h:mm". Cadena vacía si no hay duración. */
export function formatoDuracion(minutos) {
  const n = Math.round(Number(minutos));
  if (!Number.isFinite(n) || n <= 0) return '';
  return Math.floor(n / 60) + ':' + dos(n % 60);
}

/**
 * Minutos que ocupa un compromiso. Una tarea con subtareas dura la suma de
 * ellas; un recordatorio no ocupa tiempo.
 */
export function minutosDe(tarea, subtareas = []) {
  if (!tarea || tarea.type === 'Recordatorio') return 0;
  if (tarea.type === 'Tarea' && subtareas.length > 0) {
    return subtareas.reduce((s, x) => s + (Number(x.time_estimated) || 0), 0);
  }
  return Number(tarea.time_estimated) || 0;
}

/** Clase de color según la importancia (5 niveles del catálogo). */
export function nivelImportancia(importancia) {
  const niveles = { 'Muy alta': 1, Alta: 2, Media: 3, Baja: 4, 'Muy baja': 5 };
  return niveles[importancia] || 3;
}

const estaHecha = (t) => t.state === 'Hecho';

/**
 * Día en que se muestra un compromiso: el de su fecha y hora; si es una tarea
 * sin fecha pero con fecha límite, el día de su límite.
 */
export function diaEfectivo(t) {
  if (!t) return null;
  return diaDe(t.date_promised) || (t.type === 'Tarea' ? diaDe(t.deadline) : null);
}

// Dentro de un día: primero lo que tiene hora, por hora; luego lo demás por
// importancia; lo hecho al final.
function ordenarDia(lista) {
  const conHora = (t) => (t.date_promised ? 0 : 1);
  return [...lista].sort((x, y) => {
    if (estaHecha(x) !== estaHecha(y)) return estaHecha(x) ? 1 : -1;
    if (conHora(x) !== conHora(y)) return conHora(x) - conHora(y);
    if (conHora(x) === 0) return String(x.date_promised).localeCompare(String(y.date_promised));
    return nivelImportancia(x.priority) - nivelImportancia(y.priority);
  });
}

/**
 * Reparte los compromisos en grupos. Lo hecho se queda en el día de hoy solo
 * si su fecha es hoy o se completó hoy; lo demás hecho va al grupo "hechos".
 */
export function repartir(tareas, hoyISO) {
  const vencidos = [];
  const porDia = new Map();
  const sinFecha = [];
  const hechos = [];
  const agregar = (dia, t) => {
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(t);
  };

  for (const t of tareas || []) {
    const dia = diaEfectivo(t);
    if (estaHecha(t)) {
      if (dia === hoyISO || diaDe(t.date_completed) === hoyISO) agregar(hoyISO, t);
      else hechos.push(t);
    } else if (!dia) sinFecha.push(t);
    else if (dia < hoyISO) vencidos.push(t);
    else agregar(dia, t);
  }

  const dias = [...porDia.keys()].sort().map((clave) => ({ clave, tareas: ordenarDia(porDia.get(clave)) }));
  return {
    vencidos: [...vencidos].sort((x, y) => String(diaEfectivo(x)).localeCompare(String(diaEfectivo(y)))),
    dias,
    sinFecha: [...sinFecha].sort((x, y) => nivelImportancia(x.priority) - nivelImportancia(y.priority)),
    hechos,
  };
}

/** Grupos de la pantalla Hoy: lo vencido y lo de hoy. */
export function gruposDeHoy(tareas, hoyISO) {
  const r = repartir(tareas, hoyISO);
  const grupos = [];
  if (r.vencidos.length) grupos.push({ clave: 'vencidos', tipo: 'vencidos', tareas: r.vencidos });
  const hoy = r.dias.find((d) => d.clave === hoyISO);
  if (hoy) grupos.push({ clave: hoyISO, tipo: 'dia', tareas: hoy.tareas });
  return grupos;
}

/** Grupos de la pantalla Próximos: vencido, cada día desde hoy, sin fecha y hechos. */
export function gruposProximos(tareas, hoyISO) {
  const r = repartir(tareas, hoyISO);
  const grupos = [];
  if (r.vencidos.length) grupos.push({ clave: 'vencidos', tipo: 'vencidos', tareas: r.vencidos });
  for (const d of r.dias) grupos.push({ clave: d.clave, tipo: 'dia', tareas: d.tareas });
  if (r.sinFecha.length) grupos.push({ clave: 'sin-fecha', tipo: 'sinFecha', tareas: r.sinFecha });
  if (r.hechos.length) grupos.push({ clave: 'hechos', tipo: 'hechos', tareas: r.hechos });
  return grupos;
}

/**
 * ¿"Retomar el" deja fuera de las sugeridas a esta tarea? Solo si la fecha es
 * futura y no hay una fecha límite que llegue antes: retomar después no puede
 * esconder un vencimiento (ajuste de la revisión 01).
 */
export function estaPospuesta(t, hoyISO) {
  const retomar = diaDe(t.retomar_el);
  if (!retomar || retomar <= hoyISO) return false;
  const limite = diaDe(t.deadline);
  return !(limite && limite < retomar);
}

/**
 * Tareas sugeridas para empezar (bloques 1-A y 3-A): las abiertas de mayor
 * orden. El orden se calcula aquí con la fecha del día (puntaje.mjs); no se
 * usa el número guardado. No entran las concluidas, las que no tienen ningún
 * impacto calificado, las pospuestas con "retomar el" ni las que ya se
 * muestran en otra parte (`yaVisibles`). Con el mismo orden, la más antigua.
 */
export function sugeridas(tareas, hoyISO, cuantas = SUGERIDAS_EN_HOY, yaVisibles = []) {
  const fuera = new Set((yaVisibles || []).map((t) => t.id));
  return (tareas || [])
    .filter((t) => t.type === 'Tarea' && !estaHecha(t) && estaCalificada(t) && !fuera.has(t.id) && !estaPospuesta(t, hoyISO))
    .sort(compararPorOrden(hoyISO))
    .slice(0, cuantas);
}

/**
 * Resumen de un conjunto de compromisos: minutos planeados y avanzados, y
 * cuántos están hechos. `subtareasDe(id)` devuelve las subtareas de una tarea.
 */
export function resumen(tareas, subtareasDe = () => []) {
  let totalMin = 0;
  let hechoMin = 0;
  let hechos = 0;
  for (const t of tareas || []) {
    const subs = subtareasDe(t.id) || [];
    const min = minutosDe(t, subs);
    totalMin += min;
    if (estaHecha(t)) {
      hechos += 1;
      hechoMin += min;
    } else if (t.type === 'Tarea' && subs.length > 0) {
      hechoMin += subs.filter((s) => s.state === 'Hecho').reduce((s, x) => s + (Number(x.time_estimated) || 0), 0);
    }
  }
  const total = (tareas || []).length;
  return { total, hechos, totalMin, hechoMin, porcentaje: totalMin > 0 ? Math.round((hechoMin / totalMin) * 100) : total > 0 ? Math.round((hechos / total) * 100) : 0 };
}
