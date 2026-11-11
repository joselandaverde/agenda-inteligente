// Etiqueta de versión visible (src/version.mjs). Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION_APP, describirVersion } from '../../src/version.mjs';

describe('etiqueta de versión', () => {
  test('vista previa sobre la base de pruebas', () => {
    const v = describirVersion({ entorno: 'preview', commit: '13409f626f992a8c25d673c08171d2ce7522bbb3', base: 'pruebas' });
    assert.equal(v.texto, `Versión ${VERSION_APP} · vista previa · base pruebas · 13409f6`);
    assert.equal(v.esProduccion, false);
    assert.equal(v.cruzada, false);
  });

  test('producción sobre la base de producción', () => {
    const v = describirVersion({ entorno: 'production', commit: 'abcdef1234', base: 'produccion' });
    assert.equal(v.texto, `Versión ${VERSION_APP} · producción · base producción · abcdef1`);
    assert.equal(v.esProduccion, true);
    assert.equal(v.cruzada, false);
  });

  test('sin variables de Vercel: solo la versión, y no se toma por producción', () => {
    for (const datos of [undefined, {}, { entorno: undefined, commit: undefined }, { entorno: 'otro', commit: 123, base: 'x' }]) {
      const v = describirVersion(datos);
      assert.equal(v.texto, `Versión ${VERSION_APP}`);
      assert.equal(v.esProduccion, false);
      assert.equal(v.cruzada, false);
    }
  });

  test('avisa cuando el ambiente y la base no corresponden', () => {
    assert.equal(describirVersion({ entorno: 'production', base: 'pruebas' }).cruzada, true);
    assert.equal(describirVersion({ entorno: 'preview', base: 'produccion' }).cruzada, true);
    assert.equal(describirVersion({ entorno: 'development', base: 'produccion' }).cruzada, true);
    assert.equal(describirVersion({ entorno: 'development', base: 'pruebas' }).cruzada, false);
    // Sin entorno conocido (compilación local sin Vercel) no se puede afirmar nada.
    assert.equal(describirVersion({ base: 'produccion' }).cruzada, false);
  });
});
