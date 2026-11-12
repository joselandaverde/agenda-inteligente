// Cómo aplica la captura los datos ampliados de la IA (bloque IA-2). Sin red.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formularioVacio, aplicarInterpretacion, armarCompromiso } from '../../src/logica/compromiso.mjs';

const HOY = '2026-11-11';
const CATEGORIAS = [{ id: 'c1', name: 'Finanzas' }, { id: 'c2', name: 'Casa' }];
const aplicar = (datos) => aplicarInterpretacion(datos, { categorias: CATEGORIAS });
const formularioCon = (datos) => ({ ...formularioVacio(HOY), ...aplicar(datos).cambios });

describe('datos ampliados en la captura', () => {
  test('subtareas: activan la división, con 30 minutos si la IA no dio tiempo', () => {
    const r = aplicar({ titulo: 'Mudanza', tipo: 'Tarea', mas: { subtareas: [{ titulo: 'Cotizar camión', minutos: 20 }, { titulo: ' Empacar ', minutos: null }, { titulo: '' }, null] } });
    assert.equal(r.cambios.tendraSubtareas, true);
    assert.deepEqual(r.cambios.subtareas, [{ titulo: 'Cotizar camión', tiempo: 20 }, { titulo: 'Empacar', tiempo: 30 }]);
    assert.equal(r.abrirMas, true);
  });

  test('lo dictado llega hasta lo que se guarda', () => {
    const tarea = armarCompromiso(formularioCon({ titulo: 'Mudanza', tipo: 'Tarea', mas: { subtareas: [{ titulo: 'Cotizar camión', minutos: 20 }], fechaLimite: '2026-11-13', categoria: 'Casa', notas: 'Pedir cajas' } }));
    assert.equal(tarea.error, null);
    assert.deepEqual(tarea.subtareas, [{ titulo: 'Cotizar camión', tiempo: 20 }]);
    assert.equal(tarea.datos.deadline, '2026-11-13');
    assert.equal(tarea.datos.project_id, 'c2');
    assert.equal(tarea.datos.notes, 'Pedir cajas');
    assert.equal(tarea.datos.date_promised, null);

    const junta = armarCompromiso(formularioCon({ titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-12', hora12: 10, minutos: '00', ampm: 'AM', mas: { lugar: 'Oficina', participantes: ['Ana', 'Luis'], repeticion: 'Semanal', repeticionFin: '2026-12-31', avisoMinutosAntes: 30 } }));
    assert.equal(junta.datos.location, 'Oficina');
    assert.deepEqual(junta.datos.participantes, ['Ana', 'Luis']);
    assert.equal(junta.datos.repetition, 'Semanal');
    assert.equal(junta.datos.repetition_end, '2026-12-31');
    assert.deepEqual(junta.datos.notification_channels, ['App']);
    assert.equal(junta.datos.reminder_minutes_before, 30);
    assert.equal(junta.confirmarRepeticion, false);
  });

  test('aviso de cero minutos también cuenta; repetición sin fin pide confirmación al guardar', () => {
    const r = aplicar({ tipo: 'Recordatorio', mas: { avisoMinutosAntes: 0, repeticion: 'Diaria' } });
    assert.equal(r.cambios.quiereNotificacion, true);
    assert.equal(r.cambios.minutosAntes, '0');
    assert.equal(r.cambios.repeticion, 'Diaria');
    assert.equal('repeticionTieneFin' in r.cambios, false);
    assert.equal(r.abrirMas, false);
  });

  test('la categoría solo se aplica si existe con ese nombre exacto', () => {
    assert.equal(aplicar({ mas: { categoria: 'Finanzas' } }).cambios.categoria, 'c1');
    assert.equal('categoria' in aplicar({ mas: { categoria: 'Otra' } }).cambios, false);
    assert.equal('categoria' in aplicarInterpretacion({ mas: { categoria: 'Finanzas' } }).cambios, false);
  });

  test('"Más opciones" se abre si algo de adentro se llenó o quedó en duda', () => {
    assert.equal(aplicar({ mas: { lugar: 'Oficina' } }).abrirMas, true);
    assert.equal(aplicar({ mas: { notas: 'x' } }).abrirMas, true);
    assert.equal(aplicar({ mas: { fechaLimite: '2026-11-13' } }).abrirMas, true);
    assert.equal(aplicar({ advertencias: ['fecha límite'] }).abrirMas, true);
    assert.equal(aplicar({ advertencias: ['subtareas'] }).abrirMas, true);
    assert.equal(aplicar({ advertencias: ['hora'] }).abrirMas, false);
    assert.equal(aplicar({ mas: { categoria: 'Casa', avisoMinutosAntes: 15 } }).abrirMas, false);
  });

  test('valores raros en lo ampliado no rompen ni llenan nada', () => {
    for (const mas of [null, 'x', [], { subtareas: 'a', participantes: 'b', fechaLimite: 5, repeticion: 'Quincenal', avisoMinutosAntes: -1, notas: 7, categoria: 9, lugar: {} }]) {
      assert.deepEqual(aplicar({ mas }), { cambios: {}, advertencias: [], abrirMas: false });
    }
  });

  test('una respuesta sin "mas" se aplica igual que antes', () => {
    const r = aplicar({ titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-12', hora12: 10, minutos: 0, ampm: 'AM', advertencias: [] });
    assert.deepEqual(r.cambios, { titulo: 'Junta', tipo: 'Reunión', fecha: '2026-11-12', hora12: '10', minutos: '00', ampm: 'AM' });
    assert.equal(r.abrirMas, false);
  });
});
