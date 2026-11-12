// Respaldo y restauración (bloque 0-C). Sin red ni navegador: la base se
// sustituye por una en memoria que imita las consultas que se usan.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMATO, VERSION_FORMATO, TABLAS, armarRespaldo, huellaDe, columnasDe, nombreArchivo, validarRespaldo, verificarHuellas,
  filasParaRestaurar, compararConRespaldo, resumenCantidades, diasDesde, necesitaRespaldo, textoUltimoRespaldo, debeAvisar, leerArchivo,
} from '../../src/logica/respaldo.mjs';
import { leerDatos, restaurar, revisarAntesDeRestaurar } from '../../src/datos/respaldo.mjs';

const AHORA = new Date('2026-11-11T18:00:00Z');

function datosDe(usuario = 'u1') {
  return {
    projects: [
      { id: 'c1', user_id: usuario, name: 'Finanzas', priority_order: 1, context: 'Impuestos' },
      { id: 'c2', user_id: usuario, name: 'Casa', priority_order: 2, context: null },
    ],
    tasks: [
      { id: 't1', user_id: usuario, title: 'Reporte', type: 'Tarea', project_id: 'c1', state: 'Pendiente', date_promised: null, participantes: null },
      { id: 't2', user_id: usuario, title: 'Junta', type: 'Reunión', project_id: null, state: 'Hecho', date_promised: '2026-11-12T10:00:00', participantes: ['Ana', 'Luis'] },
    ],
    subtasks: [
      { id: 's1', user_id: usuario, task_id: 't1', title: 'Bajar estados', orden: 1, state: 'Hecho', time_estimated: 30 },
      { id: 's2', user_id: usuario, task_id: 't1', title: 'Conciliar', orden: 2, state: 'Pendiente', time_estimated: 45 },
    ],
  };
}

// Base en memoria con las consultas que usa el respaldo. `usuario` es la
// cuenta de la sesión: como la base real, solo deja ver y tocar lo propio.
function baseFalsa(inicial = {}, { usuario = 'u2', fallarEn = null, codigo = undefined } = {}) {
  const tablas = { projects: [], tasks: [], subtasks: [], ...JSON.parse(JSON.stringify(inicial)) };
  const escrituras = [];
  const from = (nombre) => {
    const c = { op: 'select', filtros: [], rango: null, datos: null };
    const propias = () => tablas[nombre].filter((f) => f.user_id === usuario);
    const api = {
      select: () => api,
      order: () => api,
      range: (a, b) => { c.rango = [a, b]; return api; },
      insert: (filas) => { c.op = 'insert'; c.datos = filas; return api; },
      delete: () => { c.op = 'delete'; return api; },
      in: (col, valores) => { c.filtros.push([col, valores]); return api; },
      then: (bien, mal) => Promise.resolve().then(() => {
        if (c.op === 'insert') {
          escrituras.push(nombre + ':' + c.datos.length);
          if (fallarEn === nombre) return { data: null, error: { message: 'fallo simulado', code: codigo } };
          tablas[nombre].push(...c.datos.map((f) => ({ user_id: usuario, ...f })));
          return { data: null, error: null };
        }
        if (c.op === 'delete') {
          const [col, valores] = c.filtros[0];
          tablas[nombre] = tablas[nombre].filter((f) => !(f.user_id === usuario && valores.includes(f[col])));
          return { data: null, error: null };
        }
        const filas = propias().sort((x, y) => String(x.id).localeCompare(String(y.id)));
        return { data: c.rango ? filas.slice(c.rango[0], c.rango[1] + 1) : filas, error: null };
      }).then(bien, mal),
    };
    return api;
  };
  return { from, tablas, escrituras };
}

describe('archivo de respaldo', () => {
  test('lleva ficha, cantidades, huellas y todas las filas con sus columnas', async () => {
    const r = await armarRespaldo(datosDe(), { ahora: AHORA, versionApp: 'I-2', base: 'produccion' });
    assert.equal(r.formato, FORMATO);
    assert.equal(r.version, VERSION_FORMATO);
    assert.equal(r.creado, '2026-11-11T18:00:00.000Z');
    assert.equal(r.app, 'I-2');
    assert.equal(r.base, 'produccion');
    assert.deepEqual(r.esquema, ['20261111_esquema_base', '20261103_ai_usage']);
    assert.deepEqual(r.cantidades, { projects: 2, tasks: 2, subtasks: 2 });
    assert.deepEqual(r.datos, datosDe());
    for (const tabla of TABLAS) assert.match(r.huellas[tabla], /^[0-9a-f]{64}$/);
    assert.equal(validarRespaldo(r).ok, true);
    assert.equal((await verificarHuellas(r)).ok, true);
  });

  test('sin datos también es un respaldo válido', async () => {
    const r = await armarRespaldo({}, { ahora: AHORA });
    assert.deepEqual(r.cantidades, { projects: 0, tasks: 0, subtasks: 0 });
    assert.equal(validarRespaldo(r).ok, true);
  });

  test('la huella no depende del orden de las filas ni de su dueño, pero sí del contenido', async () => {
    const a = datosDe('u1').tasks;
    const b = [...datosDe('otra-cuenta').tasks].reverse();
    assert.equal(await huellaDe(a), await huellaDe(b));
    const cambiada = datosDe().tasks;
    cambiada[0].title = 'Reporte.';
    assert.notEqual(await huellaDe(a), await huellaDe(cambiada));
  });

  test('nombre del archivo con la fecha local', () => {
    assert.equal(nombreArchivo(new Date(2026, 10, 11, 23, 59)), 'agenda-respaldo-2026-11-11.json');
    assert.equal(nombreArchivo(new Date(2027, 0, 5)), 'agenda-respaldo-2027-01-05.json');
  });
});

