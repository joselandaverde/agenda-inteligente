// Bloque 1-A: tareas sugeridas por puntaje, datos de prioridad en el detalle,
// orden de la vista Tareas y la migración de columnas. Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sugeridas, estaPospuesta, gruposDeHoy } from '../../src/logica/agenda.mjs';
import { tareasAbiertas } from '../../src/logica/semana.mjs';
import { DELEGABLES, admitePrioridad, edicionPrioridad, cambiosPrioridad, datosDePrioridad, armarActualizacion, edicionDe } from '../../src/logica/detalle.mjs';
import { armarRespaldo, validarRespaldo, verificarHuellas, filasParaRestaurar, compararConRespaldo, ESQUEMA } from '../../src/logica/respaldo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOY = '2026-11-12';
const tarea = (id, orden, extra = {}) => ({
  id, title: 'T' + id, type: 'Tarea', state: 'Pendiente', priority: 'Media', date_promised: null, deadline: null,
  retomar_el: null, orden_sugerido: orden, puntaje: orden, origen: orden === null ? null : 'excel:' + id, ...extra,
});

describe('tareas sugeridas', () => {
  test('las de mayor orden primero, y solo las que se piden', () => {
    const lista = [tarea(1, 12.5), tarea(2, 84.5), tarea(3, 40), tarea(4, 25), tarea(5, 37.5), tarea(6, 10), tarea(7, 35)];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [2, 3, 5, 7, 4]);
    assert.deepEqual(sugeridas(lista, HOY, 2).map((t) => t.id), [2, 3]);
  });

  test('con el mismo orden gana el menor número de la carga', () => {
    const lista = [tarea(9, 40), tarea(3, 40), tarea(21, 40), tarea(1, 12.5)];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [3, 9, 21, 1]);
  });

  test('sin número de carga, el desempate es el nombre', () => {
    const lista = [tarea(2, 40, { origen: null, title: 'Zeta' }), tarea(1, 40, { origen: null, title: 'Alfa' })];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.title), ['Alfa', 'Zeta']);
  });

  test('no entran las concluidas, las que no tienen orden ni lo que no es tarea', () => {
    const lista = [
      tarea(1, 90, { state: 'Hecho' }),
      tarea(2, null),
      tarea(3, 80, { type: 'Reunión' }),
      tarea(4, 70, { type: 'Recordatorio' }),
      tarea(5, 10),
      tarea(6, undefined),
      tarea(7, ''),
    ];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [5]);
  });

  test('el orden puede llegar como texto desde la base', () => {
    assert.deepEqual(sugeridas([tarea(1, '12.5000'), tarea(2, '84.5000')], HOY).map((t) => t.id), [2, 1]);
  });

  test('no repite lo que ya está a la vista', () => {
    const lista = [tarea(1, 90), tarea(2, 80), tarea(3, 70)];
    assert.deepEqual(sugeridas(lista, HOY, 5, [lista[0]]).map((t) => t.id), [2, 3]);
  });

  test('lista vacía o nula', () => {
    assert.deepEqual(sugeridas([], HOY), []);
    assert.deepEqual(sugeridas(null, HOY), []);
  });

  test('no cambia la lista original', () => {
    const lista = [tarea(1, 10), tarea(2, 90)];
    sugeridas(lista, HOY);
    assert.deepEqual(lista.map((t) => t.id), [1, 2]);
  });
});

describe('"retomar el"', () => {
  test('una fecha futura saca la tarea de las sugeridas; hoy o antes, no', () => {
    assert.equal(estaPospuesta(tarea(1, 50, { retomar_el: '2026-11-20' }), HOY), true);
    assert.equal(estaPospuesta(tarea(1, 50, { retomar_el: HOY }), HOY), false);
    assert.equal(estaPospuesta(tarea(1, 50, { retomar_el: '2026-11-01' }), HOY), false);
    assert.equal(estaPospuesta(tarea(1, 50), HOY), false);
    const lista = [tarea(1, 90, { retomar_el: '2026-11-20' }), tarea(2, 10)];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [2]);
  });

  test('no esconde una tarea cuya fecha límite llega antes (revisión 01)', () => {
    const conLimiteAntes = tarea(1, 90, { retomar_el: '2026-11-30', deadline: '2026-11-25' });
    const conLimiteDespues = tarea(2, 80, { retomar_el: '2026-11-20', deadline: '2026-11-28' });
    const conLimiteElMismoDia = tarea(3, 70, { retomar_el: '2026-11-20', deadline: '2026-11-20' });
    assert.equal(estaPospuesta(conLimiteAntes, HOY), false);
    assert.equal(estaPospuesta(conLimiteDespues, HOY), true);
    assert.equal(estaPospuesta(conLimiteElMismoDia, HOY), true);
    assert.deepEqual(sugeridas([conLimiteAntes, conLimiteDespues, conLimiteElMismoDia], HOY).map((t) => t.id), [1]);
  });

  test('las sugeridas no duplican lo que Hoy ya muestra por fecha', () => {
    const deHoy = tarea(1, 90, { deadline: HOY });
    const vencida = tarea(2, 80, { deadline: '2026-11-01' });
    const libre = tarea(3, 10);
    const lista = [deHoy, vencida, libre];
    const yaVisibles = gruposDeHoy(lista, HOY).flatMap((g) => g.tareas);
    assert.deepEqual(yaVisibles.map((t) => t.id).sort(), [1, 2]);
    assert.deepEqual(sugeridas(lista, HOY, 5, yaVisibles).map((t) => t.id), [3]);
  });
});

