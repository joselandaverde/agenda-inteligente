// Categorías (src/logica/categorias.mjs y src/datos/categorias.mjs). Sin red ni
// navegador. Fija el comportamiento que tenía la gestión de categorías dentro
// de App.js: agregar en una posición, borrar, subir, bajar y describir.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  posicionValida, opcionesDePosicion, aRecorrerAlInsertar, aSubirAlBorrar, vecinaDeCategoria,
  abiertosPorCategoria, filtrarPorCategoria, tonoDe, textoAbiertos,
} from '../../src/logica/categorias.mjs';
import { agregarCategoria, borrarCategoria, moverCategoria, guardarDescripcion } from '../../src/datos/categorias.mjs';

const cat = (id, orden, extra = {}) => ({ id, name: 'Categoría ' + id, priority_order: orden, context: null, ...extra });
const tres = () => [cat('a', 1), cat('b', 2), cat('c', 3)];

// Base en memoria con lo mínimo que usan las funciones de escritura.
function baseFalsa(filas, { fallaAlInsertar = false, fallaAlBorrar = false } = {}) {
  let contador = 0;
  const tabla = filas.map((f) => ({ ...f }));
  const from = () => {
    const c = { op: 'select', datos: null, id: null };
    const api = {
      insert: (datos) => { c.op = 'insert'; c.datos = datos; return api; },
      update: (datos) => { c.op = 'update'; c.datos = datos; return api; },
      delete: () => { c.op = 'delete'; return api; },
      eq: (_col, val) => { c.id = val; return api; },
      then: (bien) => {
        let error = null;
        if (c.op === 'insert') {
          if (fallaAlInsertar) error = { message: 'sin permiso' };
          else tabla.push(...c.datos.map((d) => ({ id: 'n' + ++contador, context: null, ...d })));
        } else if (c.op === 'update') {
          tabla.filter((f) => f.id === c.id).forEach((f) => Object.assign(f, c.datos));
        } else if (c.op === 'delete') {
          if (fallaAlBorrar) error = { message: 'sin permiso' };
          else tabla.splice(0, tabla.length, ...tabla.filter((f) => f.id !== c.id));
        }
        return Promise.resolve({ data: null, error }).then(bien);
      },
    };
    return api;
  };
  const enOrden = () => [...tabla].sort((x, y) => x.priority_order - y.priority_order).map((f) => f.name + ':' + f.priority_order);
  return { from, tabla, enOrden };
}

describe('posición de una categoría nueva', () => {
  test('se acota entre 1 y el total más uno', () => {
    assert.equal(posicionValida('2', 3), 2);
    assert.equal(posicionValida('0', 3), 1);
    assert.equal(posicionValida('-4', 3), 1);
    assert.equal(posicionValida('abc', 3), 1);
    assert.equal(posicionValida('9', 3), 4);
    assert.equal(posicionValida('1', 0), 1);
  });

  test('las posiciones ofrecidas van de 1 al total más uno', () => {
    assert.deepEqual(opcionesDePosicion(0), ['1']);
    assert.deepEqual(opcionesDePosicion(3), ['1', '2', '3', '4']);
  });

  test('quiénes se recorren al insertar y al borrar', () => {
    assert.deepEqual(aRecorrerAlInsertar(tres(), 2).map((c) => c.id), ['b', 'c']);
    assert.deepEqual(aRecorrerAlInsertar(tres(), 4), []);
    assert.deepEqual(aSubirAlBorrar(tres(), 1).map((c) => c.id), ['b', 'c']);
    assert.deepEqual(aSubirAlBorrar(tres(), 3), []);
  });

  test('vecina al subir y al bajar; en los extremos no hay', () => {
    const lista = tres();
    assert.equal(vecinaDeCategoria(lista, lista[1], 'subir').id, 'a');
    assert.equal(vecinaDeCategoria(lista, lista[1], 'bajar').id, 'c');
    assert.equal(vecinaDeCategoria(lista, lista[0], 'subir'), null);
    assert.equal(vecinaDeCategoria(lista, lista[2], 'bajar'), null);
  });
});

