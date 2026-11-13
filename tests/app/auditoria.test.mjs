// Registro de acciones (bloque 0-D): src/logica/auditoria.mjs y
// src/datos/auditoria.mjs. Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCIONES, armarRenglon, limpiarDetalle, versionCorta, describir, cuandoFue } from '../../src/logica/auditoria.mjs';
import { anotar, leerActividad } from '../../src/datos/auditoria.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Base en memoria con lo mínimo que usa el registro.
function baseFalsa({ falla = null, lanza = false } = {}) {
  const filas = [];
  const from = (tabla) => {
    const c = { op: 'select', datos: null, limite: null };
    const api = {
      insert: (datos) => { c.op = 'insert'; c.datos = datos; return api; },
      select: () => api,
      order: () => api,
      limit: (n) => { c.limite = n; return api; },
      then: (bien, mal) => {
        if (lanza) return Promise.reject(new Error('sin red')).then(bien, mal);
        if (falla) return Promise.resolve({ data: null, error: falla }).then(bien, mal);
        if (c.op === 'insert') {
          filas.push(...c.datos.map((d, i) => ({ id: 'r' + (filas.length + i + 1), tabla, ...d })));
          return Promise.resolve({ data: null, error: null }).then(bien, mal);
        }
        return Promise.resolve({ data: [...filas].reverse().slice(0, c.limite || filas.length), error: null }).then(bien, mal);
      },
    };
    return api;
  };
  return { from, filas };
}

describe('renglón del registro', () => {
  test('lleva actor, acción, recurso, resultado, detalle y versión', () => {
    assert.deepEqual(
      armarRenglon({ accion: ACCIONES.COMPROMISO_BORRAR, recurso: 'tasks:abc', detalle: { tipo: 'Tarea' }, version: 'I-4 · 3d134ed' }),
      { actor: 'app', action: 'compromiso.borrar', resource: 'tasks:abc', result: 'ok', detail: { tipo: 'Tarea' }, app_version: 'I-4 · 3d134ed' }
    );
  });

  test('valores por defecto y valores fuera de catálogo', () => {
    const r = armarRenglon({ accion: 'x', resultado: 'inventado', actor: 'otro' });
    assert.equal(r.result, 'error');
    assert.equal(r.actor, 'app');
    assert.equal(r.resource, null);
    assert.equal(r.app_version, null);
    assert.deepEqual(r.detail, {});
    assert.equal(armarRenglon({ accion: 'x', actor: 'servidor' }).actor, 'servidor');
  });

  test('sin acción no hay renglón', () => {
    assert.equal(armarRenglon({}), null);
    assert.equal(armarRenglon({ accion: '   ' }), null);
    assert.equal(armarRenglon(), null);
  });

  test('textos largos se recortan a lo que acepta la tabla', () => {
    const r = armarRenglon({ accion: 'a'.repeat(200), recurso: 'b'.repeat(300), version: 'c'.repeat(100) });
    assert.equal(r.action.length, 60);
    assert.equal(r.resource.length, 120);
    assert.equal(r.app_version.length, 60);
  });

  test('el renglón no lleva dueño, fecha ni identificador: los pone la base', () => {
    const r = armarRenglon({ accion: ACCIONES.RESPALDO_DESCARGAR });
    for (const columna of ['id', 'user_id', 'created_at']) assert.ok(!(columna in r), columna);
  });
});

describe('el detalle nunca guarda contenido', () => {
  test('solo pasan los datos previstos', () => {
    const d = limpiarDetalle({
      cantidades: { projects: 3, tasks: 23, subtasks: 15, otra: 9 },
      origen: 'pruebas', destino: 'produccion', tipo: 'Tarea', sin_categoria: 3, ms: 420, motivo: 'no_completada',
      titulo: 'Pagar la hipoteca', notas: 'cuenta 1234', texto: 'dictado completo', cualquiera: { a: 1 },
    });
    assert.deepEqual(d, { cantidades: { projects: 3, tasks: 23, subtasks: 15 }, origen: 'pruebas', destino: 'produccion', tipo: 'Tarea', sin_categoria: 3, ms: 420, motivo: 'no_completada' });
  });

  test('valores con forma inesperada se descartan', () => {
    assert.deepEqual(limpiarDetalle({ cantidades: { tasks: -1, projects: 'tres' }, origen: 'otra', tipo: 'Secreto', sin_categoria: 1.5, ms: '12', motivo: 'Texto libre del usuario' }), {});
    assert.deepEqual(limpiarDetalle(null), {});
    assert.deepEqual(limpiarDetalle('texto'), {});
    assert.deepEqual(limpiarDetalle({ origen: 'constructor' }), {});
  });

  test('un título metido como motivo no entra', () => {
    assert.deepEqual(limpiarDetalle({ motivo: 'Junta con el contador' }), {});
  });
});