describe('vista Tareas con orden sugerido', () => {
  test('primero las que traen orden, de mayor a menor; luego las demás como antes', () => {
    const lista = [
      tarea(1, null, { priority: 'Muy alta' }),
      tarea(2, 12.5),
      tarea(3, 84.5, { priority: 'Baja' }),
      tarea(4, null, { priority: 'Media', deadline: '2026-11-13' }),
      tarea(5, 40),
    ];
    assert.deepEqual(tareasAbiertas(lista).map((t) => t.id), [3, 5, 2, 1, 4]);
  });

  test('sin ninguna con orden, el resultado es el de siempre', () => {
    const lista = [tarea(1, null, { priority: 'Media' }), tarea(2, null, { priority: 'Muy alta' })];
    assert.deepEqual(tareasAbiertas(lista).map((t) => t.id), [2, 1]);
  });
});

describe('prioridad en el detalle', () => {
  const completa = {
    id: 't', type: 'Tarea', puntaje: 84.52, impact_generar: 2, impact_proteger: 2, impact_politico: 1, impact_personal: 0,
    urgency_category: 'Fecha dura', esfuerzo: 'Grande', delegable: 'Parcial', me_esperan: true, retomar_el: '2026-12-01', grupo: 'Fiscal',
  };

  test('la base sin la migración no trae las columnas: no se ofrece la prioridad', () => {
    assert.equal(admitePrioridad({ id: 't', title: 'x' }), false);
    assert.equal(admitePrioridad({ id: 't', retomar_el: null }), true);
    assert.equal(admitePrioridad(null), false);
  });

  test('lo que se edita: retomar el y delegable', () => {
    assert.deepEqual(edicionPrioridad(completa), { retomarEl: '2026-12-01', delegable: 'Parcial' });
    assert.deepEqual(edicionPrioridad({ retomar_el: null, delegable: null }), { retomarEl: '', delegable: '' });
    assert.deepEqual(edicionPrioridad({ retomar_el: '2026-12-01T00:00:00' }), { retomarEl: '2026-12-01', delegable: '' });
  });

  test('lo que se guarda: vacío o fuera de catálogo se guarda como sin dato', () => {
    assert.deepEqual(cambiosPrioridad({ retomarEl: '2026-12-01', delegable: 'Delegable' }), { retomar_el: '2026-12-01', delegable: 'Delegable' });
    assert.deepEqual(cambiosPrioridad({ retomarEl: '', delegable: '' }), { retomar_el: null, delegable: null });
    assert.deepEqual(cambiosPrioridad({ retomarEl: '01/12/2026', delegable: 'Quizá' }), { retomar_el: null, delegable: null });
    assert.deepEqual(DELEGABLES, ['Solo yo', 'Parcial', 'Delegable']);
  });

  test('abrir y guardar sin tocar nada no cambia la prioridad', () => {
    assert.deepEqual(cambiosPrioridad(edicionPrioridad(completa)), { retomar_el: completa.retomar_el, delegable: completa.delegable });
  });

  test('guardar la prioridad no altera lo que ya se guardaba del compromiso', () => {
    const t = { id: 't', title: 'Algo', type: 'Tarea', priority: 'Alta', project_id: null, notes: null, time_estimated: 45, date_promised: null };
    const base = armarActualizacion(t, edicionDe(t));
    const conPrioridad = { ...base, ...cambiosPrioridad({ retomarEl: '2026-12-01', delegable: 'Parcial' }) };
    for (const clave of Object.keys(base)) assert.deepEqual(conPrioridad[clave], base[clave], clave);
    assert.deepEqual(Object.keys(conPrioridad).filter((k) => !(k in base)).sort(), ['delegable', 'retomar_el']);
  });

  test('datos de consulta, en lenguaje llano', () => {
    assert.deepEqual(datosDePrioridad(completa), [
      { nombre: 'Puntaje', valor: '84.5' },
      { nombre: 'Impacto (0 a 2)', valor: 'Generar 2 · Proteger 2 · Político 1 · Personal 0' },
      { nombre: 'Urgencia', valor: 'Fecha dura' },
      { nombre: 'Esfuerzo', valor: 'Grande' },
      { nombre: '¿Te esperan?', valor: 'Sí' },
      { nombre: 'Grupo', valor: 'Fiscal' },
    ]);
  });

  test('una tarea sin datos de prioridad no muestra nada; "no te esperan" sí se muestra', () => {
    assert.deepEqual(datosDePrioridad({ id: 't', retomar_el: null, puntaje: null, impact_generar: null, me_esperan: null }), []);
    assert.deepEqual(datosDePrioridad({ me_esperan: false }), [{ nombre: '¿Te esperan?', valor: 'No' }]);
    assert.deepEqual(datosDePrioridad({ puntaje: '12.5000' }), [{ nombre: 'Puntaje', valor: '12.5' }]);
  });
});