describe('compromisos por categoría', () => {
  const tareas = [
    { id: 1, project_id: 'a', state: 'Pendiente' },
    { id: 2, project_id: 'a', state: 'Hecho' },
    { id: 3, project_id: 'b', state: 'Pendiente' },
    { id: 4, project_id: null, state: 'Pendiente' },
    { id: 5, project_id: 'a', state: 'En curso' },
  ];

  test('solo cuenta lo abierto', () => {
    assert.deepEqual(abiertosPorCategoria(tareas), { porId: { a: 2, b: 1 }, sinCategoria: 1, total: 4 });
    assert.deepEqual(abiertosPorCategoria([]), { porId: {}, sinCategoria: 0, total: 0 });
    assert.deepEqual(abiertosPorCategoria(null), { porId: {}, sinCategoria: 0, total: 0 });
  });

  test('filtrar por categoría; sin categoría elegida, todos', () => {
    assert.deepEqual(filtrarPorCategoria(tareas, 'a').map((t) => t.id), [1, 2, 5]);
    assert.equal(filtrarPorCategoria(tareas, '').length, 5);
    assert.deepEqual(filtrarPorCategoria(tareas, 'z'), []);
  });

  test('textos y tonos', () => {
    assert.equal(textoAbiertos(0), 'Sin compromisos abiertos');
    assert.equal(textoAbiertos(1), '1 abierto');
    assert.equal(textoAbiertos(4), '4 abiertos');
    assert.equal(tonoDe(0), 0);
    assert.equal(tonoDe(7), 1);
    assert.equal(tonoDe(-1), 5);
  });
});

describe('escritura de categorías', () => {
  test('agregar en medio recorre las de abajo', async () => {
    const base = baseFalsa(tres());
    const r = await agregarCategoria(base, tres(), '  Nueva  ', '2');
    assert.equal(r.error, null);
    assert.deepEqual(base.enOrden(), ['Categoría a:1', 'Nueva:2', 'Categoría b:3', 'Categoría c:4']);
  });

  test('agregar al final no mueve a nadie; una posición fuera de rango se acota', async () => {
    const base = baseFalsa(tres());
    await agregarCategoria(base, tres(), 'Última', '99');
    assert.deepEqual(base.enOrden(), ['Categoría a:1', 'Categoría b:2', 'Categoría c:3', 'Última:4']);
  });

  test('sin nombre no escribe nada', async () => {
    const base = baseFalsa(tres());
    const r = await agregarCategoria(base, tres(), '   ', '1');
    assert.ok(r.error);
    assert.deepEqual(base.enOrden(), ['Categoría a:1', 'Categoría b:2', 'Categoría c:3']);
  });

  test('si la base rechaza la nueva, devuelve el error', async () => {
    const base = baseFalsa(tres(), { fallaAlInsertar: true });
    const r = await agregarCategoria(base, tres(), 'Nueva', '4');
    assert.equal(r.error.message, 'sin permiso');
  });

  test('borrar sube las de abajo', async () => {
    const base = baseFalsa(tres());
    const lista = tres();
    const r = await borrarCategoria(base, lista, lista[0]);
    assert.equal(r.error, null);
    assert.deepEqual(base.enOrden(), ['Categoría b:1', 'Categoría c:2']);
  });

  test('si no se pudo borrar, no se reordena nada', async () => {
    const base = baseFalsa(tres(), { fallaAlBorrar: true });
    const lista = tres();
    const r = await borrarCategoria(base, lista, lista[0]);
    assert.equal(r.error.message, 'sin permiso');
    assert.deepEqual(base.enOrden(), ['Categoría a:1', 'Categoría b:2', 'Categoría c:3']);
  });

  test('subir y bajar intercambian con la vecina; en el extremo no pasa nada', async () => {
    const base = baseFalsa(tres());
    const lista = tres();
    await moverCategoria(base, lista, lista[2], 'subir');
    assert.deepEqual(base.enOrden(), ['Categoría a:1', 'Categoría c:2', 'Categoría b:3']);
    await moverCategoria(base, tres(), tres()[0], 'subir');
    assert.deepEqual(base.enOrden(), ['Categoría a:1', 'Categoría c:2', 'Categoría b:3']);
  });

  test('la descripción vacía se guarda como sin descripción', async () => {
    const base = baseFalsa(tres());
    await guardarDescripcion(base, 'b', 'Impuestos y bancos');
    assert.equal(base.tabla.find((f) => f.id === 'b').context, 'Impuestos y bancos');
    await guardarDescripcion(base, 'b', '');
    assert.equal(base.tabla.find((f) => f.id === 'b').context, null);
  });
});
