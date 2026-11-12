// Configuración por ambiente de la app (src/configuracion.mjs). Sin red.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerConfiguracion, esLlaveSecreta, VARIABLES } from '../../src/configuracion.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VALIDA = { url: 'https://abcdefghij.supabase.co', llave: 'sb_publishable_ejemplo', base: 'pruebas' };

// Un JWT de ejemplo con el rol indicado (sin firma real).
function jwtConRol(role) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ role })}.firma`;
}

describe('configuración de la app', () => {
  test('configuración completa: lista para usarse', () => {
    const c = leerConfiguracion(VALIDA);
    assert.equal(c.ok, true);
    assert.equal(c.url, 'https://abcdefghij.supabase.co');
    assert.equal(c.base, 'pruebas');
    assert.equal(c.nombreBase, 'pruebas');
    assert.deepEqual(c.problemas, []);
  });

  test('acepta espacios, diagonal final y mayúsculas en el nombre de la base', () => {
    const c = leerConfiguracion({ url: ' https://abcdefghij.supabase.co/ ', llave: ' k ', base: ' Produccion ' });
    assert.equal(c.ok, true);
    assert.equal(c.url, 'https://abcdefghij.supabase.co');
    assert.equal(c.llave, 'k');
    assert.equal(c.nombreBase, 'producción');
  });

  test('sin variables: no está lista y dice cuáles faltan', () => {
    for (const datos of [undefined, {}, { url: '', llave: '', base: '' }, { url: null, llave: 5, base: {} }]) {
      const c = leerConfiguracion(datos);
      assert.equal(c.ok, false);
      assert.deepEqual(c.problemas.map((p) => p.variable), [VARIABLES.url, VARIABLES.llave, VARIABLES.base]);
      assert.equal(c.url, '');
      assert.equal(c.llave, '');
    }
  });

  test('si falta una sola, no entrega ni dirección ni llave (falla cerrado)', () => {
    const c = leerConfiguracion({ ...VALIDA, base: undefined });
    assert.equal(c.ok, false);
    assert.equal(c.url, '');
    assert.equal(c.llave, '');
    assert.deepEqual(c.problemas.map((p) => p.variable), [VARIABLES.base]);
  });

  test('rechaza direcciones que no son de Supabase o no usan https', () => {
    for (const url of ['http://abcdefghij.supabase.co', 'https://supabase.co.malo.com', 'https://abc.supabase.co/rest', 'abcdefghij.supabase.co', 'https://ejemplo.com']) {
      assert.equal(leerConfiguracion({ ...VALIDA, url }).ok, false, url);
    }
  });

  test('rechaza un nombre de base desconocido', () => {
    for (const base of ['prod', 'test', 'producción ', 'desarrollo']) {
      const c = leerConfiguracion({ ...VALIDA, base });
      assert.equal(c.ok, false, base);
    }
  });

  test('una llave secreta nunca se acepta en la app', () => {
    assert.equal(esLlaveSecreta('sb_secret_abc'), true);
    assert.equal(esLlaveSecreta(jwtConRol('service_role')), true);
    assert.equal(esLlaveSecreta(jwtConRol('anon')), false);
    assert.equal(esLlaveSecreta('sb_publishable_abc'), false);
    assert.equal(esLlaveSecreta('a.b.c'), false);
    for (const llave of ['sb_secret_abc', jwtConRol('service_role')]) {
      const c = leerConfiguracion({ ...VALIDA, llave });
      assert.equal(c.ok, false);
      assert.match(c.problemas[0].motivo, /secreta/);
      assert.equal(c.llave, '');
    }
  });
});

describe('el código no trae direcciones ni llaves fijas', () => {
  function archivosDe(dir) {
    return readdirSync(dir).flatMap((nombre) => {
      const ruta = join(dir, nombre);
      return statSync(ruta).isDirectory() ? archivosDe(ruta) : [ruta];
    });
  }

  test('ni src/ ni api/ contienen un proyecto o una llave de Supabase', () => {
    const fijos = [];
    for (const carpeta of ['src', 'api']) {
      for (const archivo of archivosDe(join(raiz, carpeta))) {
        const contenido = readFileSync(archivo, 'utf8');
        if (/https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(contenido)) fijos.push(archivo + ' (dirección)');
        if (/sb_(publishable|secret)_[A-Za-z0-9_-]{20,}/.test(contenido)) fijos.push(archivo + ' (llave)');
        if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(contenido)) fijos.push(archivo + ' (token)');
      }
    }
    assert.deepEqual(fijos, []);
  });
});
