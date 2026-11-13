// Bloque 3-A2: esfuerzo Grande con plan de subtareas, delegación con
// seguimiento y sugerencia por subtarea. Cada prueba "B…" es una fila de la
// tabla de datos ausentes de docs/fase1/05_reglas_de_puntaje.md. Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUBTAREAS_MINIMAS, esFechaISO, sumarDiasISO, revisionPropuesta, conteoDeSubtareas, estaIncompleta, admiteDelegacion,
  estaDelegada, validarDelegacion, cambioDeRevision, cambiosDeRetomar, cambiosDeEntregada, delegadosConocidos, proximaSubtarea,
} from '../../src/logica/seguimiento.mjs';
import { repartir, gruposDeHoy, gruposProximos, minutosDe, sugeridas, sugeridasConPasos, textoDeDelegada } from '../../src/logica/agenda.mjs';
import { tareasAbiertas, columnasDesde } from '../../src/logica/semana.mjs';
import { formularioVacio, armarCompromiso, subtareasDelFormulario, formularioIncompleto } from '../../src/logica/compromiso.mjs';
import { prioridadVacia } from '../../src/logica/prioridad.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOY = '2026-11-13';
const tarea = (id, extra = {}) => ({
  id, title: 'T' + id, type: 'Tarea', state: 'Pendiente', priority: 'Media', date_promised: null, deadline: null, retomar_el: null,
  impact_generar: 2, impact_proteger: 1, impact_politico: null, impact_personal: null, origen: 'excel:' + id, ...extra,
});
const sub = (id, tareaId, orden, extra = {}) => ({ id, task_id: tareaId, title: 'S' + id, orden, state: 'Pendiente', time_estimated: 30, ...extra });

describe('fechas de apoyo', () => {
  test('una fecha real con formato AAAA-MM-DD, y nada más', () => {
    assert.equal(esFechaISO('2026-11-13'), true);
    assert.equal(esFechaISO('2026-02-30'), false);
    assert.equal(esFechaISO('13/11/2026'), false);
    assert.equal(esFechaISO(''), false);
    assert.equal(esFechaISO(null), false);
  });
  test('sumar días cruza meses y años', () => {
    assert.equal(sumarDiasISO('2026-11-13', 7), '2026-11-20');
    assert.equal(sumarDiasISO('2026-12-28', 7), '2027-01-04');
    assert.equal(revisionPropuesta(HOY), '2026-11-20');
  });
});

describe('esfuerzo Grande: el plan de subtareas', () => {
  test('el mínimo es 2', () => assert.equal(SUBTAREAS_MINIMAS, 2));

  test('B1 esfuerzo vacío, Rápido o Medio sin subtareas: la regla no aplica', () => {
    for (const esfuerzo of [undefined, null, '', 'Rápido', 'Medio']) assert.equal(estaIncompleta(tarea(1, { esfuerzo }), 0), false, String(esfuerzo));
  });

  test('B2 Grande con 0 o 1 subtarea: incompleta', () => {
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande' }), 0), true);
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande' }), 1), true);
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande' }), undefined), true);
  });

  test('B3 Grande con 2 o más subtareas: completa', () => {
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande' }), 2), false);
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande' }), 9), false);
  });

  test('solo cuenta en tareas abiertas', () => {
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande', state: 'Hecho' }), 0), false);
    assert.equal(estaIncompleta(tarea(1, { esfuerzo: 'Grande', type: 'Reunión' }), 0), false);
    assert.equal(estaIncompleta(null, 0), false);
  });

  test('se cuentan las subtareas de cada tarea', () => {
    const c = conteoDeSubtareas([sub(1, 'a', 1), sub(2, 'a', 2), sub(3, 'b', 1)]);
    assert.equal(c.get('a'), 2);
    assert.equal(c.get('b'), 1);
    assert.equal(c.get('z'), undefined);
    assert.equal(conteoDeSubtareas(null).size, 0);
  });

  test('una Grande sin plan no se sugiere, pero sigue en Tareas; con plan, sí', () => {
    const lista = [tarea(1, { esfuerzo: 'Grande', impact_generar: 2, impact_proteger: 2 }), tarea(2, {})];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [2]);
    assert.deepEqual(tareasAbiertas(lista, HOY).map((t) => t.id), [1, 2]);
    assert.deepEqual(sugeridas(lista, HOY, 4, [], (id) => (id === 1 ? 2 : 0)).map((t) => t.id), [1, 2]);
  });

  test('guardar una Grande sin subtareas es posible: el formulario avisa y la tarea se guarda', () => {
    const f = { ...formularioVacio(HOY), titulo: 'Proyecto grande', prioridad: { ...prioridadVacia(), esfuerzo: 'Grande', generar: '2' } };
    assert.equal(formularioIncompleto(f), true);
    const r = armarCompromiso(f, HOY);
    assert.equal(r.error, null);
    assert.equal(r.datos.esfuerzo, 'Grande');
    assert.deepEqual(r.subtareas, []);
  });

  test('en el formulario cuentan las subtareas agregadas, la que se escribe y la lista pegada', () => {
    const base = { ...formularioVacio(HOY), titulo: 'X', tendraSubtareas: true, prioridad: { ...prioridadVacia(), esfuerzo: 'Grande' } };
    assert.equal(subtareasDelFormulario({ ...base }).length, 0);
    assert.equal(formularioIncompleto({ ...base, subtareas: [{ titulo: 'a', tiempo: 10 }] }), true);
    assert.equal(formularioIncompleto({ ...base, subtareas: [{ titulo: 'a', tiempo: 10 }], nuevaSubtareaTitulo: 'b' }), false);
    assert.equal(formularioIncompleto({ ...base, textoLista: 'uno\ndos\ntres' }), false);
    assert.equal(subtareasDelFormulario({ ...base, textoLista: 'uno\ndos', tiempoLista: '15' })[1].tiempo, 15);
    assert.deepEqual(subtareasDelFormulario({ ...base, tendraSubtareas: false, textoLista: 'uno' }), []);
  });

  test('no es incompleta si no es Grande o si no es tarea', () => {
    assert.equal(formularioIncompleto({ ...formularioVacio(HOY), prioridad: { ...prioridadVacia(), esfuerzo: 'Medio' } }), false);
    assert.equal(formularioIncompleto({ ...formularioVacio(HOY), tipo: 'Reunión', prioridad: { ...prioridadVacia(), esfuerzo: 'Grande' } }), false);
  });
});

