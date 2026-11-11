// Pruebas del punto de entrada real (api/interpretar.mjs), tal como lo carga Vercel.
// Nacen del incidente del 2026-11-11: las pruebas del núcleo pasaban, pero la
// función fallaba al arrancar en Vercel (ERR_REQUIRE_ESM) porque nadie cargaba
// el archivo de entrada. No usan red ni credenciales.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizApi = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api');

function respuestaFalsa() {
  const res = { statusCode: null, cuerpo: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.cuerpo = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

function archivosDe(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : [ruta];
  });
}

describe('punto de entrada api/interpretar.mjs', () => {
  test('carga como módulo ES y exporta una función', async () => {
    const modulo = await import('../../api/interpretar.mjs');
    assert.equal(typeof modulo.default, 'function');
  });

  test('GET responde 405 sin tocar la red', async () => {
    const { default: handler } = await import('../../api/interpretar.mjs');
    const res = respuestaFalsa();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 405);
  });

  test('POST sin token responde 401 sin tocar la red', async () => {
    const { default: handler } = await import('../../api/interpretar.mjs');
    const res = respuestaFalsa();
    await handler({ method: 'POST', headers: {}, body: { texto: 'hola' } }, res);
    assert.equal(res.statusCode, 401);
  });
});

describe('formato de módulos en api/', () => {
  test('todo el código de api/ usa extensión .mjs', () => {
    // Un .js con sintaxis import/export en api/ es convertido a CommonJS por
    // Vercel y no puede cargar los .mjs: la función muere al arrancar.
    const ajenos = archivosDe(raizApi).filter((f) => /\.(js|cjs|ts)$/.test(f));
    assert.deepEqual(ajenos, [], 'archivos en api/ que no son .mjs: ' + ajenos.join(', '));
  });
});
