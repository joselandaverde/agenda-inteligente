// Bloques 1-A y 3-A: tareas sugeridas por puntaje calculado, datos de prioridad
// en el detalle y en la captura y la migración de columnas.
// Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sugeridas, estaPospuesta, gruposDeHoy, SUGERIDAS_EN_HOY } from '../../src/logica/agenda.mjs';
import { tareasAbiertas } from '../../src/logica/semana.mjs';
import { DELEGABLES, admitePrioridad, edicionPrioridad, cambiosPrioridad, datosDePrioridad, armarActualizacion, edicionDe } from '../../src/logica/detalle.mjs';
import {
  IMPACTOS, CAMPOS_IMPACTO, prioridadVacia, prioridadDe, columnasDePrioridad, tareaConPrioridad, cambioDePrioridad,
  cambiosDePrioridad, columnasParaCrear,
} from '../../src/logica/prioridad.mjs';
import { formularioVacio, armarCompromiso } from '../../src/logica/compromiso.mjs';
import { armarRespaldo, validarRespaldo, verificarHuellas, filasParaRestaurar, compararConRespaldo, ESQUEMA } from '../../src/logica/respaldo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOY = '2026-11-12';

// Impactos [Generar, Proteger, Político, Personal] y el puntaje que dan (sin urgencia).
const A = [2, 2, 2, 2]; // 100
const B = [2, 2, 2, 0]; // 75
const C = [2, 2, 0, 0]; // 55
const D = [2, 0, 0, 0]; // 30
const E = [0, 2, 0, 0]; // 25
const F = [0, 0, 2, 0]; // 20
const H = [1, 0, 0, 0]; // 15
const SIN = [null, null, null, null];

const tarea = (id, impactos, extra = {}) => ({
  id, title: 'T' + id, type: 'Tarea', state: 'Pendiente', priority: 'Media', date_promised: null, deadline: null,
  retomar_el: null, origen: 'excel:' + id,
  impact_generar: impactos[0], impact_proteger: impactos[1], impact_politico: impactos[2], impact_personal: impactos[3],
  ...extra,
});

describe('tareas sugeridas', () => {
  test('Hoy muestra cuatro: son las de mayor puntaje, de mayor a menor', () => {
    assert.equal(SUGERIDAS_EN_HOY, 4);
    const lista = [tarea(1, H), tarea(2, A), tarea(3, C), tarea(4, E), tarea(5, D), tarea(6, F), tarea(7, B)];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [2, 7, 3, 5]);
    assert.deepEqual(sugeridas(lista, HOY, 2).map((t) => t.id), [2, 7]);
    assert.deepEqual(sugeridas(lista, HOY, 6).map((t) => t.id), [2, 7, 3, 5, 4, 6]);
  });

  test('el orden se calcula; el número guardado en la base no cuenta', () => {
    const lista = [
      tarea(1, H, { puntaje: 99, orden_sugerido: 99 }),
      tarea(2, A, { puntaje: 1, orden_sugerido: 1 }),
      tarea(3, SIN, { puntaje: 90, orden_sugerido: 90 }),
    ];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [2, 1]);
  });

  test('con el mismo puntaje gana la más antigua: el menor número de la carga', () => {
    const lista = [tarea(9, C), tarea(3, C), tarea(21, C), tarea(1, H)];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [3, 9, 21, 1]);
  });

  test('esfuerzo rápido y que te esperen desempatan', () => {
    const lista = [tarea(1, C), tarea(2, C, { esfuerzo: 'Medio' }), tarea(3, C, { esfuerzo: 'Rápido' }), tarea(4, C, { me_esperan: true })];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [3, 2, 4, 1]);
  });

  test('sin número de carga, el desempate es el nombre', () => {
    const lista = [tarea(2, C, { origen: null, title: 'Zeta' }), tarea(1, C, { origen: null, title: 'Alfa' })];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.title), ['Alfa', 'Zeta']);
  });

  test('no entran las concluidas, las que no tienen ningún impacto ni lo que no es tarea', () => {
    const lista = [
      tarea(1, A, { state: 'Hecho' }),
      tarea(2, SIN),
      tarea(3, A, { type: 'Reunión' }),
      tarea(4, A, { type: 'Recordatorio' }),
      tarea(5, H),
      tarea(6, [undefined, undefined, undefined, undefined]),
      tarea(7, ['', '', '', '']),
    ];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [5]);
  });

  test('una tarea con un solo impacto lleno ya entra', () => {
    assert.deepEqual(sugeridas([tarea(1, [null, 1, null, null])], HOY).map((t) => t.id), [1]);
  });

  test('los impactos pueden llegar como texto desde la base', () => {
    assert.deepEqual(sugeridas([tarea(1, ['1', '0', '0', '0']), tarea(2, ['2', '2', '0', '0'])], HOY).map((t) => t.id), [2, 1]);
  });

  test('una fecha límite que se acerca sube la tarea, sin tocar nada', () => {
    const lista = [tarea(1, B), tarea(2, C, { deadline: '2026-12-20' })];
    assert.deepEqual(sugeridas(lista, '2026-11-12').map((t) => t.id), [1, 2]); // 75 contra 55
    assert.deepEqual(sugeridas(lista, '2026-12-20').map((t) => t.id), [2, 1]); // 75 contra 110
  });

  test('no repite lo que ya está a la vista', () => {
    const lista = [tarea(1, A), tarea(2, B), tarea(3, C)];
    assert.deepEqual(sugeridas(lista, HOY, 5, [lista[0]]).map((t) => t.id), [2, 3]);
  });

  test('lista vacía o nula', () => {
    assert.deepEqual(sugeridas([], HOY), []);
    assert.deepEqual(sugeridas(null, HOY), []);
  });

  test('no cambia la lista original', () => {
    const lista = [tarea(1, H), tarea(2, A)];
    sugeridas(lista, HOY);
    assert.deepEqual(lista.map((t) => t.id), [1, 2]);
  });
});

