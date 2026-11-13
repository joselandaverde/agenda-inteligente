// Bloque 3-A: la fórmula de prioridad, regla por regla y umbral por umbral.
// Sin red, sin navegador y sin fecha del sistema: cada prueba da su "hoy".
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PESOS, estaCalificada, baseDeImpacto, factorDeUrgencia, puntajeDe, ordenDe, referenciaDe, explicarPuntaje,
  diasParaElLimite, compararPorOrden,
} from '../../src/logica/puntaje.mjs';

const HOY = '2026-11-13';
// Una tarea con los cuatro impactos [Generar, Proteger, Político, Personal].
const con = (impactos, extra = {}) => ({
  id: 't', type: 'Tarea',
  impact_generar: impactos[0], impact_proteger: impactos[1], impact_politico: impactos[2], impact_personal: impactos[3],
  ...extra,
});
const NO = [null, null, null, null];

describe('base de impacto: (E+×30 + E−×25 + P×20 + Personal×25) ÷ 2', () => {
  test('los pesos son los del perfil Balanceado y suman 100', () => {
    assert.deepEqual(PESOS, { impact_generar: 30, impact_proteger: 25, impact_politico: 20, impact_personal: 25 });
    assert.equal(Object.values(PESOS).reduce((a, b) => a + b, 0), 100);
  });

  test('cada impacto aporta su peso', () => {
    assert.equal(baseDeImpacto(con([2, 0, 0, 0])), 30);
    assert.equal(baseDeImpacto(con([0, 2, 0, 0])), 25);
    assert.equal(baseDeImpacto(con([0, 0, 2, 0])), 20);
    assert.equal(baseDeImpacto(con([0, 0, 0, 2])), 25);
  });

  test('todo en alto da 100; todo en moderado, 50; todo en nulo, 0', () => {
    assert.equal(baseDeImpacto(con([2, 2, 2, 2])), 100);
    assert.equal(baseDeImpacto(con([1, 1, 1, 1])), 50);
    assert.equal(baseDeImpacto(con([0, 0, 0, 0])), 0);
  });

  test('una mezcla', () => {
    assert.equal(baseDeImpacto(con([2, 2, 1, 0])), 65);
  });

  test('un impacto sin llenar cuenta como 0 mientras haya otro lleno', () => {
    assert.equal(baseDeImpacto(con([2, null, undefined, ''])), 30);
    assert.equal(puntajeDe(con([2, null, null, null]), HOY), 30);
  });

  test('un impacto lleno con 0 sí cuenta como calificado: el puntaje es 0, no vacío', () => {
    assert.equal(estaCalificada(con([0, null, null, null])), true);
    assert.equal(puntajeDe(con([0, null, null, null]), HOY), 0);
  });

  test('sin ningún impacto lleno no hay puntaje ni orden', () => {
    assert.equal(estaCalificada(con(NO)), false);
    assert.equal(baseDeImpacto(con(NO)), null);
    assert.equal(puntajeDe(con(NO), HOY), null);
    assert.equal(ordenDe(con(NO, { esfuerzo: 'Rápido', me_esperan: true }), HOY), null);
    assert.equal(estaCalificada(null), false);
    assert.equal(puntajeDe(null, HOY), null);
  });

  test('valores que llegan como texto se aceptan; los fuera de rango, no', () => {
    assert.equal(puntajeDe(con(['2', '0', '0', '0']), HOY), 30);
    assert.equal(estaCalificada(con([3, -1, 'abc', 1.5])), false);
    assert.equal(puntajeDe(con([2, 3, 0, 0]), HOY), 30);
  });
});