describe('versión que queda anotada', () => {
  test('versión visible y commit corto', () => {
    assert.equal(versionCorta('I-4', '3d134edf147164d4e4c53c23ccb5dda9ab5cd1b3'), 'I-4 · 3d134ed');
    assert.equal(versionCorta('I-4', undefined), 'I-4');
    assert.equal(versionCorta('', ''), null);
  });
});

describe('anotar y leer', () => {
  test('anotar escribe el renglón armado', async () => {
    const base = baseFalsa();
    const r = await anotar(base, { accion: ACCIONES.CATEGORIA_BORRAR, recurso: 'projects:c1', detalle: { sin_categoria: 2 }, version: 'v' });
    assert.equal(r.error, null);
    assert.equal(base.filas.length, 1);
    assert.equal(base.filas[0].tabla, 'audit_log');
    assert.equal(base.filas[0].action, 'categoria.borrar');
    assert.deepEqual(base.filas[0].detail, { sin_categoria: 2 });
  });

  test('si la base rechaza, devuelve el error sin lanzar', async () => {
    const r = await anotar(baseFalsa({ falla: { code: '42501', message: 'sin permiso' } }), { accion: 'x' });
    assert.equal(r.error.code, '42501');
  });

  test('si no hay red, devuelve el error sin lanzar', async () => {
    const r = await anotar(baseFalsa({ lanza: true }), { accion: 'x' });
    assert.equal(r.error.message, 'sin red');
  });

  test('una acción no válida no llega a la base', async () => {
    const base = baseFalsa();
    const r = await anotar(base, {});
    assert.ok(r.error);
    assert.equal(base.filas.length, 0);
  });

  test('leer devuelve lo más reciente primero y respeta el límite', async () => {
    const base = baseFalsa();
    for (const accion of ['uno', 'dos', 'tres']) await anotar(base, { accion });
    const { renglones, error } = await leerActividad(base, 2);
    assert.equal(error, null);
    assert.deepEqual(renglones.map((r) => r.action), ['tres', 'dos']);
  });

  test('si la tabla no existe todavía, leer devuelve lista vacía y el error', async () => {
    const { renglones, error } = await leerActividad(baseFalsa({ falla: { code: 'PGRST205', message: 'no existe' } }));
    assert.deepEqual(renglones, []);
    assert.equal(error.code, 'PGRST205');
    assert.deepEqual((await leerActividad(baseFalsa({ lanza: true }))).renglones, []);
  });
});