describe('validar un archivo recibido', () => {
  test('rechaza lo que no es un respaldo', () => {
    for (const cosa of [null, undefined, 'texto', 5, [], {}, { formato: 'otro' }, { formato: FORMATO, version: 1 }]) {
      const r = validarRespaldo(cosa);
      assert.equal(r.ok, false);
      assert.equal(typeof r.error, 'string');
    }
  });

  test('rechaza una versión desconocida', async () => {
    const r = await armarRespaldo(datosDe(), { ahora: AHORA });
    assert.match(validarRespaldo({ ...r, version: 2 }).error, /versión/);
  });

  test('rechaza tablas faltantes, filas sin identificador o repetidas y cantidades que no cuadran', async () => {
    const base = await armarRespaldo(datosDe(), { ahora: AHORA });
    const copia = () => JSON.parse(JSON.stringify(base));

    const sinTabla = copia(); delete sinTabla.datos.subtasks;
    assert.match(validarRespaldo(sinTabla).error, /subtareas/);

    const sinId = copia(); delete sinId.datos.tasks[0].id;
    assert.match(validarRespaldo(sinId).error, /sin identificador/);

    const repetida = copia(); repetida.datos.projects[1].id = 'c1';
    assert.match(validarRespaldo(repetida).error, /repetidas/);

    const menos = copia(); menos.datos.subtasks.pop();
    assert.match(validarRespaldo(menos).error, /no coincide con la ficha/);
  });

  test('rechaza relaciones rotas', async () => {
    const base = await armarRespaldo(datosDe(), { ahora: AHORA });
    const sinCategoria = JSON.parse(JSON.stringify(base)); sinCategoria.datos.tasks[0].project_id = 'no-existe';
    assert.match(validarRespaldo(sinCategoria).error, /categoría que no está/);
    const sinCompromiso = JSON.parse(JSON.stringify(base)); sinCompromiso.datos.subtasks[0].task_id = 'no-existe';
    assert.match(validarRespaldo(sinCompromiso).error, /compromiso que no está/);
  });

  test('un archivo modificado no pasa la comprobación de huellas', async () => {
    const r = await armarRespaldo(datosDe(), { ahora: AHORA });
    r.datos.tasks[0].title = 'Otro título';
    assert.equal(validarRespaldo(r).ok, true);
    const v = await verificarHuellas(r);
    assert.equal(v.ok, false);
    assert.match(v.error, /dañado o fue modificado/);
  });
});