describe('urgencia sin fecha límite: por categoría', () => {
  const base100 = [2, 2, 2, 2];
  test('Fecha dura ×1.5, Ventana ×1.2, Sin fecha ×1.0', () => {
    assert.equal(puntajeDe(con(base100, { urgency_category: 'Fecha dura' }), HOY), 150);
    assert.equal(puntajeDe(con(base100, { urgency_category: 'Ventana' }), HOY), 120);
    assert.equal(puntajeDe(con(base100, { urgency_category: 'Sin fecha' }), HOY), 100);
  });

  test('sin categoría, o con una que no existe, ×1.0', () => {
    assert.equal(puntajeDe(con(base100), HOY), 100);
    assert.equal(puntajeDe(con(base100, { urgency_category: '' }), HOY), 100);
    assert.equal(puntajeDe(con(base100, { urgency_category: 'Urgentísima' }), HOY), 100);
    assert.equal(puntajeDe(con(base100, { urgency_category: 'toString' }), HOY), 100);
  });

  test('el factor sale solo', () => {
    assert.equal(factorDeUrgencia({ urgency_category: 'Fecha dura' }, HOY), 1.5);
    assert.equal(factorDeUrgencia({ urgency_category: 'Ventana' }, HOY), 1.2);
    assert.equal(factorDeUrgencia({}, HOY), 1);
    assert.equal(factorDeUrgencia(null, HOY), 1);
  });
});

describe('urgencia con fecha límite: por días que faltan', () => {
  const dia = (n) => {
    const d = new Date(Date.UTC(2026, 10, 13 + n));
    return d.toISOString().slice(0, 10);
  };
  const factor = (n, extra = {}) => factorDeUrgencia({ deadline: dia(n), ...extra }, HOY);

  test('vencida u hoy: ×2.0', () => {
    assert.equal(factor(-400), 2);
    assert.equal(factor(-1), 2);
    assert.equal(factor(0), 2);
  });

  test('de 1 a 3 días: ×1.8', () => {
    assert.equal(factor(1), 1.8);
    assert.equal(factor(3), 1.8);
  });

  test('de 4 a 7 días: ×1.5', () => {
    assert.equal(factor(4), 1.5);
    assert.equal(factor(7), 1.5);
  });

  test('de 8 a 14 días: ×1.3', () => {
    assert.equal(factor(8), 1.3);
    assert.equal(factor(14), 1.3);
  });

  test('de 15 a 30 días: ×1.15', () => {
    assert.equal(factor(15), 1.15);
    assert.equal(factor(30), 1.15);
  });

  test('más de 30 días: ×1.0', () => {
    assert.equal(factor(31), 1);
    assert.equal(factor(500), 1);
  });

  test('con fecha límite manda la fecha, no la categoría', () => {
    assert.equal(factor(40, { urgency_category: 'Fecha dura' }), 1);
    assert.equal(factor(2, { urgency_category: 'Sin fecha' }), 1.8);
  });

  test('una fecha que no se entiende se ignora y vale la categoría', () => {
    assert.equal(factorDeUrgencia({ deadline: 'pronto', urgency_category: 'Ventana' }, HOY), 1.2);
    assert.equal(factorDeUrgencia({ deadline: '', urgency_category: 'Ventana' }, HOY), 1.2);
    assert.equal(factorDeUrgencia({ deadline: null }, HOY), 1);
  });

  test('cuenta bien días entre meses y años, y acepta fecha con hora', () => {
    assert.equal(diasParaElLimite({ deadline: '2026-12-31' }, '2026-12-30'), 1);
    assert.equal(diasParaElLimite({ deadline: '2027-01-01' }, '2026-12-31'), 1);
    assert.equal(diasParaElLimite({ deadline: '2027-03-01' }, '2027-02-28'), 1);
    assert.equal(diasParaElLimite({ deadline: '2026-11-20T08:00:00' }, HOY), 7);
    assert.equal(diasParaElLimite({}, HOY), null);
  });

  test('el cambio de horario no mueve un día (la cuenta es por fechas, no por horas)', () => {
    assert.equal(diasParaElLimite({ deadline: '2026-11-02' }, '2026-10-31'), 2);
    assert.equal(diasParaElLimite({ deadline: '2026-04-06' }, '2026-04-04'), 2);
  });
});