describe('"retomar el"', () => {
  test('una fecha futura saca la tarea de las sugeridas; hoy o antes, no', () => {
    assert.equal(estaPospuesta(tarea(1, C, { retomar_el: '2026-11-20' }), HOY), true);
    assert.equal(estaPospuesta(tarea(1, C, { retomar_el: HOY }), HOY), false);
    assert.equal(estaPospuesta(tarea(1, C, { retomar_el: '2026-11-01' }), HOY), false);
    assert.equal(estaPospuesta(tarea(1, C), HOY), false);
    const lista = [tarea(1, A, { retomar_el: '2026-11-20' }), tarea(2, H)];
    assert.deepEqual(sugeridas(lista, HOY).map((t) => t.id), [2]);
  });

  test('no esconde una tarea cuya fecha límite llega antes (revisión 01)', () => {
    const conLimiteAntes = tarea(1, A, { retomar_el: '2026-11-30', deadline: '2026-11-25' });
    const conLimiteDespues = tarea(2, B, { retomar_el: '2026-11-20', deadline: '2026-11-28' });
    const conLimiteElMismoDia = tarea(3, C, { retomar_el: '2026-11-20', deadline: '2026-11-20' });
    assert.equal(estaPospuesta(conLimiteAntes, HOY), false);
    assert.equal(estaPospuesta(conLimiteDespues, HOY), true);
    assert.equal(estaPospuesta(conLimiteElMismoDia, HOY), true);
    assert.deepEqual(sugeridas([conLimiteAntes, conLimiteDespues, conLimiteElMismoDia], HOY).map((t) => t.id), [1]);
  });

  test('las sugeridas no duplican lo que Hoy ya muestra por fecha', () => {
    const deHoy = tarea(1, A, { deadline: HOY });
    const vencida = tarea(2, B, { deadline: '2026-11-01' });
    const libre = tarea(3, H);
    const lista = [deHoy, vencida, libre];
    const yaVisibles = gruposDeHoy(lista, HOY).flatMap((g) => g.tareas);
    assert.deepEqual(yaVisibles.map((t) => t.id).sort(), [1, 2]);
    assert.deepEqual(sugeridas(lista, HOY, 5, yaVisibles).map((t) => t.id), [3]);
  });
});

