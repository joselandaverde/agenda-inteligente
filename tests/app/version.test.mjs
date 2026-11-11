// Etiqueta de versión visible (src/version.mjs). Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION_APP, describirVersion } from '../../src/version.mjs';

describe('etiqueta de versión', () => {
  test('vista previa: muestra versión, entorno y commit corto', () => {
    const v = describirVersion({ entorno: 'preview', commit: '13409f626f992a8c25d673c08171d2ce7522bbb3' });
    assert.equal(v.texto, `Versión ${VERSION_APP} · vista previa · 13409f6`);
    assert.equal(v.esProduccion, false);
  });

  test('producción: se marca como producción', () => {
    const v = describirVersion({ entorno: 'production', commit: 'abcdef1234' });
    assert.equal(v.texto, `Versión ${VERSION_APP} · producción · abcdef1`);
    assert.equal(v.esProduccion, true);
  });

  test('sin variables de Vercel: solo la versión, y no se toma por producción', () => {
    for (const datos of [undefined, {}, { entorno: undefined, commit: undefined }, { entorno: 'otro', commit: 123 }]) {
      const v = describirVersion(datos);
      assert.equal(v.texto, `Versión ${VERSION_APP}`);
      assert.equal(v.esProduccion, false);
    }
  });
});