describe('puntaje: base × urgencia, a un decimal', () => {
  test('ejemplos de la metodología', () => {
    assert.equal(puntajeDe(con([2, 2, 1, 0], { urgency_category: 'Fecha dura' }), HOY), 97.5);
    assert.equal(puntajeDe(con([1, 1, 0, 0]), HOY), 27.5);
    assert.equal(puntajeDe(con([2, 2, 1, 0], { deadline: '2026-11-13' }), HOY), 130);
  });

  test('redondea a un decimal y la mitad exacta sube, como el Excel', () => {
    // 15 × 1.15 = 17.25 → 17.3 ; 12.5 × 1.15 = 14.375 → 14.4 ; 10 × 1.15 = 11.5
    assert.equal(puntajeDe(con([1, 0, 0, 0], { deadline: '2026-12-01' }), HOY), 17.3);
    assert.equal(puntajeDe(con([0, 1, 0, 0], { deadline: '2026-12-01' }), HOY), 14.4);
    assert.equal(puntajeDe(con([0, 0, 1, 0], { deadline: '2026-12-01' }), HOY), 11.5);
    // 12.5 × 1.2 = 15
    assert.equal(puntajeDe(con([0, 1, 0, 0], { urgency_category: 'Ventana' }), HOY), 15);
  });

  test('sube solo al acercarse la fecha límite, sin tocar nada', () => {
    const t = con([1, 1, 0, 0], { deadline: '2026-12-31' });
    const serie = ['2026-11-01', '2026-12-10', '2026-12-20', '2026-12-26', '2026-12-30', '2026-12-31', '2027-01-05'].map((hoy) => puntajeDe(t, hoy));
    assert.deepEqual(serie, [27.5, 31.6, 35.8, 41.3, 49.5, 55, 55]);
  });
});

describe('orden: puntaje + desempate', () => {
  const t50 = (extra) => con([1, 1, 1, 1], extra);

  test('Rápido +0.03, Medio +0.02, Grande +0.01', () => {
    assert.equal(ordenDe(t50({ esfuerzo: 'Rápido' }), HOY), 50.03);
    assert.equal(ordenDe(t50({ esfuerzo: 'Medio' }), HOY), 50.02);
    assert.equal(ordenDe(t50({ esfuerzo: 'Grande' }), HOY), 50.01);
    assert.equal(ordenDe(t50({}), HOY), 50);
    assert.equal(ordenDe(t50({ esfuerzo: 'Enorme' }), HOY), 50);
  });

  test('si lo esperan, +0.003; solo con true', () => {
    assert.equal(ordenDe(t50({ me_esperan: true }), HOY), 50.003);
    assert.equal(ordenDe(t50({ me_esperan: false }), HOY), 50);
    assert.equal(ordenDe(t50({ me_esperan: null }), HOY), 50);
    assert.equal(ordenDe(t50({ me_esperan: 'Sí' }), HOY), 50);
  });

  test('esfuerzo y espera se suman', () => {
    assert.equal(ordenDe(t50({ esfuerzo: 'Rápido', me_esperan: true }), HOY), 50.033);
    assert.equal(ordenDe(t50({ esfuerzo: 'Grande', me_esperan: true }), HOY), 50.013);
  });

  test('el desempate nunca alcanza para pasar a un puntaje mayor', () => {
    const menor = t50({ esfuerzo: 'Rápido', me_esperan: true }); // 50.033
    const mayor = con([1, 1, 1, 1], { urgency_category: 'Ventana' }); // 60
    assert.ok(ordenDe(mayor, HOY) > ordenDe(menor, HOY));
    // y un puntaje que sube un decimal (0.1) siempre supera el desempate máximo (0.033)
    assert.ok(0.1 > 0.033);
  });

  test('referencia: los dos números que se guardan', () => {
    assert.deepEqual(referenciaDe(t50({ esfuerzo: 'Medio' }), HOY), { puntaje: 50, orden_sugerido: 50.02 });
    assert.deepEqual(referenciaDe(con(NO), HOY), { puntaje: null, orden_sugerido: null });
  });
});

