// Lógica de la vista de computadora (entrega I-4): la semana por columnas y
// el calendario del mes. Funciones puras, con pruebas.
import { diaEfectivo, fechaLocalISO, horaCorta, nivelImportancia, partesDia, repartir, sumarDias } from './agenda.mjs';
import { compararPorOrden, estaCalificada } from './puntaje.mjs';

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

/**
 * Todas las tareas abiertas (no reuniones ni recordatorios), tengan fecha o
 * no. Primero las que tienen puntaje, de mayor a menor orden (calculado con la
 * fecha del día, bloque 3-A); después, las que no lo tienen: las más
 * importantes primero; con la misma importancia, la de fecha más cercana y al
 * final las que no tienen fecha.
 */
export function tareasAbiertas(tareas, hoyISO = fechaLocalISO()) {
  const lejos = '9999-99-99';
  const porOrden = compararPorOrden(hoyISO);
  return (tareas || [])
    .filter((t) => t.type === 'Tarea' && t.state !== 'Hecho')
    .sort((x, y) => {
      const cx = estaCalificada(x);
      const cy = estaCalificada(y);
      if (cx !== cy) return cx ? -1 : 1;
      if (cx) return porOrden(x, y);
      const porImportancia = nivelImportancia(x.priority) - nivelImportancia(y.priority);
      if (porImportancia !== 0) return porImportancia;
      const porDia = (diaEfectivo(x) || lejos).localeCompare(diaEfectivo(y) || lejos);
      if (porDia !== 0) return porDia;
      return String(x.title || '').localeCompare(String(y.title || ''));
    });
}

/**
 * Cuándo es un compromiso, para una tarjeta que no está dentro de la columna
 * de un día: "Venció el 9 de julio", "hoy · 10:00 a. m.", "sábado 14 de
 * noviembre", "Sin fecha". Devuelve { texto, vencida }.
 */
export function cuandoEs(tarea, hoyISO) {
  const dia = diaEfectivo(tarea);
  if (!dia) return { texto: 'Sin fecha', vencida: false };
  const p = partesDia(dia, hoyISO);
  const anio = dia.slice(0, 4) !== hoyISO.slice(0, 4) ? ' de ' + dia.slice(0, 4) : '';
  const fecha = p.numero + ' de ' + p.mes + anio;
  const hora = tarea.date_promised ? ' · ' + horaCorta(tarea.date_promised) : '';
  const vencida = tarea.state !== 'Hecho' && dia < hoyISO;
  if (vencida) return { texto: 'Venció ' + (p.relativo || 'el ' + fecha), vencida: true };
  return { texto: (p.relativo || p.nombre + ' ' + fecha) + hora, vencida: false };
}
