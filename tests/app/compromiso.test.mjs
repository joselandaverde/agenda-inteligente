// Lógica de la captura (src/logica/compromiso.mjs). Sin red ni navegador.
// Fija el comportamiento que tenía el formulario anterior dentro de App.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formularioVacio, hora24, lineasDe, llevaFechaHora, armarCompromiso, aplicarInterpretacion,
  mensajeDeRespuesta, esDudoso, HORAS, MINUTOS,
} from '../../src/logica/compromiso.mjs';

const HOY = '2026-11-11';
const f = (extra = {}) => ({ ...formularioVacio(HOY), titulo: 'Algo', ...extra });

describe('piezas', () => {
  test('hora de 12 a 24', () => {
    assert.equal(hora24('9', 'AM'), '09');
    assert.equal(hora24('12', 'AM'), '00');
    assert.equal(hora24('12', 'PM'), '12');
    assert.equal(hora24('1', 'PM'), '13');
    assert.equal(hora24('11', 'PM'), '23');
  });

  test('catálogos de hora', () => {
    assert.deepEqual(HORAS, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    assert.equal(MINUTOS.length, 12);
    assert.equal(MINUTOS[0], '00');
    assert.equal(MINUTOS[11], '55');
  });

  test('renglones de una lista pegada', () => {
    assert.deepEqual(lineasDe(' uno \n\n dos\n   \ntres'), ['uno', 'dos', 'tres']);
    assert.deepEqual(lineasDe(''), []);
    assert.deepEqual(lineasDe(undefined), []);
  });

  test('cuándo lleva fecha y hora', () => {
    assert.equal(llevaFechaHora(f({ tipo: 'Reunión' })), true);
    assert.equal(llevaFechaHora(f({ tipo: 'Recordatorio' })), true);
    assert.equal(llevaFechaHora(f({ tipo: 'Tarea' })), false);
    assert.equal(llevaFechaHora(f({ tipo: 'Tarea', tieneFechaHora: true })), true);
    assert.equal(llevaFechaHora(f({ tipo: 'Tarea', tieneFechaHora: true, tendraSubtareas: true })), false);
  });
});

describe('armar el compromiso', () => {
  test('sin título no se guarda', () => {
    assert.deepEqual(armarCompromiso(f({ titulo: '   ' })), { error: 'Escribe un título primero' });
  });

  test('tarea sencilla: sin fecha, 30 minutos, sin aviso', () => {
    const r = armarCompromiso(f());
    assert.equal(r.error, null);
    assert.deepEqual(r.datos, {
      title: 'Algo', type: 'Tarea', date_promised: null, project_id: null, priority: 'Media', state: 'Pendiente',
      notes: null, repetition: 'Ninguna', repetition_end: null, notification_channels: null, reminder_minutes_before: null,
      deadline: null, requires_confirmation: false, time_estimated: 30,
    });
    assert.deepEqual(r.subtareas, []);
    assert.equal(r.confirmarRepeticion, false);
  });

  test('reunión: fecha y hora, lugar, participantes y duración', () => {
    const r = armarCompromiso(f({ tipo: 'Reunión', fecha: '2026-11-12', hora12: '10', minutos: '30', ampm: 'AM', lugar: 'Oficina', participantes: 'Ana,  Luis ', tiempoEstimado: '60', categoria: 'c1', importancia: 'Alta', notas: 'Llevar contrato' }));
    assert.equal(r.datos.date_promised, '2026-11-12T10:30:00');
    assert.equal(r.datos.location, 'Oficina');
    assert.deepEqual(r.datos.participantes, ['Ana', 'Luis']);
    assert.equal(r.datos.time_estimated, 60);
    assert.equal(r.datos.project_id, 'c1');
    assert.equal(r.datos.priority, 'Alta');
    assert.equal(r.datos.notes, 'Llevar contrato');
    assert.equal('deadline' in r.datos, false);
  });

  test('recordatorio en la tarde: sin duración ni campos de tarea o reunión', () => {
    const r = armarCompromiso(f({ tipo: 'Recordatorio', hora12: '6', minutos: '30', ampm: 'PM' }));
    assert.equal(r.datos.date_promised, HOY + 'T18:30:00');
    for (const campo of ['time_estimated', 'location', 'participantes', 'deadline', 'requires_confirmation']) {
      assert.equal(campo in r.datos, false, campo);
    }
  });

  test('tarea con fecha, límite y reagendar', () => {
    const r = armarCompromiso(f({ tieneFechaHora: true, fecha: '2026-11-13', hora12: '12', ampm: 'AM', tieneFechaLimite: true, fechaLimite: '2026-11-20', requiereConfirmacion: true, tiempoEstimado: 'x' }));
    assert.equal(r.datos.date_promised, '2026-11-13T00:00:00');
    assert.equal(r.datos.deadline, '2026-11-20');
    assert.equal(r.datos.requires_confirmation, true);
    assert.equal(r.datos.time_estimated, 30);
    assert.equal(armarCompromiso(f({ tieneFechaLimite: true, fechaLimite: '' })).datos.deadline, null);
  });

  test('repetición: con fin se guarda la fecha; sin fin pide confirmación', () => {
    const conFin = armarCompromiso(f({ tipo: 'Reunión', repeticion: 'Semanal', repeticionTieneFin: true, repeticionFin: '2026-12-31' }));
    assert.equal(conFin.datos.repetition, 'Semanal');
    assert.equal(conFin.datos.repetition_end, '2026-12-31');
    assert.equal(conFin.confirmarRepeticion, false);
    const sinFin = armarCompromiso(f({ tipo: 'Reunión', repeticion: 'Diaria' }));
    assert.equal(sinFin.datos.repetition_end, null);
    assert.equal(sinFin.confirmarRepeticion, true);
  });

  test('aviso: canal y minutos; 15 si los minutos no son un número', () => {
    const r = armarCompromiso(f({ quiereNotificacion: true, canalNotificacion: 'Correo', minutosAntes: '45' }));
    assert.deepEqual(r.datos.notification_channels, ['Correo']);
    assert.equal(r.datos.reminder_minutes_before, 45);
    assert.equal(armarCompromiso(f({ quiereNotificacion: true, minutosAntes: '' })).datos.reminder_minutes_before, 15);
  });

  test('tarea dividida en subtareas: sin fecha ni repetición propias', () => {
    const r = armarCompromiso(f({ tendraSubtareas: true, tieneFechaHora: true, repeticion: 'Semanal', subtareas: [{ titulo: 'Uno', tiempo: 20 }] }));
    assert.equal(r.datos.date_promised, null);
    assert.equal(r.datos.repetition, 'Ninguna');
    assert.equal(r.datos.repetition_end, null);
    assert.equal(r.confirmarRepeticion, false);
    assert.deepEqual(r.subtareas, [{ titulo: 'Uno', tiempo: 20 }]);
  });

  test('recoge la subtarea escrita y la lista pegada aunque no se pulsó Agregar', () => {
    const r = armarCompromiso(f({ tendraSubtareas: true, subtareas: [{ titulo: 'Uno', tiempo: 20 }], nuevaSubtareaTitulo: ' Dos ', nuevaSubtareaTiempo: '', textoLista: 'Tres\n\nCuatro', tiempoLista: '10' }));
    assert.deepEqual(r.subtareas, [
      { titulo: 'Uno', tiempo: 20 }, { titulo: 'Dos', tiempo: 30 }, { titulo: 'Tres', tiempo: 10 }, { titulo: 'Cuatro', tiempo: 10 },
    ]);
  });

  test('dividida sin ninguna subtarea no se guarda', () => {
    assert.deepEqual(armarCompromiso(f({ tendraSubtareas: true })), { error: 'Agrega al menos una subtarea, o desmarca la casilla de dividir.' });
  });

  test('en una reunión se ignora la casilla de subtareas', () => {
    const r = armarCompromiso(f({ tipo: 'Reunión', tendraSubtareas: true, subtareas: [{ titulo: 'x', tiempo: 5 }] }));
    assert.deepEqual(r.subtareas, []);
    assert.equal(r.datos.date_promised, HOY + 'T09:00:00');
  });
});

describe('respuesta de la IA', () => {
  test('llena solo lo que entendió', () => {
    const { cambios, advertencias } = aplicarInterpretacion({ titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-12', hora12: 10, minutos: 0, ampm: 'AM', importancia: 'Media', duracionMinutos: 60, advertencias: [] });
    assert.deepEqual(cambios, { titulo: 'Junta', tipo: 'Reunión', importancia: 'Media', fecha: '2026-11-12', hora12: '10', minutos: '00', ampm: 'AM', tiempoEstimado: '60' });
    assert.deepEqual(advertencias, []);
    assert.equal(aplicarInterpretacion({ titulo: 'Junta' }).abrirMas, false);
  });

  test('una tarea con fecha activa la casilla de fecha y hora', () => {
    assert.equal(aplicarInterpretacion({ tipo: 'Tarea', fecha: '2026-11-12' }).cambios.tieneFechaHora, true);
    assert.equal('tieneFechaHora' in aplicarInterpretacion({ tipo: 'Reunión', fecha: '2026-11-12' }).cambios, false);
  });

  test('dato no interpretado: no se toca el campo y queda la advertencia', () => {
    const { cambios, advertencias } = aplicarInterpretacion({ titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-12', hora12: null, minutos: null, ampm: null, advertencias: ['hora'] });
    assert.equal('hora12' in cambios, false);
    assert.equal('minutos' in cambios, false);
    assert.equal('ampm' in cambios, false);
    assert.deepEqual(advertencias, ['hora']);
    assert.equal(esDudoso(advertencias, 'hora'), true);
    assert.equal(esDudoso(advertencias, 'fecha'), false);
    assert.equal(esDudoso(['duración'], 'duracion'), true);
  });

  test('respuestas vacías o raras no rompen nada', () => {
    for (const d of [null, undefined, {}, { advertencias: 'x' }, { advertencias: [null, 5, ''] }]) {
      assert.deepEqual(aplicarInterpretacion(d), { cambios: {}, advertencias: [], abrirMas: false });
    }
  });

  test('mensajes según la respuesta del servidor', () => {
    assert.match(mensajeDeRespuesta(401), /sesión expiró/);
    assert.match(mensajeDeRespuesta(413), /demasiado largo/);
    assert.match(mensajeDeRespuesta(429), /límite/);
    assert.match(mensajeDeRespuesta(500), /No se pudo interpretar/);
  });
});