describe('vista Tareas con el puntaje calculado', () => {
  test('primero las calificadas, de mayor a menor puntaje; luego las demás como antes', () => {
    const lista = [
      tarea(1, SIN, { priority: 'Muy alta' }),
      tarea(2, H),
      tarea(3, A, { priority: 'Baja' }),
      tarea(4, SIN, { priority: 'Media', deadline: '2026-11-13' }),
      tarea(5, D),
    ];
    assert.deepEqual(tareasAbiertas(lista, HOY).map((t) => t.id), [3, 5, 2, 1, 4]);
  });

  test('el puntaje guardado no cuenta: manda el calculado con la fecha del día', () => {
    const lista = [tarea(1, H, { orden_sugerido: 99 }), tarea(2, A, { orden_sugerido: 1 })];
    assert.deepEqual(tareasAbiertas(lista, HOY).map((t) => t.id), [2, 1]);
  });

  test('con el paso de los días cambia el orden', () => {
    const lista = [tarea(1, B), tarea(2, C, { deadline: '2026-12-20' })];
    assert.deepEqual(tareasAbiertas(lista, '2026-11-12').map((t) => t.id), [1, 2]); // 75 contra 55
    assert.deepEqual(tareasAbiertas(lista, '2026-12-19').map((t) => t.id), [2, 1]); // 75 contra 55 × 1.8 = 99
  });

  test('sin ninguna calificada, el resultado es el de siempre', () => {
    const lista = [tarea(1, SIN, { priority: 'Media' }), tarea(2, SIN, { priority: 'Muy alta' })];
    assert.deepEqual(tareasAbiertas(lista, HOY).map((t) => t.id), [2, 1]);
  });
});