describe('lenguaje llano', () => {
  test('respaldo descargado', () => {
    assert.deepEqual(describir({ action: 'respaldo.descargar', result: 'ok', detail: { cantidades: { projects: 3, tasks: 23, subtasks: 15 } } }), { titulo: 'Descargaste un respaldo', detalle: '3 categorías, 23 compromisos y 15 subtareas', alerta: false });
  });

  test('restauración entre bases distintas: lo dice', () => {
    const d = describir({ action: 'respaldo.restaurar', result: 'ok', detail: { cantidades: { projects: 1, tasks: 1, subtasks: 0 }, origen: 'pruebas', destino: 'produccion' } });
    assert.equal(d.titulo, 'Restauraste un respaldo');
    assert.equal(d.detalle, '1 categoría, 1 compromiso y 0 subtareas · el archivo venía de la base de pruebas y se restauró en producción');
  });

  test('restauración en la misma base y restauración fallida', () => {
    assert.match(describir({ action: 'respaldo.restaurar', result: 'ok', detail: { origen: 'pruebas', destino: 'pruebas' } }).detalle, /archivo de la base de pruebas$/);
    const mal = describir({ action: 'respaldo.restaurar', result: 'error', detail: {} });
    assert.equal(mal.titulo, 'Una restauración no se completó');
    assert.equal(mal.alerta, true);
  });

  test('borrados', () => {
    assert.equal(describir({ action: 'compromiso.borrar', result: 'ok', detail: { tipo: 'Reunión' } }).titulo, 'Borraste una reunión');
    assert.equal(describir({ action: 'compromiso.borrar', result: 'ok', detail: { tipo: 'Recordatorio' } }).titulo, 'Borraste un recordatorio');
    assert.equal(describir({ action: 'compromiso.borrar', result: 'ok', detail: {} }).titulo, 'Borraste un compromiso');
    assert.equal(describir({ action: 'categoria.borrar', result: 'ok', detail: { sin_categoria: 3 } }).detalle, '3 compromisos quedaron sin categoría');
    assert.equal(describir({ action: 'categoria.borrar', result: 'ok', detail: { sin_categoria: 1 } }).detalle, '1 compromiso quedó sin categoría');
    assert.equal(describir({ action: 'categoria.borrar', result: 'ok', detail: { sin_categoria: 0 } }).detalle, '');
  });

  test('interpretación con IA: bien, rechazada y fallida', () => {
    assert.deepEqual(describir({ action: 'ia.interpretar', result: 'ok', detail: { ms: 900 } }), { titulo: 'Interpretación con IA', detalle: '', alerta: false });
    assert.deepEqual(describir({ action: 'ia.interpretar', result: 'rechazado', detail: { motivo: 'limite_excedido' } }), { titulo: 'Interpretación con IA rechazada', detalle: 'se alcanzó el límite por hora', alerta: true });
    assert.equal(describir({ action: 'ia.interpretar', result: 'error', detail: { motivo: 'ia_no_disponible' } }).titulo, 'Interpretación con IA fallida');
  });

  test('una acción desconocida o un renglón incompleto no rompen la lista', () => {
    assert.equal(describir({ action: 'algo.nuevo', result: 'ok' }).titulo, 'algo.nuevo');
    assert.equal(describir(null).titulo, 'Acción desconocida');
    assert.equal(describir({ action: 'respaldo.descargar', result: 'ok', detail: null }).detalle, '');
  });

  test('cuándo fue: hoy, otro día y otro año', () => {
    const ahora = new Date(2026, 10, 12, 23, 0);
    assert.equal(cuandoFue(new Date(2026, 10, 12, 22, 15).toISOString(), ahora), 'hoy, 10:15 p. m.');
    assert.equal(cuandoFue(new Date(2026, 10, 3, 0, 5).toISOString(), ahora), '3 nov, 12:05 a. m.');
    assert.equal(cuandoFue(new Date(2025, 11, 31, 12, 0).toISOString(), ahora), '31 dic de 2025, 12:00 p. m.');
    assert.equal(cuandoFue('no es fecha', ahora), '');
  });
});

describe('migración del registro', () => {
  const sql = readFileSync(join(raiz, 'supabase/migrations/20261112_audit_log.sql'), 'utf8');

  test('la seguridad por fila está activa y solo hay reglas para leer y agregar', () => {
    assert.match(sql, /alter table public\.audit_log enable row level security;/);
    const reglas = [...sql.matchAll(/create policy "[^"]+"\s+on public\.audit_log for (\w+)/g)].map((m) => m[1]).sort();
    assert.deepEqual(reglas, ['insert', 'select']);
  });

  test('el usuario no recibe permiso para cambiar ni borrar, ni para fijar dueño o fecha', () => {
    assert.match(sql, /revoke all on public\.audit_log from anon, authenticated;/);
    const permisos = sql.split('\n').filter((l) => /^grant /.test(l));
    assert.equal(permisos.length, 2);
    assert.ok(permisos.every((l) => !/update|delete|truncate|\ball\b/i.test(l)), permisos.join(' | '));
    const insertar = permisos.find((l) => /^grant insert/.test(l));
    assert.match(insertar, /^grant insert \(actor, action, resource, result, detail, app_version\) on public\.audit_log to authenticated;$/);
  });

  test('las reglas comparan con la cuenta de la sesión', () => {
    assert.equal((sql.match(/user_id = \(select auth\.uid\(\)\)/g) || []).length, 2);
  });
});