describe('delegar: validación y cambios', () => {
  test('lo que se pide: a quién y fecha de revisión', () => {
    const r = validarDelegacion({ aQuien: '  Ana  ', revisarEl: '2026-11-20' }, HOY);
    assert.equal(r.error, null);
    assert.deepEqual(r.cambios, { delegada_a: 'Ana', delegada_el: HOY, revisar_el: '2026-11-20' });
  });

  test('B4 sin escribir a quién no se puede delegar', () => {
    for (const aQuien of ['', '   ', null, undefined]) assert.match(validarDelegacion({ aQuien, revisarEl: '2026-11-20' }, HOY).error, /a quién/);
    assert.match(validarDelegacion({ aQuien: 'x'.repeat(81), revisarEl: '2026-11-20' }, HOY).error, /largo/);
    assert.equal(validarDelegacion({ aQuien: 'x'.repeat(80), revisarEl: '2026-11-20' }, HOY).error, null);
  });

  test('B5 sin fecha de revisión, ilegible o pasada no se puede delegar; hoy sí', () => {
    for (const revisarEl of ['', null, 'mañana', '2026-02-30', '2026-11-12']) assert.match(validarDelegacion({ aQuien: 'Ana', revisarEl }, HOY).error, /revisarás/);
    assert.equal(validarDelegacion({ aQuien: 'Ana', revisarEl: HOY }, HOY).error, null);
    assert.equal(validarDelegacion(undefined, HOY).error.length > 0, true);
  });

  test('revisar otro día: misma regla de fecha', () => {
    assert.deepEqual(cambioDeRevision('2026-12-01', HOY), { error: null, cambios: { revisar_el: '2026-12-01' } });
    assert.ok(cambioDeRevision('2026-11-01', HOY).error);
    assert.ok(cambioDeRevision('', HOY).error);
  });

  test('retomarla yo limpia delegado y fechas', () => {
    assert.deepEqual(cambiosDeRetomar(), { delegada_a: null, delegada_el: null, revisar_el: null });
  });

  test('ya la entregaron: queda hecha, se cierra la revisión y no se borra a quién se delegó', () => {
    const c = cambiosDeEntregada('2026-11-14T10:00:00.000Z');
    assert.deepEqual(c, { state: 'Hecho', date_completed: '2026-11-14T10:00:00.000Z', revisar_el: null });
    assert.ok(!('delegada_a' in c));
  });

  test('delegar no toca el puntaje, los impactos ni las subtareas', () => {
    const r = validarDelegacion({ aQuien: 'Ana', revisarEl: '2026-11-20' }, HOY);
    assert.deepEqual(Object.keys(r.cambios).sort(), ['delegada_a', 'delegada_el', 'revisar_el']);
  });

  test('qué es una tarea delegada y cuándo la base ya admite delegar', () => {
    assert.equal(estaDelegada(tarea(1, { delegada_a: 'Ana' })), true);
    assert.equal(estaDelegada(tarea(1, { delegada_a: '   ' })), false);
    assert.equal(estaDelegada(tarea(1, { delegada_a: null })), false);
    assert.equal(estaDelegada(tarea(1)), false);
    assert.equal(estaDelegada(tarea(1, { delegada_a: 'Ana', state: 'Hecho' })), false); // B11
    assert.equal(estaDelegada(tarea(1, { delegada_a: 'Ana', type: 'Reunión' })), false); // B10
    assert.equal(admiteDelegacion({ id: 1, delegada_a: null }), true);
    assert.equal(admiteDelegacion({ id: 1 }), false);
    assert.equal(admiteDelegacion(null), false);
  });

  test('nombres ya usados, sin repetir ni distinguir mayúsculas', () => {
    const t = [tarea(1, { delegada_a: 'Ana' }), tarea(2, { delegada_a: 'luis' }), tarea(3, { delegada_a: 'ana ' }), tarea(4), tarea(5, { delegada_a: null })];
    assert.deepEqual(delegadosConocidos(t), ['Ana', 'luis']);
    assert.deepEqual(delegadosConocidos(null), []);
  });
});