describe('datos de prioridad: del formulario a la base y de vuelta', () => {
  const completa = {
    id: 't', type: 'Tarea', impact_generar: 2, impact_proteger: 2, impact_politico: 1, impact_personal: 0,
    urgency_category: 'Fecha dura', deadline: '2026-12-01', esfuerzo: 'Grande', me_esperan: true, progress: 40,
    delegable: 'Parcial', retomar_el: '2026-12-05', grupo: 'Fiscal',
  };

  test('los catálogos', () => {
    assert.deepEqual(IMPACTOS.map((i) => i.valor), ['', '0', '1', '2']);
    assert.deepEqual(CAMPOS_IMPACTO.map((c) => c.columna), ['impact_generar', 'impact_proteger', 'impact_politico', 'impact_personal']);
  });

  test('una tarea nueva no trae nada', () => {
    assert.deepEqual(prioridadVacia(), { generar: '', proteger: '', politico: '', personal: '', urgencia: '', fechaLimite: '', esfuerzo: '', meEsperan: '', avance: '' });
    assert.deepEqual(prioridadDe({}), prioridadVacia());
    assert.deepEqual(prioridadDe(null), prioridadVacia());
  });

  test('lo que se ve al abrir una tarea', () => {
    assert.deepEqual(prioridadDe(completa), {
      generar: '2', proteger: '2', politico: '1', personal: '0', urgencia: 'Fecha dura', fechaLimite: '2026-12-01',
      esfuerzo: 'Grande', meEsperan: 'si', avance: '40',
    });
    assert.equal(prioridadDe({ me_esperan: false }).meEsperan, 'no');
    assert.equal(prioridadDe({ impact_generar: 0 }).generar, '0');
    assert.equal(prioridadDe({ impact_generar: 7, urgency_category: 'x', esfuerzo: 'y' }).generar, '');
  });

  test('lo que se guarda: vacío o fuera de catálogo es "sin dato"', () => {
    assert.deepEqual(columnasDePrioridad(prioridadVacia()), {
      impact_generar: null, impact_proteger: null, impact_politico: null, impact_personal: null,
      urgency_category: null, deadline: null, esfuerzo: null, me_esperan: null, progress: null,
    });
    const e = { generar: '2', proteger: '0', politico: '', personal: '1', urgencia: 'Ventana', fechaLimite: '2026-12-01', esfuerzo: 'Medio', meEsperan: 'no', avance: '55' };
    assert.deepEqual(columnasDePrioridad(e), {
      impact_generar: 2, impact_proteger: 0, impact_politico: null, impact_personal: 1,
      urgency_category: 'Ventana', deadline: '2026-12-01', esfuerzo: 'Medio', me_esperan: false, progress: 55,
    });
    const raro = columnasDePrioridad({ generar: '9', urgencia: 'Quizá', fechaLimite: '01/12/2026', esfuerzo: 'Enorme', meEsperan: 'tal vez', avance: 'x' });
    assert.ok(Object.values(raro).every((v) => v === null));
  });

  test('el avance se limita de 0 a 100', () => {
    assert.equal(columnasDePrioridad({ avance: '250' }).progress, 100);
    assert.equal(columnasDePrioridad({ avance: '-5' }).progress, 0);
    assert.equal(columnasDePrioridad({ avance: '0' }).progress, 0);
  });

  test('abrir y guardar sin tocar nada no cambia ningún dato ni toca el puntaje de referencia', () => {
    const e = edicionPrioridad(completa);
    assert.equal(cambioDePrioridad(completa, e), false);
    const cambios = cambiosPrioridad(e, completa, '2026-11-13');
    assert.ok(!('puntaje' in cambios) && !('orden_sugerido' in cambios));
    assert.deepEqual(cambios, {
      impact_generar: 2, impact_proteger: 2, impact_politico: 1, impact_personal: 0, urgency_category: 'Fecha dura',
      deadline: '2026-12-01', esfuerzo: 'Grande', me_esperan: true, progress: 40, retomar_el: '2026-12-05', delegable: 'Parcial',
    });
    // y una tarea sin ningún dato queda igual de vacía
    const vacia = { id: 'v', type: 'Tarea', retomar_el: null };
    const c = cambiosPrioridad(edicionPrioridad(vacia), vacia, HOY);
    assert.ok(Object.values(c).every((v) => v === null));
  });

  test('cambiar algo que cuenta guarda también el puntaje y el orden de referencia', () => {
    const e = { ...edicionPrioridad(completa), generar: '0', esfuerzo: 'Rápido', meEsperan: 'si' };
    const c = cambiosPrioridad(e, completa, '2026-11-13');
    // impactos 0,2,1,0 = 35 ; faltan 18 días: ×1.15 = 40.25 → 40.3 ; orden 40.3 + 0.03 + 0.003
    assert.equal(c.puntaje, 40.3);
    assert.equal(c.orden_sugerido, 40.333);
  });

  test('cambiar solo el avance, "retomar el" o "delegable" no toca el puntaje de referencia', () => {
    const e = { ...edicionPrioridad(completa), avance: '90', retomarEl: '2026-12-09', delegable: 'Solo yo' };
    const c = cambiosPrioridad(e, completa, '2026-11-13');
    assert.equal(c.progress, 90);
    assert.ok(!('puntaje' in c));
  });

  test('borrar todos los impactos deja la tarea sin puntaje (referencia vacía)', () => {
    const e = { ...edicionPrioridad(completa), generar: '', proteger: '', politico: '', personal: '' };
    const c = cambiosPrioridad(e, completa, HOY);
    assert.equal(c.puntaje, null);
    assert.equal(c.orden_sugerido, null);
  });

  test('retomar el y delegable: fuera de catálogo se guardan como sin dato', () => {
    const c = cambiosPrioridad({ ...prioridadVacia(), retomarEl: '01/12/2026', delegable: 'Quizá' }, null, HOY);
    assert.equal(c.retomar_el, null);
    assert.equal(c.delegable, null);
    assert.deepEqual(DELEGABLES, ['Solo yo', 'Parcial', 'Delegable']);
    assert.deepEqual(edicionPrioridad({ retomar_el: '2026-12-01T00:00:00' }).retomarEl, '2026-12-01');
  });

  test('guardar la prioridad no altera lo que ya se guardaba del compromiso', () => {
    const t = { id: 't', title: 'Algo', type: 'Tarea', priority: 'Alta', project_id: null, notes: null, time_estimated: 45, date_promised: null, retomar_el: null };
    const base = armarActualizacion(t, edicionDe(t));
    const conPrioridad = { ...base, ...cambiosPrioridad({ ...edicionPrioridad(t), generar: '2', retomarEl: '2026-12-01', delegable: 'Parcial' }, t, HOY) };
    for (const clave of Object.keys(base)) assert.deepEqual(conPrioridad[clave], base[clave], clave);
  });

  test('la tarea con lo editado se puntúa al instante, sin guardar', () => {
    const t = tareaConPrioridad({ id: 't', type: 'Tarea' }, { ...prioridadVacia(), generar: '2', urgencia: 'Fecha dura' });
    assert.equal(t.impact_generar, 2);
    assert.equal(t.urgency_category, 'Fecha dura');
  });

  test('datos de consulta, en lenguaje llano', () => {
    assert.deepEqual(datosDePrioridad(completa, '2026-11-13'), [
      { nombre: 'Puntaje', valor: '74.8' }, // 65 × 1.15 = 74.75
      { nombre: 'De dónde sale', valor: 'Impacto 65 × urgencia 1.15 (faltan 18 días para la fecha límite)' },
      { nombre: 'Grupo', valor: 'Fiscal' },
    ]);
  });
});

