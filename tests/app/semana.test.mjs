// Vista de computadora (src/logica/semana.mjs) y captura desde la columna de
// un día (src/logica/compromiso.mjs). Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { columnasDesde, cuandoEs, mesDe, subtareasDeTarjeta, tareasAbiertas } from '../../src/logica/semana.mjs';
import { formularioDelDia, formularioInterpretado, formularioVacio, armarCompromiso } from '../../src/logica/compromiso.mjs';

const HOY = '2026-11-12'; // jueves
const tarea = (id, extra = {}) => ({ id, title: 'T' + id, type: 'Tarea', state: 'Pendiente', priority: 'Media', date_promised: null, deadline: null, ...extra });

describe('columnas de la semana', () => {
  const tareas = [
    tarea(1, { date_promised: '2026-11-12T10:00:00' }),
    tarea(2, { deadline: '2026-11-14' }),
    tarea(3, { date_promised: '2026-11-10T09:00:00' }), // vencida
    tarea(4, { date_promised: '2026-11-30T09:00:00' }), // fuera de los siete días
    tarea(5), // sin fecha
    tarea(6, { state: 'Hecho', date_promised: '2026-11-01T09:00:00', date_completed: '2026-11-01T10:00:00' }),
  ];

  test('lo vencido, siete días seguidos aunque estén vacíos y los días posteriores con algo', () => {
    const columnas = columnasDesde(tareas, HOY);
    assert.deepEqual(columnas.map((c) => c.clave), [
      'vencidos', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-30',
    ]);
    assert.deepEqual(columnas[0].tareas.map((t) => t.id), [3]);
    assert.deepEqual(columnas[1].tareas.map((t) => t.id), [1]);
    assert.deepEqual(columnas[2].tareas, []);
    assert.deepEqual(columnas[3].tareas.map((t) => t.id), [2]);
    assert.deepEqual(columnas[8].tareas.map((t) => t.id), [4]);
  });

  test('ni lo sin fecha ni lo hecho en otro día entran en las columnas', () => {
    const ids = columnasDesde(tareas, HOY).flatMap((c) => c.tareas.map((t) => t.id));
    assert.ok(!ids.includes(5));
    assert.ok(!ids.includes(6));
  });

  test('sin vencidos no hay columna de vencidos', () => {
    assert.equal(columnasDesde([tarea(1, { date_promised: '2026-11-12T10:00:00' })], HOY)[0].clave, HOY);
    assert.equal(columnasDesde([], HOY).length, 7);
  });

  test('empezar en un día posterior: sin vencidos y desde ese día', () => {
    const columnas = columnasDesde(tareas, HOY, '2026-11-14');
    assert.equal(columnas[0].clave, '2026-11-14');
    assert.equal(columnas[6].clave, '2026-11-20');
    assert.equal(columnas[7].clave, '2026-11-30');
    assert.ok(!columnas.some((c) => c.clave === 'vencidos'));
  });

  test('un inicio anterior a hoy se toma como hoy', () => {
    assert.equal(columnasDesde(tareas, HOY, '2026-11-01')[0].clave, 'vencidos');
    assert.equal(columnasDesde(tareas, HOY, '2026-11-01')[1].clave, HOY);
    assert.equal(columnasDesde(tareas, HOY, null)[1].clave, HOY);
  });

  test('la semana cruza de mes y de año', () => {
    const columnas = columnasDesde([], '2026-12-29');
    assert.deepEqual(columnas.map((c) => c.clave), ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04']);
  });
});

describe('calendario del mes', () => {
  test('noviembre de 2026: empieza en domingo, seis semanas completas de lunes a domingo', () => {
    const mes = mesDe(2026, 10, HOY);
    assert.equal(mes.titulo, 'Noviembre 2026');
    assert.equal(mes.dias.length, 42);
    assert.equal(mes.dias[0].iso, '2026-10-26');
    assert.equal(mes.dias[0].delMes, false);
    assert.equal(mes.dias[6].iso, '2026-11-01');
    assert.equal(mes.dias[6].delMes, true);
    assert.equal(mes.dias[41].iso, '2026-12-06');
    assert.equal(mes.dias.filter((d) => d.delMes).length, 30);
  });

  test('marca hoy y lo pasado', () => {
    const mes = mesDe(2026, 10, HOY);
    assert.deepEqual(mes.dias.filter((d) => d.esHoy).map((d) => d.iso), [HOY]);
    assert.equal(mes.dias.find((d) => d.iso === '2026-11-11').pasado, true);
    assert.equal(mes.dias.find((d) => d.iso === HOY).pasado, false);
    assert.equal(mes.dias.find((d) => d.iso === '2026-11-13').pasado, false);
  });

  test('febrero de 2027 cabe en cuatro semanas exactas', () => {
    const mes = mesDe(2027, 1, HOY);
    assert.equal(mes.dias.length, 28);
    assert.equal(mes.dias[0].iso, '2027-02-01');
    assert.equal(mes.dias[27].iso, '2027-02-28');
  });

  test('pasar de diciembre a enero y de enero a diciembre', () => {
    assert.deepEqual([mesDe(2026, 12, HOY).anio, mesDe(2026, 12, HOY).mes, mesDe(2026, 12, HOY).titulo], [2027, 0, 'Enero 2027']);
    assert.deepEqual([mesDe(2027, -1, HOY).anio, mesDe(2027, -1, HOY).mes, mesDe(2027, -1, HOY).titulo], [2026, 11, 'Diciembre 2026']);
  });
});

describe('subtareas en una tarjeta', () => {
  const subs = [1, 2, 3, 4, 5].map((n) => ({ id: n, title: 'S' + n }));
  test('caben tres; el resto se cuenta', () => {
    assert.deepEqual(subtareasDeTarjeta(subs), { visibles: subs.slice(0, 3), resto: 2 });
    assert.deepEqual(subtareasDeTarjeta(subs.slice(0, 3)), { visibles: subs.slice(0, 3), resto: 0 });
    assert.deepEqual(subtareasDeTarjeta([]), { visibles: [], resto: 0 });
    assert.deepEqual(subtareasDeTarjeta(null), { visibles: [], resto: 0 });
  });
});

describe('vista Tareas', () => {
  const lista = [
    tarea(1, { priority: 'Media', date_promised: '2026-11-20T09:00:00' }),
    tarea(2, { priority: 'Muy alta' }), // sin fecha
    tarea(3, { priority: 'Media', deadline: '2026-11-10' }), // vencida
    tarea(4, { priority: 'Muy alta', date_promised: '2026-12-31T09:00:00' }),
    tarea(5, { priority: 'Baja', state: 'Hecho' }),
    tarea(6, { type: 'Reunión', priority: 'Muy alta', date_promised: '2026-11-12T10:00:00' }),
    tarea(7, { type: 'Recordatorio', date_promised: '2026-11-12T18:00:00' }),
    tarea(8, { priority: 'Media' }), // sin fecha
  ];

  test('solo tareas abiertas: ni reuniones, ni recordatorios, ni lo hecho', () => {
    assert.deepEqual(tareasAbiertas(lista).map((t) => t.id).sort(), [1, 2, 3, 4, 8]);
    assert.deepEqual(tareasAbiertas([]), []);
    assert.deepEqual(tareasAbiertas(null), []);
  });

  test('por importancia; con la misma, la fecha más cercana primero y lo sin fecha al final', () => {
    assert.deepEqual(tareasAbiertas(lista).map((t) => t.id), [4, 2, 3, 1, 8]);
  });

  test('no cambia la lista original', () => {
    const copia = lista.map((t) => t.id);
    tareasAbiertas(lista);
    assert.deepEqual(lista.map((t) => t.id), copia);
  });

  test('cuándo es: sin fecha, vencida, hoy con hora, otro día y otro año', () => {
    assert.deepEqual(cuandoEs(tarea(1), HOY), { texto: 'Sin fecha', vencida: false });
    assert.deepEqual(cuandoEs(tarea(1, { deadline: '2026-07-09' }), HOY), { texto: 'Venció el 9 de julio', vencida: true });
    assert.deepEqual(cuandoEs(tarea(1, { date_promised: '2026-11-11T09:00:00' }), HOY), { texto: 'Venció ayer', vencida: true });
    assert.deepEqual(cuandoEs(tarea(1, { date_promised: '2026-11-12T10:00:00' }), HOY), { texto: 'hoy · 10:00 a. m.', vencida: false });
    assert.deepEqual(cuandoEs(tarea(1, { deadline: '2026-11-14' }), HOY), { texto: 'sábado 14 de noviembre', vencida: false });
    assert.deepEqual(cuandoEs(tarea(1, { date_promised: '2027-01-04T16:30:00' }), HOY), { texto: 'lunes 4 de enero de 2027 · 4:30 p. m.', vencida: false });
  });

  test('lo hecho con fecha pasada no cuenta como vencido', () => {
    assert.deepEqual(cuandoEs(tarea(1, { state: 'Hecho', date_promised: '2026-11-01T09:00:00' }), HOY), { texto: 'domingo 1 de noviembre · 9:00 a. m.', vencida: false });
  });
});

describe('capturar desde la columna de un día', () => {
  test('sin día, es el formulario vacío de siempre', () => {
    assert.deepEqual(formularioDelDia(HOY, null), formularioVacio(HOY));
    assert.deepEqual(formularioDelDia(HOY, undefined), formularioVacio(HOY));
  });

  test('con día, la tarea nace con esa fecha y se guarda con ella', () => {
    const f = formularioDelDia(HOY, '2026-11-16');
    assert.equal(f.fecha, '2026-11-16');
    assert.equal(f.tieneFechaHora, true);
    const r = armarCompromiso({ ...f, titulo: 'Comprar tóner' });
    assert.ok(!r.error);
    assert.equal(String(r.datos.date_promised).slice(0, 10), '2026-11-16');
  });

  test('si el dictado no dice fecha, se queda la de la columna', () => {
    const { formulario } = formularioInterpretado(HOY, { titulo: 'Comprar tóner', tipo: 'Tarea' }, { fechaInicial: '2026-11-16' });
    assert.equal(formulario.fecha, '2026-11-16');
    assert.equal(formulario.tieneFechaHora, true);
  });

  test('si el dictado dice fecha, gana la del dictado', () => {
    const { formulario } = formularioInterpretado(HOY, { titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-20' }, { fechaInicial: '2026-11-16' });
    assert.equal(formulario.fecha, '2026-11-20');
  });

  test('sin columna, la interpretación queda como antes', () => {
    const { formulario } = formularioInterpretado(HOY, { titulo: 'Comprar tóner', tipo: 'Tarea' });
    assert.equal(formulario.fecha, HOY);
    assert.equal(formulario.tieneFechaHora, false);
  });
});