describe('seguimiento de lo delegado', () => {
  const delegada = (id, extra = {}) => tarea(id, { delegada_a: 'Ana', delegada_el: '2026-11-10', revisar_el: '2026-11-20', ...extra });

  test('B6 revisión futura: no aparece en Hoy; aparece en su día de Próximos', () => {
    const lista = [delegada(1)];
    assert.deepEqual(gruposDeHoy(lista, HOY), []);
    const proximos = gruposProximos(lista, HOY);
    assert.deepEqual(proximos.map((g) => g.clave), ['2026-11-20']);
    assert.deepEqual(proximos[0].tareas.map((t) => t.id), [1]);
  });

  test('B7 revisión de hoy o pasada: está en Seguimiento, y se queda aunque pase la fecha', () => {
    const lista = [delegada(1, { revisar_el: HOY }), delegada(2, { revisar_el: '2026-11-01' })];
    const hoy = gruposDeHoy(lista, HOY);
    assert.deepEqual(hoy.map((g) => g.tipo), ['seguimiento']);
    assert.deepEqual(hoy[0].tareas.map((t) => t.id), [2, 1]); // la revisión más atrasada primero
    assert.equal(gruposProximos(lista, HOY)[0].tipo, 'seguimiento');
  });

  test('una delegada sin fecha de revisión cuenta como hoy (no se pierde)', () => {
    assert.deepEqual(gruposDeHoy([delegada(1, { revisar_el: null })], HOY).map((g) => g.tipo), ['seguimiento']);
  });

  test('B8 con fecha límite vencida: va a Vencidos, una sola vez', () => {
    const lista = [delegada(1, { deadline: '2026-11-10', revisar_el: HOY })];
    const grupos = gruposDeHoy(lista, HOY);
    assert.deepEqual(grupos.map((g) => g.tipo), ['vencidos']);
    const r = repartir(lista, HOY);
    assert.equal(r.vencidos.length, 1);
    assert.equal(r.seguimiento.length, 0);
  });

  test('con fecha límite que aún no llega, sigue su seguimiento normal', () => {
    const lista = [delegada(1, { deadline: '2026-11-30', revisar_el: HOY })];
    assert.deepEqual(gruposDeHoy(lista, HOY).map((g) => g.tipo), ['seguimiento']);
  });

  test('B9 sin impactos (sin puntaje) se sigue igual', () => {
    const lista = [delegada(1, { impact_generar: null, impact_proteger: null, revisar_el: HOY })];
    assert.deepEqual(gruposDeHoy(lista, HOY).map((g) => g.tipo), ['seguimiento']);
  });

  test('B11 una delegada que ya está hecha se trata como cualquier hecha', () => {
    const r = repartir([delegada(1, { state: 'Hecho', revisar_el: HOY, date_completed: '2020-01-01T00:00:00' })], HOY);
    assert.equal(r.seguimiento.length, 0);
    assert.equal(r.hechos.length, 1);
  });

  test('la delegada no ocupa tu tiempo y no se sugiere ni va a Tareas', () => {
    const d = delegada(1, { time_estimated: 120 });
    assert.equal(minutosDe(d, []), 0);
    assert.equal(minutosDe({ ...d, delegada_a: null }, []), 120);
    assert.deepEqual(sugeridas([d, tarea(2)], HOY).map((t) => t.id), [2]);
    assert.deepEqual(tareasAbiertas([d, tarea(2)], HOY).map((t) => t.id), [2]);
  });

  test('retomarla la devuelve a sugeridas y a Tareas', () => {
    const vuelta = { ...delegada(1), ...cambiosDeRetomar() };
    assert.deepEqual(sugeridas([vuelta], HOY).map((t) => t.id), [1]);
    assert.deepEqual(tareasAbiertas([vuelta], HOY).map((t) => t.id), [1]);
  });

  test('la vista de computadora trae la columna Seguimiento solo si la semana empieza hoy', () => {
    const lista = [delegada(1, { revisar_el: HOY })];
    assert.equal(columnasDesde(lista, HOY)[0].tipo, 'seguimiento');
    assert.equal(columnasDesde(lista, HOY, '2026-11-16').some((c) => c.tipo === 'seguimiento'), false);
    assert.equal(columnasDesde([], HOY).some((c) => c.tipo === 'seguimiento'), false);
  });

  test('el texto de la tarea delegada', () => {
    assert.equal(textoDeDelegada(delegada(1, { revisar_el: HOY }), HOY), 'Delegada a Ana · revisar hoy');
    assert.equal(textoDeDelegada(delegada(1, { revisar_el: '2026-11-14' }), HOY), 'Delegada a Ana · revisar mañana');
    assert.equal(textoDeDelegada(delegada(1, { revisar_el: '2026-11-20' }), HOY), 'Delegada a Ana · revisar el 20 de noviembre');
    assert.equal(textoDeDelegada(delegada(1, { revisar_el: '2026-11-12' }), HOY), 'Delegada a Ana · revisión pendiente desde ayer');
    assert.equal(textoDeDelegada(delegada(1, { revisar_el: null }), HOY), 'Delegada a Ana · sin fecha de revisión');
  });
});