describe('restaurar', () => {
  test('las filas a escribir no llevan dueño y conservan identificadores y relaciones', async () => {
    const r = await armarRespaldo(datosDe(), { ahora: AHORA });
    const filas = filasParaRestaurar(r);
    for (const tabla of TABLAS) {
      assert.equal(filas[tabla].some((f) => 'user_id' in f), false, tabla);
      assert.deepEqual(filas[tabla].map((f) => f.id), r.datos[tabla].map((f) => f.id));
    }
    assert.equal(filas.subtasks[0].task_id, 't1');
    assert.equal(filas.tasks[0].project_id, 'c1');
    assert.equal(r.datos.tasks[0].user_id, 'u1', 'el respaldo original no se altera');
  });

  test('ciclo completo: respaldar una cuenta y restaurar en otra vacía', async () => {
    const origen = baseFalsa(datosDe('u1'), { usuario: 'u1' });
    const leido = await leerDatos(origen);
    const respaldo = await armarRespaldo(leido.datos, { ahora: AHORA });
    const archivo = JSON.parse(JSON.stringify(respaldo)); // como al guardarlo y volver a abrirlo

    const destino = baseFalsa({}, { usuario: 'u2' });
    const r = await restaurar(destino, archivo);
    assert.deepEqual(r, { ok: true, error: null, cantidades: { projects: 2, tasks: 2, subtasks: 2 } });
    assert.deepEqual(destino.escrituras, ['projects:2', 'tasks:2', 'subtasks:2'], 'en orden: categorías, compromisos, subtareas');
    assert.equal(destino.tablas.tasks.every((t) => t.user_id === 'u2'), true, 'el dueño es la cuenta que restaura');
    assert.deepEqual(destino.tablas.subtasks.map((s) => s.task_id), ['t1', 't1']);
    assert.deepEqual(destino.tablas.tasks.find((t) => t.id === 't2').participantes, ['Ana', 'Luis']);
  });

  test('se niega si la cuenta ya tiene datos, sin escribir nada', async () => {
    const respaldo = await armarRespaldo(datosDe('u1'), { ahora: AHORA });
    const destino = baseFalsa({ projects: [{ id: 'x', user_id: 'u2', name: 'Ya había' }] }, { usuario: 'u2' });
    const r = await restaurar(destino, respaldo);
    assert.equal(r.ok, false);
    assert.match(r.error, /ya tiene datos/);
    assert.deepEqual(destino.escrituras, []);
    assert.equal(destino.tablas.projects.length, 1);
  });

  test('los datos de otra cuenta en la misma base no cuentan ni se tocan', async () => {
    const respaldo = await armarRespaldo(datosDe('u1'), { ahora: AHORA });
    const destino = baseFalsa({ tasks: [{ id: 'ajena', user_id: 'u9', title: 'De otra persona' }] }, { usuario: 'u2' });
    const r = await restaurar(destino, respaldo);
    assert.equal(r.ok, true);
    assert.equal(destino.tablas.tasks.some((t) => t.id === 'ajena' && t.user_id === 'u9'), true);
  });

  test('un archivo no válido o dañado no escribe nada', async () => {
    const destino = baseFalsa({}, { usuario: 'u2' });
    assert.equal((await restaurar(destino, { formato: 'otro' })).ok, false);
    const danado = await armarRespaldo(datosDe(), { ahora: AHORA });
    danado.datos.subtasks[0].title = 'cambiado';
    const r = await restaurar(destino, danado);
    assert.equal(r.ok, false);
    assert.match(r.error, /dañado o fue modificado/);
    assert.deepEqual(destino.escrituras, []);
  });

  test('si falla a la mitad, quita lo escrito y la cuenta queda vacía', async () => {
    const respaldo = await armarRespaldo(datosDe('u1'), { ahora: AHORA });
    const destino = baseFalsa({}, { usuario: 'u2', fallarEn: 'subtasks' });
    const r = await restaurar(destino, respaldo);
    assert.equal(r.ok, false);
    assert.match(r.error, /falló al escribir/);
    assert.match(r.error, /quedó vacía otra vez/);
    assert.deepEqual(destino.tablas, { projects: [], tasks: [], subtasks: [] });
  });

  test('si los datos ya existen en la base bajo otra cuenta, lo explica y no deja nada', async () => {
    const respaldo = await armarRespaldo(datosDe('u1'), { ahora: AHORA });
    const destino = baseFalsa({}, { usuario: 'u2', fallarEn: 'tasks', codigo: '23505' });
    const r = await restaurar(destino, respaldo);
    assert.equal(r.ok, false);
    assert.match(r.error, /ya existen en esta base, en otra cuenta/);
    assert.deepEqual(destino.tablas, { projects: [], tasks: [], subtasks: [] });
  });

  test('la revisión previa no escribe y dice lo mismo que la restauración', async () => {
    const respaldo = await armarRespaldo(datosDe('u1'), { ahora: AHORA });
    const vacia = baseFalsa({}, { usuario: 'u2' });
    assert.deepEqual(await revisarAntesDeRestaurar(vacia, respaldo), { ok: true, error: null });
    assert.deepEqual(vacia.escrituras, []);
    const ocupada = baseFalsa({ subtasks: [{ id: 'x', user_id: 'u2', task_id: 'y' }] }, { usuario: 'u2' });
    assert.match((await revisarAntesDeRestaurar(ocupada, respaldo)).error, /ya tiene datos/);
    assert.equal((await revisarAntesDeRestaurar(vacia, { ...respaldo, version: 9 })).ok, false);
  });

  test('comparación: detecta filas faltantes y contenido distinto; tolera columnas de más', async () => {
    const respaldo = await armarRespaldo(datosDe('u1'), { ahora: AHORA });
    const iguales = datosDe('u2');
    assert.equal((await compararConRespaldo(respaldo, iguales)).ok, true);

    const conColumnaNueva = datosDe('u2');
    conColumnaNueva.tasks.forEach((t) => { t.columna_futura = 'x'; });
    assert.equal((await compararConRespaldo(respaldo, conColumnaNueva)).ok, true);

    const falta = datosDe('u2'); falta.subtasks.pop();
    assert.deepEqual((await compararConRespaldo(respaldo, falta)).diferencias.map((d) => d.tabla), ['subtasks']);

    const distinto = datosDe('u2'); distinto.projects[0].name = 'Otra';
    const c = await compararConRespaldo(respaldo, distinto);
    assert.equal(c.ok, false);
    assert.equal(c.diferencias[0].motivo, 'el contenido no coincide');
  });

  test('lee más de mil filas por páginas', async () => {
    const muchas = Array.from({ length: 2300 }, (_, i) => ({ id: 't' + String(i).padStart(5, '0'), user_id: 'u1', title: 'T' + i, project_id: null }));
    const base = baseFalsa({ tasks: muchas }, { usuario: 'u1' });
    const { datos, error } = await leerDatos(base);
    assert.equal(error, null);
    assert.equal(datos.tasks.length, 2300);
    assert.equal(new Set(datos.tasks.map((t) => t.id)).size, 2300);
  });
});

