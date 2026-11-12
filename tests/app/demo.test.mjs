// El modo de demostración solo puede existir en una compilación hecha a
// propósito con REACT_APP_DEMO=1. Estas pruebas revisan el código fuente para
// que nadie lo active por otra vía. Sin red ni navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

function archivosDe(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : [ruta];
  });
}

describe('modo de demostración', () => {
  test('el cliente de demostración solo se carga detrás de la variable de compilación', () => {
    const cliente = leer('src/supabaseClient.js');
    const usos = cliente.split('\n').filter((l) => l.includes('clienteDemo'));
    assert.equal(usos.length, 1, 'clienteDemo debe aparecer una sola vez');
    const antes = cliente.slice(0, cliente.indexOf(usos[0]));
    assert.match(antes.split('\n').slice(-2).join('\n'), /if \(process\.env\.REACT_APP_DEMO === '1'\) \{/);
    assert.doesNotMatch(cliente, /import .*clienteDemo/, 'no debe importarse de forma fija');
  });

  test('ningún otro archivo de la app carga el cliente de demostración', () => {
    const otros = archivosDe(join(raiz, 'src'))
      .filter((f) => !f.endsWith('supabaseClient.js') && !f.includes(join('src', 'demo')))
      .filter((f) => readFileSync(f, 'utf8').includes('clienteDemo'));
    assert.deepEqual(otros, []);
  });

  test('la configuración de ejemplo y la función de IA no conocen el modo de demostración', () => {
    assert.doesNotMatch(leer('.env.example'), /REACT_APP_DEMO/);
    for (const f of archivosDe(join(raiz, 'api'))) {
      assert.doesNotMatch(readFileSync(f, 'utf8'), /REACT_APP_DEMO/, f);
    }
  });

  test('los datos de demostración no contienen direcciones ni llaves reales', () => {
    const demo = leer('src/demo/clienteDemo.js');
    assert.doesNotMatch(demo, /supabase\.co|sb_publishable_|sb_secret_|eyJ[A-Za-z0-9_-]{10,}/);
    assert.match(demo, /demostracion@ejemplo\.com/);
  });
});
