// Lógica de la vista de computadora (entrega I-4): la semana por columnas y
// el calendario del mes. Funciones puras, con pruebas.
import { repartir, sumarDias } from './agenda.mjs';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const dos = (n) => String(n).padStart(2, '0');
const isoDe = (f) => f.getFullYear() + '-' + dos(f.getMonth() + 1) + '-' + dos(f.getDate());

/**
 * Columnas de la semana: lo vencido (solo si la vista empieza hoy), `dias`
 * días seguidos desde `inicioISO` aunque estén vacíos y, después, cada día
 * posterior que tenga algo. Un inicio anterior a hoy se toma como hoy.
 */
export function columnasDesde(tareas, hoyISO, inicioISO = hoyISO, dias = 7) {
  const r = repartir(tareas, hoyISO);
  const porDia = new Map(r.dias.map((d) => [d.clave, d.tareas]));
  const inicio = !inicioISO || inicioISO < hoyISO ? hoyISO : inicioISO;
  const columnas = [];

  if (inicio === hoyISO && r.vencidos.length) columnas.push({ clave: 'vencidos', tipo: 'vencidos', tareas: r.vencidos });
  for (let i = 0; i < dias; i++) {
    const iso = sumarDias(inicio, i);
    columnas.push({ clave: iso, tipo: 'dia', tareas: porDia.get(iso) || [] });
  }
  const fin = sumarDias(inicio, dias - 1);
  for (const d of r.dias) {
    if (d.clave > fin) columnas.push({ clave: d.clave, tipo: 'dia', tareas: d.tareas });
  }
  return columnas;
}

/**
 * Cuadrícula de un mes, de lunes a domingo, completada con los días vecinos.
 * `mes` va de 0 a 11 y puede salirse del rango (12 es enero del año siguiente).
 */
export function mesDe(anio, mes, hoyISO) {
  const primero = new Date(anio, mes, 1);
  const a = primero.getFullYear();
  const m = primero.getMonth();
  const desdeLunes = (primero.getDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(a, m + 1, 0).getDate();
  const celdas = Math.ceil((desdeLunes + diasDelMes) / 7) * 7;

  const dias = [];
  for (let i = 0; i < celdas; i++) {
    const f = new Date(a, m, 1 - desdeLunes + i);
    const iso = isoDe(f);
    dias.push({ iso, numero: f.getDate(), delMes: f.getMonth() === m, esHoy: iso === hoyISO, pasado: iso < hoyISO });
  }
  return { anio: a, mes: m, titulo: MESES[m] + ' ' + a, dias };
}

/** Subtareas que caben en una tarjeta y cuántas quedan fuera. */
export function subtareasDeTarjeta(subtareas, maximo = 3) {
  const lista = subtareas || [];
  if (lista.length <= maximo) return { visibles: lista, resto: 0 };
  return { visibles: lista.slice(0, maximo), resto: lista.length - maximo };
}
