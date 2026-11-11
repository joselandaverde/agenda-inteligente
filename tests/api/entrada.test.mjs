// Pruebas del punto de entrada real (api/interpretar.mjs), tal como lo carga Vercel.
// Nacen del incidente del 2026-11-11: las pruebas del núcleo pasaban, pero la
// función fallaba al arrancar en Vercel (ERR_REQUIRE_ESM) porque nadie cargaba
// el archivo de entrada. No usan red ni credenciales.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuracionServidor, crearHandler } from '../../api/_lib/interpretar-core.mjs';

const raizApi = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api');

const VARIABLES = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_URL', 'REACT_APP_SUPABASE_ANON_KEY', 'AI_GATEWAY_API_KEY'];

// Carga una copia nueva del punto de entrada con el ambiente indicado. El
// sufijo cambia la dirección del módulo para que Node no reutilice la anterior.
let copia = 0;
async function cargarEntrada(env) {
  const previo = {};
  for (const v of VARIABLES) { previo[v] = process.env[v]; delete process.env[v]; }
  Object.assign(process.env, env);
  try {
    return (await import(`../../api/interpretar.mjs?copia=${++copia}`)).default;
  } finally {
    for (const v of VARIABLES) {
      if (previo[v] === undefined) delete process.env[v]; else process.env[v] = previo[v];
    }
  }
}

const AMBIENTE = {
  REACT_APP_SUPABASE_URL: 'https://abcdefghij.supabase.co',
  REACT_APP_SUPABASE_ANON_KEY: 'llave-publica-de-prueba',
  AI_GATEWAY_API_KEY: 'llave-de-ia-de-prueba',
};

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
    assert.equal(typeof (await cargarEntrada(AMBIENTE)), 'function');
  });

  test('GET responde 405 sin tocar la red', async () => {
    const handler = await cargarEntrada(AMBIENTE);
    const res = respuestaFalsa();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 405);
  });

  test('POST sin token responde 401 sin tocar la red', async () => {
    const handler = await cargarEntrada(AMBIENTE);
    const res = respuestaFalsa();
    await handler({ method: 'POST', headers: {}, body: { texto: 'hola' } }, res);
    assert.equal(res.statusCode, 401);
  });

  test('sin variables del ambiente responde 503, incluso con token, sin tocar la red', async () => {
    const handler = await cargarEntrada({});
    for (const headers of [{}, { authorization: 'Bearer cualquiera' }]) {
      const res = respuestaFalsa();
      await handler({ method: 'POST', headers, body: { texto: 'hola' } }, res);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.cuerpo, { error: 'Servicio no configurado' });
    }
  });

  test('con la base configurada pero sin llave de IA también responde 503', async () => {
    const handler = await cargarEntrada({ ...AMBIENTE, AI_GATEWAY_API_KEY: '' });
    const res = respuestaFalsa();
    await handler({ method: 'POST', headers: { authorization: 'Bearer cualquiera' }, body: { texto: 'hola' } }, res);
    assert.equal(res.statusCode, 503);
  });
});

describe('configuración del servidor', () => {
  test('completa con los nombres de la app', () => {
    const c = configuracionServidor(AMBIENTE);
    assert.equal(c.ok, true);
    assert.equal(c.url, 'https://abcdefghij.supabase.co');
    assert.equal(c.llave, 'llave-publica-de-prueba');
    assert.deepEqual(c.faltantes, []);
  });

  test('los nombres propios del servidor tienen preferencia', () => {
    const c = configuracionServidor({ ...AMBIENTE, SUPABASE_URL: 'https://zyxwvutsrq.supabase.co/', SUPABASE_ANON_KEY: 'otra' });
    assert.equal(c.url, 'https://zyxwvutsrq.supabase.co');
    assert.equal(c.llave, 'otra');
  });

  test('incompleta: lista nombres de variables, nunca valores, y no entrega nada', () => {
    const c = configuracionServidor({ REACT_APP_SUPABASE_URL: 'http://no-https.supabase.co', REACT_APP_SUPABASE_ANON_KEY: 'k' });
    assert.equal(c.ok, false);
    assert.deepEqual(c.faltantes, ['REACT_APP_SUPABASE_URL', 'AI_GATEWAY_API_KEY']);
    assert.equal(c.url, '');
    assert.equal(c.llave, '');
    assert.deepEqual(configuracionServidor().faltantes, ['REACT_APP_SUPABASE_URL', 'REACT_APP_SUPABASE_ANON_KEY', 'AI_GATEWAY_API_KEY']);
  });

  test('el handler sin configuración no verifica sesión, no cuenta uso ni llama a la IA', async () => {
    const llamadas = [];
    const registros = [];
    const handler = crearHandler({
      verificarToken: async () => { llamadas.push('token'); return { id: 'u' }; },
      registrarUso: async () => { llamadas.push('uso'); return { allowed: true }; },
      llamarIA: async () => { llamadas.push('ia'); return '{}'; },
      registrar: (e) => registros.push(JSON.parse(JSON.stringify(e))),
      configuracion: { ok: false, faltantes: ['AI_GATEWAY_API_KEY'] },
    });
    const res = respuestaFalsa();
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { texto: 'hola' } }, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(llamadas, []);
    assert.equal(registros[0].motivo, 'sin_configuracion');
    assert.deepEqual(registros[0].faltantes, ['AI_GATEWAY_API_KEY']);
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