describe('prioridad en la captura de una tarea nueva', () => {
  const llenar = (extra, prioridad = {}) => ({ ...formularioVacio('2026-11-13'), titulo: 'Algo', ...extra, prioridad: { ...prioridadVacia(), ...prioridad } });

  test('el formulario nace sin prioridad y una tarea sin ella se guarda como antes', () => {
    assert.deepEqual(formularioVacio('2026-11-13').prioridad, prioridadVacia());
    const r = armarCompromiso(llenar({}), '2026-11-13');
    for (const campo of ['impact_generar', 'impact_proteger', 'impact_politico', 'impact_personal', 'urgency_category', 'esfuerzo', 'me_esperan', 'progress', 'puntaje', 'orden_sugerido']) {
      assert.equal(campo in r.datos, false, campo);
    }
  });

  test('solo se guardan los datos que se llenaron, y el puntaje de referencia', () => {
    const r = armarCompromiso(llenar({}, { generar: '2', proteger: '1', esfuerzo: 'Rápido', meEsperan: 'si' }), '2026-11-13');
    assert.equal(r.datos.impact_generar, 2);
    assert.equal(r.datos.impact_proteger, 1);
    assert.equal('impact_politico' in r.datos, false);
    assert.equal(r.datos.esfuerzo, 'Rápido');
    assert.equal(r.datos.me_esperan, true);
    assert.equal(r.datos.puntaje, 42.5);
    assert.equal(r.datos.orden_sugerido, 42.533);
  });

  test('la fecha límite de la captura cuenta para el puntaje', () => {
    const r = armarCompromiso(llenar({ tieneFechaLimite: true, fechaLimite: '2026-11-14' }, { generar: '2' }), '2026-11-13');
    assert.equal(r.datos.deadline, '2026-11-14');
    assert.equal(r.datos.puntaje, 54); // 30 × 1.8
  });

  test('urgencia y avance sin impactos se guardan, pero sin puntaje', () => {
    const r = armarCompromiso(llenar({}, { urgencia: 'Ventana', avance: '20' }), '2026-11-13');
    assert.equal(r.datos.urgency_category, 'Ventana');
    assert.equal(r.datos.progress, 20);
    assert.equal('puntaje' in r.datos, false);
  });

  test('una tarea dividida en subtareas también puede calificarse', () => {
    const r = armarCompromiso(llenar({ tendraSubtareas: true, subtareas: [{ titulo: 'a', tiempo: 10 }] }, { generar: '1' }), '2026-11-13');
    assert.equal(r.datos.impact_generar, 1);
  });

  test('reuniones y recordatorios no guardan estos campos', () => {
    for (const tipo of ['Reunión', 'Recordatorio']) {
      const r = armarCompromiso(llenar({ tipo }, { generar: '2', urgencia: 'Fecha dura', esfuerzo: 'Rápido' }), '2026-11-13');
      for (const campo of ['impact_generar', 'urgency_category', 'esfuerzo', 'puntaje', 'progress']) assert.equal(campo in r.datos, false, tipo + ' ' + campo);
    }
  });

  test('columnasParaCrear: vacío no escribe nada', () => {
    assert.deepEqual(columnasParaCrear(prioridadVacia(), '2026-11-13'), {});
  });

  test('cambiosDePrioridad sin tarea solo trae las columnas', () => {
    assert.ok(!('puntaje' in cambiosDePrioridad(null, { ...prioridadVacia(), generar: '2' }, HOY)));
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
