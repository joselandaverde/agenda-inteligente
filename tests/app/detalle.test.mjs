// Lógica de la pantalla de detalle (src/logica/detalle.mjs). Sin red ni navegador.
// Fija el comportamiento que tenía el panel de edición dentro de App.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { edicionDe, armarActualizacion, minutosValidos, vecinaDe, semanaDe } from '../../src/logica/detalle.mjs';

const tarea = (extra = {}) => ({ id: 't1', title: 'Algo', type: 'Tarea', state: 'Pendiente', priority: 'Alta', project_id: 'c1', notes: 'Nota', time_estimated: 45, date_promised: null, ...extra });

describe('abrir un compromiso', () => {
  test('sin fecha: campos de hora en su valor inicial', () => {
    assert.deepEqual(edicionDe(tarea()), { titulo: 'Algo', categoria: 'c1', importancia: 'Alta', notas: 'Nota', tiempoEstimado: '45', fecha: '', hora12: '9', minutos: '00', ampm: 'AM' });
  });

  test('con fecha: se descompone en fecha, hora de 12 horas y minutos de cinco en cinco', () => {
    const e = edicionDe(tarea({ date_promised: '2026-11-12T16:37:00' }));
    assert.equal(e.fecha, '2026-11-12');
    assert.equal(e.hora12, '4');
    assert.equal(e.minutos, '35');
    assert.equal(e.ampm, 'PM');
    assert.equal(edicionDe(tarea({ date_promised: '2026-11-12T00:00:00' })).hora12, '12');
    assert.equal(edicionDe(tarea({ date_promised: '2026-11-12T00:00:00' })).ampm, 'AM');
    assert.equal(edicionDe(tarea({ date_promised: '2026-11-12T12:05:00' })).ampm, 'PM');
  });

  test('datos vacíos toman valores por defecto', () => {
    const e = edicionDe({ id: 'x', type: 'Reunión' });
    assert.deepEqual(e, { titulo: '', categoria: '', importancia: 'Media', notas: '', tiempoEstimado: '30', fecha: '', hora12: '9', minutos: '00', ampm: 'AM' });
  });
});

describe('guardar cambios', () => {
  test('tarea sin elegir fecha: la fecha se queda como estaba', () => {
    const t = tarea({ date_promised: '2026-11-12T10:00:00' });
    const cambios = armarActualizacion(t, { ...edicionDe(t), fecha: '', titulo: 'Otro', categoria: '', notas: '', tiempoEstimado: 'x' });
    assert.deepEqual(cambios, { title: 'Otro', project_id: null, priority: 'Alta', date_promised: '2026-11-12T10:00:00', notes: null, time_estimated: 30 });
  });

  test('con fecha elegida se arma la fecha y hora de 24 horas', () => {
    const t = tarea();
    const cambios = armarActualizacion(t, { ...edicionDe(t), fecha: '2026-11-13', hora12: '6', minutos: '30', ampm: 'PM', tiempoEstimado: '90' });
    assert.equal(cambios.date_promised, '2026-11-13T18:30:00');
    assert.equal(cambios.time_estimated, 90);
  });

  test('en reuniones y recordatorios no se toca el tiempo estimado', () => {
    for (const type of ['Reunión', 'Recordatorio']) {
      const t = tarea({ type });
      assert.equal('time_estimated' in armarActualizacion(t, edicionDe(t)), false, type);
    }
  });

  test('abrir y guardar sin tocar nada no cambia los datos', () => {
    const t = tarea({ date_promised: '2026-11-12T16:35:00' });
    assert.deepEqual(armarActualizacion(t, edicionDe(t)), { title: 'Algo', project_id: 'c1', priority: 'Alta', date_promised: '2026-11-12T16:35:00', notes: 'Nota', time_estimated: 45 });
  });
});

describe('subtareas', () => {
  test('minutos válidos', () => {
    assert.equal(minutosValidos('30'), 30);
    assert.equal(minutosValidos(15), 15);
    for (const v of ['', '0', '-5', 'x', null, undefined]) assert.equal(minutosValidos(v), null);
  });

  test('vecina al subir o bajar', () => {
    const subs = [{ id: 'a', orden: 1 }, { id: 'b', orden: 2 }, { id: 'c', orden: 3 }];
    assert.equal(vecinaDe(subs, subs[1], 'subir').id, 'a');
    assert.equal(vecinaDe(subs, subs[1], 'bajar').id, 'c');
    assert.equal(vecinaDe(subs, subs[0], 'subir'), null);
    assert.equal(vecinaDe(subs, subs[2], 'bajar'), null);
    assert.equal(vecinaDe(subs, { id: 'z' }, 'subir'), null);
  });
});

describe('tira de la semana', () => {
  test('de lunes a domingo, con hoy marcado', () => {
    const s = semanaDe('2026-11-11'); // miércoles
    assert.deepEqual(s.map((d) => d.iso), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    assert.deepEqual(s.map((d) => d.letra).join(''), 'LMXJVSD');
    assert.deepEqual(s.filter((d) => d.esHoy).map((d) => d.numero), [11]);
    assert.deepEqual(s.filter((d) => d.pasado).map((d) => d.numero), [9, 10]);
  });

  test('un domingo pertenece a la semana que termina ese día; cruza meses y años', () => {
    assert.equal(semanaDe('2026-11-15')[0].iso, '2026-11-09');
    assert.equal(semanaDe('2026-11-09')[0].iso, '2026-11-09');
    const finDeAnio = semanaDe('2027-01-01'); // viernes
    assert.equal(finDeAnio[0].iso, '2026-12-28');
    assert.equal(finDeAnio[6].iso, '2027-01-03');
  });
});