describe('explicar el puntaje', () => {
  test('con fecha límite dice los días', () => {
    const e = explicarPuntaje(con([2, 2, 1, 0], { deadline: '2026-11-18' }), HOY);
    assert.equal(e.puntaje, 97.5);
    assert.equal(e.base, 65);
    assert.equal(e.factor, 1.5);
    assert.equal(e.motivo, 'faltan 5 días para la fecha límite');
    assert.equal(e.texto, 'Impacto 65 × urgencia 1.5 (faltan 5 días para la fecha límite)');
  });

  test('vencida, hoy y un día', () => {
    assert.equal(explicarPuntaje(con([1, 0, 0, 0], { deadline: '2026-11-01' }), HOY).motivo, 'la fecha límite ya pasó');
    assert.equal(explicarPuntaje(con([1, 0, 0, 0], { deadline: HOY }), HOY).motivo, 'la fecha límite es hoy');
    assert.equal(explicarPuntaje(con([1, 0, 0, 0], { deadline: '2026-11-14' }), HOY).motivo, 'falta 1 día para la fecha límite');
  });

  test('sin fecha: la categoría o nada', () => {
    assert.equal(explicarPuntaje(con([1, 0, 0, 0], { urgency_category: 'Fecha dura' }), HOY).motivo, 'fecha dura');
    assert.equal(explicarPuntaje(con([1, 0, 0, 0], { urgency_category: 'Sin fecha' }), HOY).motivo, 'sin fecha');
    assert.equal(explicarPuntaje(con([1, 0, 0, 0]), HOY).motivo, 'sin urgencia definida');
  });

  test('sin impactos no hay puntaje y lo dice', () => {
    const e = explicarPuntaje(con(NO), HOY);
    assert.equal(e.puntaje, null);
    assert.match(e.texto, /^Sin puntaje/);
  });
});

describe('comparar por orden', () => {
  const t = (id, impactos, extra = {}) => con(impactos, { id, title: 'T' + id, ...extra });

  test('mayor orden primero; sin puntaje al final', () => {
    const lista = [t(1, NO), t(2, [1, 0, 0, 0]), t(3, [2, 2, 0, 0]), t(4, NO)];
    assert.deepEqual([...lista].sort(compararPorOrden(HOY)).map((x) => x.id), [3, 2, 1, 4]);
  });

  test('con el mismo orden gana la más antigua: primero el menor número de la carga', () => {
    const lista = [t(9, [1, 1, 1, 1], { origen: 'excel:9' }), t(3, [1, 1, 1, 1], { origen: 'excel:3' }), t(21, [1, 1, 1, 1], { origen: 'excel:21' })];
    assert.deepEqual([...lista].sort(compararPorOrden(HOY)).map((x) => x.id), [3, 9, 21]);
  });

  test('las de la carga van antes que las nuevas; las nuevas, por fecha de creación', () => {
    const lista = [
      t(1, [1, 1, 1, 1], { created_at: '2026-11-13T10:00:00' }),
      t(2, [1, 1, 1, 1], { created_at: '2026-11-12T10:00:00' }),
      t(3, [1, 1, 1, 1], { origen: 'excel:40' }),
    ];
    assert.deepEqual([...lista].sort(compararPorOrden(HOY)).map((x) => x.id), [3, 2, 1]);
  });

  test('sin nada más, por nombre', () => {
    const lista = [t(2, [1, 1, 1, 1], { title: 'Zeta' }), t(1, [1, 1, 1, 1], { title: 'Alfa' })];
    assert.deepEqual([...lista].sort(compararPorOrden(HOY)).map((x) => x.title), ['Alfa', 'Zeta']);
  });

  test('el esfuerzo y la espera desempatan antes que la antigüedad', () => {
    const lista = [t(1, [1, 1, 1, 1], { origen: 'excel:1' }), t(2, [1, 1, 1, 1], { origen: 'excel:2', esfuerzo: 'Rápido' }), t(3, [1, 1, 1, 1], { origen: 'excel:3', me_esperan: true })];
    assert.deepEqual([...lista].sort(compararPorOrden(HOY)).map((x) => x.id), [2, 3, 1]);
  });

  test('cambiar de día reordena: una fecha límite que se acerca sube de lugar', () => {
    // La 1 vale 75 siempre; la 2 vale 50 lejos de su fecha y 100 el día del límite.
    const lista = [t(1, [2, 2, 2, 0]), t(2, [1, 1, 1, 1], { deadline: '2026-12-31' })];
    assert.deepEqual([...lista].sort(compararPorOrden('2026-11-13')).map((x) => x.id), [1, 2]);
    assert.deepEqual([...lista].sort(compararPorOrden('2026-12-31')).map((x) => x.id), [2, 1]);
  });
});