describe('leer un archivo elegido', () => {
  test('acepta el texto de un respaldo, también con marca de orden de bytes', async () => {
    const texto = JSON.stringify(await armarRespaldo(datosDe(), { ahora: AHORA }), null, 2);
    assert.equal(leerArchivo(texto).error, null);
    assert.equal(leerArchivo('﻿' + texto).objeto.formato, FORMATO);
  });

  test('rechaza texto que no es un respaldo', () => {
    for (const texto of ['', 'hola', '{"a":1}', '[1,2]', '{"formato":"agenda-respaldo"', null]) {
      const r = leerArchivo(texto);
      assert.equal(r.objeto, null);
      assert.equal(typeof r.error, 'string');
    }
  });
});

describe('recordatorio', () => {
  test('columnas y resumen de cantidades', () => {
    assert.deepEqual(columnasDe([{ b: 1, a: 2 }, { c: 3 }]), ['a', 'b', 'c']);
    assert.equal(resumenCantidades({ projects: 1, tasks: 22, subtasks: 0 }), '1 categoría, 22 compromisos y 0 subtareas');
    assert.equal(resumenCantidades({ projects: 3, tasks: 1, subtasks: 1 }), '3 categorías, 1 compromiso y 1 subtarea');
  });

  test('días desde el último respaldo', () => {
    assert.equal(diasDesde('2026-11-11T17:00:00Z', AHORA), 0);
    assert.equal(diasDesde('2026-11-04T17:00:00Z', AHORA), 7);
    assert.equal(diasDesde('2026-11-03T17:00:00Z', AHORA), 8);
    for (const v of [null, undefined, '', 'ayer']) assert.equal(diasDesde(v, AHORA), null);
  });

  test('avisa si nunca se respaldó o pasaron más de 7 días, y solo si hay datos', () => {
    assert.equal(necesitaRespaldo(null, AHORA, true), true);
    assert.equal(necesitaRespaldo('2026-11-03T17:00:00Z', AHORA, true), true);
    assert.equal(necesitaRespaldo('2026-11-04T17:00:00Z', AHORA, true), false);
    assert.equal(necesitaRespaldo('2026-11-11T17:00:00Z', AHORA, true), false);
    assert.equal(necesitaRespaldo(null, AHORA, false), false);
  });

  test('el recordatorio se puede posponer siete días', () => {
    assert.equal(debeAvisar(null, null, AHORA, true), true);
    assert.equal(debeAvisar(null, '2026-11-10T17:00:00Z', AHORA, true), false, 'pospuesto ayer');
    assert.equal(debeAvisar(null, '2026-11-04T17:00:00Z', AHORA, true), true, 'pospuesto hace siete días');
    assert.equal(debeAvisar('2026-11-10T17:00:00Z', null, AHORA, true), false, 'respaldo reciente');
    assert.equal(debeAvisar('2026-10-01T17:00:00Z', '2026-10-02T17:00:00Z', AHORA, true), true);
    assert.equal(debeAvisar(null, null, AHORA, false), false, 'sin datos no hay nada que respaldar');
  });

  test('texto del último respaldo', () => {
    assert.match(textoUltimoRespaldo(null, AHORA), /Aún no has descargado/);
    assert.match(textoUltimoRespaldo('2026-11-11T10:00:00Z', AHORA), /hoy/);
    assert.match(textoUltimoRespaldo('2026-11-10T10:00:00Z', AHORA), /ayer/);
    assert.match(textoUltimoRespaldo('2026-11-01T10:00:00Z', AHORA), /hace 10 días/);
  });
});
