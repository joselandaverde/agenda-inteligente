// Lógica de presentación de la agenda (src/logica/agenda.mjs). Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fechaLocalISO, diaDe, horaCorta, sumarDias, fechaLarga, partesDia, formatoDuracion,
  minutosDe, nivelImportancia, diaEfectivo, repartir, gruposDeHoy, gruposProximos, resumen,
} from '../../src/logica/agenda.mjs';

const HOY = '2026-11-11';
const t = (id, extra = {}) => ({ id, title: 'T' + id, type: 'Tarea', state: 'Pendiente', priority: 'Media', date_promised: null, ...extra });

describe('fechas y horas', () => {
  test('la fecha local no depende de UTC', () => {
    assert.equal(fechaLocalISO(new Date(2026, 10, 11, 23, 59)), '2026-11-11');
    assert.equal(fechaLocalISO(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  });

  test('el día sale de la fecha guardada sin zona, tal cual', () => {
    assert.equal(diaDe('2026-11-12T10:00:00'), '2026-11-12');
    assert.equal(diaDe('2026-11-12T23:30:00'), '2026-11-12');
    assert.equal(diaDe('2026-11-12 00:05:00'), '2026-11-12');
    assert.equal(diaDe('2026-11-12'), '2026-11-12');
    assert.equal(diaDe(null), null);
    assert.equal(diaDe(''), null);
    assert.equal(diaDe('no es fecha'), null);
  });

  test('hora en formato de 12 horas', () => {
    assert.equal(horaCorta('2026-11-12T10:00:00'), '10:00 a. m.');
    assert.equal(horaCorta('2026-11-12T18:30:00'), '6:30 p. m.');
    assert.equal(horaCorta('2026-11-12T00:05:00'), '12:05 a. m.');
    assert.equal(horaCorta('2026-11-12T12:00:00'), '12:00 p. m.');
    assert.equal(horaCorta(null), '');
  });

  test('sumar días cruza meses y años', () => {
    assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
    assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
    assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  });

  test('textos de fecha', () => {
    assert.equal(fechaLarga(HOY), 'miércoles 11 de noviembre');
    assert.deepEqual(partesDia(HOY, HOY), { numero: 11, nombre: 'miércoles', mes: 'noviembre', relativo: 'hoy' });
    assert.equal(partesDia('2026-11-12', HOY).relativo, 'mañana');
    assert.equal(partesDia('2026-11-10', HOY).relativo, 'ayer');
    assert.equal(partesDia('2026-11-13', HOY).relativo, '');
  });
});

describe('duraciones e importancia', () => {
  test('formato h:mm', () => {
    assert.equal(formatoDuracion(150), '2:30');
    assert.equal(formatoDuracion(15), '0:15');
    assert.equal(formatoDuracion(60), '1:00');
    for (const v of [0, -5, null, undefined, 'x']) assert.equal(formatoDuracion(v), '');
  });

  test('una tarea con subtareas dura la suma de ellas', () => {
    const subs = [{ time_estimated: 30 }, { time_estimated: 45 }, { time_estimated: null }];
    assert.equal(minutosDe(t(1, { time_estimated: 30 }), subs), 75);
    assert.equal(minutosDe(t(1, { time_estimated: 30 })), 30);
    assert.equal(minutosDe(t(1, { type: 'Reunión', time_estimated: 60 }), subs), 60);
    assert.equal(minutosDe(t(1, { type: 'Recordatorio', time_estimated: 30 })), 0);
    assert.equal(minutosDe(null), 0);
  });

  test('cinco niveles de importancia; lo desconocido cuenta como media', () => {
    assert.deepEqual(['Muy alta', 'Alta', 'Media', 'Baja', 'Muy baja', 'otra', undefined].map(nivelImportancia), [1, 2, 3, 4, 5, 3, 3]);
  });
});

describe('reparto en grupos', () => {
  const tareas = [
    t(1, { date_promised: '2026-11-11T10:00:00', type: 'Reunión' }),
    t(2, { date_promised: '2026-11-11T09:00:00', priority: 'Baja' }),
    t(3, { date_promised: '2026-11-10T09:00:00' }),
    t(4, { date_promised: '2026-11-12T09:00:00' }),
    t(5),
    t(6, { state: 'Hecho', date_promised: '2026-11-11T08:00:00' }),
    t(7, { state: 'Hecho', date_promised: '2026-11-01T08:00:00', date_completed: '2026-11-02T08:00:00' }),
    t(8, { date_promised: '2026-11-11T16:00:00', priority: 'Muy alta' }),
    t(9, { state: 'Hecho', date_completed: fechaLocalISO(new Date(2026, 10, 11)) + 'T12:00:00' }),
  ];

  test('cada compromiso cae en un solo grupo y no se pierde ninguno', () => {
    const r = repartir(tareas, HOY);
    const ids = [...r.vencidos, ...r.dias.flatMap((d) => d.tareas), ...r.sinFecha, ...r.hechos].map((x) => x.id).sort();
    assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('vencido, por día, sin fecha y hecho', () => {
    const r = repartir(tareas, HOY);
    assert.deepEqual(r.vencidos.map((x) => x.id), [3]);
    assert.deepEqual(r.dias.map((d) => d.clave), ['2026-11-11', '2026-11-12']);
    assert.deepEqual(r.sinFecha.map((x) => x.id), [5]);
    assert.deepEqual(r.hechos.map((x) => x.id), [7]);
  });

  test('dentro del día: por hora, luego lo que no tiene hora por importancia, lo hecho al final', () => {
    const hoy = repartir(tareas, HOY).dias[0].tareas.map((x) => x.id);
    assert.deepEqual(hoy, [2, 1, 8, 6, 9]);
    const mezcla = [t(1, { deadline: HOY, priority: 'Baja' }), t(2, { deadline: HOY, priority: 'Muy alta' }), t(3, { date_promised: HOY + 'T17:00:00' })];
    assert.deepEqual(repartir(mezcla, HOY).dias[0].tareas.map((x) => x.id), [3, 2, 1]);
  });

  test('una tarea sin fecha pero con fecha límite se muestra el día de su límite', () => {
    assert.equal(diaEfectivo(t(1, { deadline: '2026-11-13' })), '2026-11-13');
    assert.equal(diaEfectivo(t(1, { deadline: '2026-11-13', date_promised: '2026-11-12T09:00:00' })), '2026-11-12');
    assert.equal(diaEfectivo(t(1, { type: 'Reunión', deadline: '2026-11-13' })), null);
    assert.equal(diaEfectivo(t(1)), null);
    assert.equal(diaEfectivo(null), null);
    const r = repartir([t(1, { deadline: '2026-11-10' }), t(2, { deadline: '2026-11-13' }), t(3)], HOY);
    assert.deepEqual(r.vencidos.map((x) => x.id), [1]);
    assert.deepEqual(r.dias.map((d) => d.clave), ['2026-11-13']);
    assert.deepEqual(r.sinFecha.map((x) => x.id), [3]);
  });

  test('pantalla Hoy: solo vencido y hoy', () => {
    assert.deepEqual(gruposDeHoy(tareas, HOY).map((g) => g.clave), ['vencidos', '2026-11-11']);
    assert.deepEqual(gruposDeHoy([t(5)], HOY), []);
    assert.deepEqual(gruposDeHoy([], HOY), []);
    assert.deepEqual(gruposDeHoy(undefined, HOY), []);
  });

  test('pantalla Próximos: todos los grupos en orden', () => {
    assert.deepEqual(gruposProximos(tareas, HOY).map((g) => g.clave), ['vencidos', '2026-11-11', '2026-11-12', 'sin-fecha', 'hechos']);
  });
});

describe('resumen del día', () => {
  test('minutos planeados, avanzados y porcentaje', () => {
    const subs = { 2: [{ time_estimated: 30, state: 'Hecho' }, { time_estimated: 90, state: 'Pendiente' }] };
    const lista = [
      t(1, { type: 'Reunión', time_estimated: 60 }),
      t(2, { time_estimated: 30 }),
      t(3, { time_estimated: 30, state: 'Hecho' }),
      t(4, { type: 'Recordatorio', time_estimated: 30 }),
    ];
    const r = resumen(lista, (id) => subs[id] || []);
    assert.deepEqual(r, { total: 4, hechos: 1, totalMin: 210, hechoMin: 60, porcentaje: 29 });
  });

  test('sin duraciones, el porcentaje sale de cuántos están hechos', () => {
    const r = resumen([t(1, { type: 'Recordatorio' }), t(2, { type: 'Recordatorio', state: 'Hecho' })]);
    assert.equal(r.porcentaje, 50);
    assert.deepEqual(resumen([]), { total: 0, hechos: 0, totalMin: 0, hechoMin: 0, porcentaje: 0 });
  });
});
