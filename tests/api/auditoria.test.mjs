// La función de IA anota el resultado de cada interpretación en el registro
// de acciones (bloque 0-D). Sin red ni credenciales: todo se simula.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearHandler, renglonDeInterpretacion } from '../../api/_lib/interpretar-core.mjs';

function respuestaFalsa() {
  const res = { statusCode: null, cuerpo: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.cuerpo = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

const IA_OK = JSON.stringify({ titulo: 'Reunión con Ana', tipo: 'Reunión', fecha: '2026-11-06', hora12: 10, minutos: '00', ampm: 'AM', importancia: 'Media', duracionMinutos: 60 });
const TEXTO = 'reunión con Ana el viernes a las 10 de la mañana, hablar del contrato confidencial';

function armar(extra = {}) {
  const anotados = [];
  const registros = [];
  const deps = {
    verificarToken: async (t) => (t === 'token-valido' ? { id: 'user-1' } : null),
    registrarUso: async () => ({ allowed: true, remaining: 29 }),
    llamarIA: async () => IA_OK,
    registrar: (e) => registros.push(JSON.parse(JSON.stringify(e))),
    anotar: async (token, renglon) => { anotados.push({ token, renglon }); },
    version: 'abc1234',
    ahora: () => new Date('2026-11-04T05:20:00Z'),
    ...extra,
  };
  return { deps, anotados, registros };
}

const peticion = ({ token = 'token-valido', texto = TEXTO } = {}) => ({ method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {}, body: { texto } });

describe('registro de la interpretación con IA', () => {
  test('una interpretación correcta deja un renglón "ok" con la sesión del usuario', async () => {
    const { deps, anotados, registros } = armar();
    const res = respuestaFalsa();
    await crearHandler(deps)(peticion(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(anotados.length, 1);
    assert.equal(anotados[0].token, 'token-valido');
    const r = anotados[0].renglon;
    assert.equal(r.actor, 'servidor');
    assert.equal(r.action, 'ia.interpretar');
    assert.equal(r.result, 'ok');
    assert.equal(r.app_version, 'abc1234');
    assert.equal(r.resource, null);
    assert.deepEqual(Object.keys(r.detail), ['ms']);
    assert.equal(registros[0].anotado, true);
  });

  test('el renglón nunca lleva el texto del usuario ni lo que respondió la IA', async () => {
    const { deps, anotados } = armar();
    await crearHandler(deps)(peticion(), respuestaFalsa());
    const todo = JSON.stringify(anotados[0].renglon);
    assert.doesNotMatch(todo, /Ana|contrato|confidencial|viernes/);
    assert.deepEqual(Object.keys(anotados[0].renglon).sort(), ['action', 'actor', 'app_version', 'detail', 'resource', 'result']);
  });

  test('el límite por hora deja un renglón "rechazado" con su motivo', async () => {
    const { deps, anotados } = armar({ registrarUso: async () => ({ allowed: false }) });
    const res = respuestaFalsa();
    await crearHandler(deps)(peticion(), res);
    assert.equal(res.statusCode, 429);
    assert.equal(anotados[0].renglon.result, 'rechazado');
    assert.equal(anotados[0].renglon.detail.motivo, 'limite_excedido');
  });

  test('si la IA no responde, queda un renglón "error"', async () => {
    const { deps, anotados } = armar({ llamarIA: async () => { throw new Error('gateway_500'); } });
    const res = respuestaFalsa();
    await crearHandler(deps)(peticion(), res);
    assert.equal(res.statusCode, 503);
    assert.equal(anotados[0].renglon.result, 'error');
    assert.equal(anotados[0].renglon.detail.motivo, 'ia_no_disponible');
  });

  test('sin sesión válida no se anota nada: no hay cuenta a la que atribuirlo', async () => {
    for (const token of [null, 'token-falso']) {
      const { deps, anotados } = armar();
      const res = respuestaFalsa();
      await crearHandler(deps)(peticion({ token }), res);
      assert.equal(res.statusCode, 401);
      assert.equal(anotados.length, 0);
    }
  });

  test('si no se puede anotar, la respuesta al usuario no cambia', async () => {
    const { deps, registros } = armar({ anotar: async () => { throw new Error('42501'); } });
    const res = respuestaFalsa();
    await crearHandler(deps)(peticion(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.cuerpo.titulo, 'Reunión con Ana');
    assert.equal(registros[0].anotado, false);
  });

  test('sin la función de anotar (ambiente sin registro) todo sigue como antes', async () => {
    const { deps, registros } = armar({ anotar: undefined });
    const res = respuestaFalsa();
    await crearHandler(deps)(peticion(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(registros[0].anotado, undefined);
  });
});

describe('renglón de una interpretación', () => {
  test('solo acepta resultados conocidos y motivos con forma de código', () => {
    assert.equal(renglonDeInterpretacion({ resultado: 'raro' }, 'v').result, 'error');
    assert.deepEqual(renglonDeInterpretacion({ resultado: 'ok', motivo: 'texto libre con espacios', ms: 12 }, 'v').detail, { ms: 12 });
    assert.deepEqual(renglonDeInterpretacion({ resultado: 'error', motivo: 'ia_formato', ms: -1 }, 'v').detail, { motivo: 'ia_formato' });
  });

  test('sin versión o sin evento no falla', () => {
    assert.equal(renglonDeInterpretacion({ resultado: 'ok' }, undefined).app_version, null);
    assert.equal(renglonDeInterpretacion(null, 'v').result, 'error');
    assert.equal(renglonDeInterpretacion({ resultado: 'ok' }, 'x'.repeat(100)).app_version.length, 60);
  });
});