describe('sugerir la siguiente subtarea, no la tarea completa (D6)', () => {
  test('la siguiente pendiente, en el orden en que se acomodaron', () => {
    const subs = [sub(3, 't', 3), sub(1, 't', 1, { state: 'Hecho' }), sub(2, 't', 2)];
    assert.equal(proximaSubtarea(subs).id, 2);
    assert.equal(proximaSubtarea([sub(1, 't', 1, { state: 'Hecho' })]), null);
    assert.equal(proximaSubtarea([]), null);
    assert.equal(proximaSubtarea(null), null);
  });

  test('una tarea con subtareas se sugiere por su siguiente subtarea, con el puntaje de la tarea', () => {
    const t1 = tarea(1, { esfuerzo: 'Grande', impact_generar: 2, impact_proteger: 2 });
    const subs = { 1: [sub(10, 1, 1, { state: 'Hecho' }), sub(11, 1, 2), sub(12, 1, 3)] };
    const r = sugeridasConPasos([t1, tarea(2)], HOY, 4, [], (id) => subs[id] || []);
    assert.deepEqual(r.tareas.map((t) => t.id), [1, 2]);
    assert.equal(r.pasos.get(1).id, 11);
    assert.equal(r.pasos.has(2), false);
  });

  test('un proyecto ocupa un solo lugar, aunque tenga muchas subtareas', () => {
    const t1 = tarea(1, { esfuerzo: 'Grande', impact_generar: 2, impact_proteger: 2 });
    const subs = { 1: [sub(11, 1, 1), sub(12, 1, 2), sub(13, 1, 3), sub(14, 1, 4)] };
    assert.equal(sugeridasConPasos([t1], HOY, 4, [], (id) => subs[id] || []).tareas.length, 1);
  });

  test('con todas las subtareas hechas, la tarea se sugiere ella misma para cerrarla', () => {
    const t1 = tarea(1);
    const r = sugeridasConPasos([t1], HOY, 4, [], () => [sub(1, 1, 1, { state: 'Hecho' }), sub(2, 1, 2, { state: 'Hecho' })]);
    assert.deepEqual(r.tareas.map((t) => t.id), [1]);
    assert.equal(r.pasos.size, 0);
  });

  test('una Grande con una sola subtarea sigue incompleta y no se sugiere', () => {
    const t1 = tarea(1, { esfuerzo: 'Grande' });
    assert.deepEqual(sugeridasConPasos([t1], HOY, 4, [], () => [sub(1, 1, 1)]).tareas, []);
  });
});

describe('migración de delegación', () => {
  const sql = readFileSync(join(raiz, 'supabase/migrations/20261114_delegacion.sql'), 'utf8').replace(/\r\n/g, '\n');
  const activo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  test('solo agrega tres columnas opcionales: no toca reglas, permisos ni lo existente', () => {
    assert.doesNotMatch(activo, /\b(drop|grant|revoke|policy|delete|update|truncate)\b/i);
    assert.equal((activo.match(/add column if not exists/g) || []).length, 3);
    assert.ok(activo.split('\n').filter((l) => l.includes('add column')).every((l) => !/not null/i.test(l)));
    for (const c of ['delegada_a', 'delegada_el', 'revisar_el']) assert.match(activo, new RegExp(c));
  });

  test('el nombre de a quién tiene el mismo límite que la pantalla', () => {
    assert.match(activo, /char_length\(delegada_a\) <= 80/);
  });

  test('trae su reversión', () => {
    assert.match(sql, /REVERSIÓN/);
    assert.equal((sql.match(/drop column if exists/g) || []).length, 3);
  });
});