describe('respaldo con las columnas de prioridad', () => {
  const datos = {
    projects: [{ id: 'c1', user_id: 'u1', name: 'Trabajo', priority_order: 1 }],
    tasks: [{ id: 't1', user_id: 'u1', project_id: 'c1', title: 'Con prioridad', type: 'Tarea', puntaje: 84.5, orden_sugerido: 84.52, impact_generar: 2, grupo: 'Fiscal', origen: 'excel:1', lote_carga: 'l1', retomar_el: null }],
    subtasks: [],
  };

  test('la ficha nombra la migración de prioridad', async () => {
    assert.ok(ESQUEMA.includes('20261113_prioridad'));
    const r = await armarRespaldo(datos);
    assert.deepEqual(r.esquema, ESQUEMA);
  });

  test('las columnas nuevas viajan en el respaldo y se restauran', async () => {
    const r = await armarRespaldo(datos);
    assert.equal(validarRespaldo(r).ok, true);
    assert.equal((await verificarHuellas(r)).ok, true);
    const filas = filasParaRestaurar(r);
    assert.equal(filas.tasks[0].puntaje, 84.5);
    assert.equal(filas.tasks[0].origen, 'excel:1');
    assert.equal(filas.tasks[0].grupo, 'Fiscal');
    assert.ok(!('user_id' in filas.tasks[0]));
    const restaurado = { projects: datos.projects.map((p) => ({ ...p, user_id: 'u2' })), tasks: datos.tasks.map((t) => ({ ...t, user_id: 'u2' })), subtasks: [] };
    assert.equal((await compararConRespaldo(r, restaurado)).ok, true);
  });

  test('si un dato de prioridad cambia al restaurar, la comparación lo detecta', async () => {
    const r = await armarRespaldo(datos);
    const alterado = { projects: datos.projects, tasks: [{ ...datos.tasks[0], puntaje: 84.4 }], subtasks: [] };
    assert.equal((await compararConRespaldo(r, alterado)).ok, false);
  });

  test('un respaldo anterior, sin esas columnas, sigue comparando bien contra una base que ya las tiene', async () => {
    const viejo = await armarRespaldo({ projects: [], tasks: [{ id: 't1', user_id: 'u1', title: 'Vieja', type: 'Tarea' }], subtasks: [] });
    const enBaseNueva = { projects: [], tasks: [{ id: 't1', user_id: 'u2', title: 'Vieja', type: 'Tarea', puntaje: null, grupo: null, origen: null }], subtasks: [] };
    assert.equal((await compararConRespaldo(viejo, enBaseNueva)).ok, true);
  });
});

describe('migración de prioridad', () => {
  const sql = readFileSync(join(raiz, 'supabase/migrations/20261113_prioridad.sql'), 'utf8').replace(/\r\n/g, '\n');
  const activo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  test('solo agrega columnas e índices: no toca reglas, permisos ni columnas existentes', () => {
    assert.doesNotMatch(activo, /\b(drop|grant|revoke|policy|delete|update|truncate)\b/i);
    assert.equal((activo.match(/add column if not exists/g) || []).length, 14);
    // Ninguna columna nueva es obligatoria: las tareas que ya existen quedan igual.
    const columnas = activo.split('\n').filter((l) => l.includes('add column if not exists'));
    assert.ok(columnas.every((l) => !/not null/i.test(l)));
  });

  test('ninguna cuenta puede tener dos tareas con el mismo origen', () => {
    assert.match(activo, /create unique index if not exists tasks_origen_por_cuenta_idx\s+on public\.tasks \(user_id, origen\)\s+where origen is not null;/);
  });

  test('los catálogos de la base son los del Excel', () => {
    assert.match(activo, /urgency_category in \('Fecha dura', 'Ventana', 'Sin fecha'\)/);
    assert.match(activo, /esfuerzo in \('Rápido', 'Medio', 'Grande'\)/);
    assert.match(activo, /delegable in \('Solo yo', 'Parcial', 'Delegable'\)/);
    assert.equal((activo.match(/between 0 and 2/g) || []).length, 4);
  });

  test('trae su reversión', () => {
    assert.match(sql, /REVERSIÓN/);
    assert.equal((sql.match(/drop column if exists/g) || []).length, 14);
  });
});
