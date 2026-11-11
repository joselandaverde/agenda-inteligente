// Datos imposibles o ambiguos: la app debe avisar en lugar de adivinar.
// Nace de la prueba de uso del 2026-11-11: "mañana a las 25" se interpretó
// como las 12 sin ningún aviso. Sin red ni credenciales.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearHandler,
  construirAdvertencias,
  construirPrompt,
  detectarHoraImposible,
  redondearMinutos,
  validarRespuestaIA,
} from '../../api/_lib/interpretar-core.mjs';

function respuestaFalsa() {
  const res = { statusCode: null, cuerpo: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.cuerpo = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

async function interpretar(texto, respuestaIA) {
  const registros = [];
  const handler = crearHandler({
    verificarToken: async () => ({ id: 'user-1' }),
    registrarUso: async () => ({ allowed: true, remaining: 29 }),
    llamarIA: async () => JSON.stringify(respuestaIA),
    registrar: (e) => registros.push(JSON.parse(JSON.stringify(e))),
    ahora: () => new Date('2026-11-11T21:00:00Z'),
  });
  const res = respuestaFalsa();
  await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { texto, fechaLocal: '2026-11-11' } }, res);
  return { res, registro: registros[0] };
}

describe('hora imposible en el texto', () => {
  test('el caso de la prueba de uso: la IA devuelve las 12 y el servidor vacía la hora y avisa', async () => {
    const { res, registro } = await interpretar('tarea de importancia urgentísima mañana a las 25', {
      titulo: 'Tarea', tipo: 'Tarea', fecha: '2026-11-12', hora12: 12, minutos: '00', ampm: 'PM',
      importancia: 'Muy alta', duracionMinutos: null,
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.cuerpo.hora12, null);
    assert.equal(res.cuerpo.minutos, null);
    assert.equal(res.cuerpo.ampm, null);
    assert.equal(res.cuerpo.fecha, '2026-11-12'); // lo demás se conserva
    assert.equal(res.cuerpo.importancia, 'Muy alta');
    assert.deepEqual(res.cuerpo.advertencias, ['hora']);
    assert.equal(registro.hora_imposible, true);
    assert.deepEqual(registro.dudosos, ['hora']);
  });

  test('detecta horas que no existen', () => {
    for (const t of ['mañana a las 25', 'reunión a las 10:75', 'junta 25:00', 'a las 30.',
      'A LAS 31 de la tarde', 'a las 12:60 pm', 'a las 25 y media', 'a las 99 con Ana']) {
      assert.equal(detectarHoraImposible(t), true, t);
    }
  });

  test('no marca horas válidas ni cantidades', () => {
    for (const t of ['a las 24', 'a las 9', 'a las 15 horas', 'a las 10:30', 'a la 1',
      'invitar a las 30 personas', 'llevar a mi tía las 30 cajas', 'comprar 26 cosas a las 5',
      'el 25 a las 3', 'pagar 1250:00', 'versión 10:99:01', '', null]) {
      assert.equal(detectarHoraImposible(t), false, String(t));
    }
  });

  test('una hora válida no se toca', async () => {
    const { res } = await interpretar('junta mañana a las 5 de la tarde', {
      titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-12', hora12: 5, minutos: '00', ampm: 'PM',
      importancia: 'Media', duracionMinutos: null, noInterpretado: [],
    });
    assert.equal(res.cuerpo.hora12, 5);
    assert.equal(res.cuerpo.ampm, 'PM');
    assert.deepEqual(res.cuerpo.advertencias, []);
  });
});

describe('datos que la IA declara no interpretados', () => {
  test('se vacían aunque la IA haya puesto un valor, y se avisa', () => {
    const { campos, dudosos } = validarRespuestaIA({
      titulo: 'Pago', tipo: 'Tarea', fecha: '2026-02-28', hora12: 3, minutos: '00', ampm: 'PM',
      importancia: 'Media', duracionMinutos: 60, noInterpretado: ['fecha', 'Duracion', 'fecha'],
    });
    assert.equal(campos.fecha, null);
    assert.equal(campos.duracionMinutos, null);
    assert.equal(campos.hora12, 3);
    assert.deepEqual(dudosos, ['fecha', 'duracion']);
  });

  test('nombres fuera de la lista permitida se ignoran', () => {
    const { campos, dudosos } = validarRespuestaIA({
      titulo: 'X', tipo: 'Tarea', importancia: 'Media',
      noInterpretado: ['titulo', 'constructor', '__proto__', 42, null, 'hora'],
    });
    assert.equal(campos.titulo, 'X');
    assert.deepEqual(dudosos, ['hora']);
  });

  test('noInterpretado ausente o con otro formato no rompe nada', () => {
    for (const valor of [undefined, null, 'hora', 7, { hora: true }]) {
      const { campos, dudosos } = validarRespuestaIA({ titulo: 'X', tipo: 'Tarea', hora12: 4, noInterpretado: valor });
      assert.equal(campos.hora12, 4);
      assert.deepEqual(dudosos, []);
    }
  });

  test('el prompt pide no adivinar y declarar lo no interpretado', () => {
    const p = construirPrompt('algo', '2026-11-11');
    assert.match(p, /"noInterpretado"/);
    assert.match(p, /NO lo corrijas ni lo sustituyas/);
    assert.match(p, /a las 25/);
  });
});

describe('minutos y avisos', () => {
  test('los minutos se redondean al cuarto de hora sin cambiar la hora', () => {
    assert.equal(redondearMinutos(7), '00');
    assert.equal(redondearMinutos('07'), '00');
    assert.equal(redondearMinutos(8), '15');
    assert.equal(redondearMinutos(20), '15');
    assert.equal(redondearMinutos('40'), '45');
    assert.equal(redondearMinutos(59), '45');
    assert.equal(redondearMinutos(0), '00');
  });

  test('lo que no es un minuto se descarta', () => {
    for (const v of [60, -1, 7.5, 'xx', '', {}]) assert.equal(redondearMinutos(v), null, String(v));
    const { campos, descartados } = validarRespuestaIA({ titulo: 'X', hora12: 10, minutos: 'xx', ampm: 'AM' });
    assert.equal(campos.minutos, null);
    assert.equal(campos.hora12, 10);
    assert.deepEqual(descartados, ['minutos']);
  });

  test('si el número de la hora se descarta, la hora queda vacía completa', () => {
    const { campos, descartados } = validarRespuestaIA({ titulo: 'X', hora12: 25, minutos: '30', ampm: 'PM' });
    assert.equal(campos.hora12, null);
    assert.equal(campos.minutos, null);
    assert.equal(campos.ampm, null);
    assert.deepEqual(descartados, ['hora12']);
  });

  test('los avisos usan nombres legibles, sin repetidos', () => {
    assert.deepEqual(construirAdvertencias(['minutos', 'ampm', 'duracionMinutos'], ['hora', 'fecha']), ['fecha', 'hora', 'duración']);
    assert.deepEqual(construirAdvertencias(['respuesta'], [], [null, 'nota']), ['la respuesta de la IA', 'nota']);
    assert.deepEqual(construirAdvertencias(), []);
  });
});
