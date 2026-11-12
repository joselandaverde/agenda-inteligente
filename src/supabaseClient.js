import { createClient } from '@supabase/supabase-js';
import { leerConfiguracion } from './configuracion.mjs';

// La dirección y la llave pública de Supabase vienen de las variables de
// entorno del ambiente (bloque 0-B). Sin ellas no se crea ningún cliente:
// index.js muestra el aviso de configuración faltante en lugar de la app.
export const configuracion = leerConfiguracion({
  url: process.env.REACT_APP_SUPABASE_URL,
  llave: process.env.REACT_APP_SUPABASE_ANON_KEY,
  base: process.env.REACT_APP_BASE_DATOS,
});

// Modo de demostración (bloque I): solo existe si la app se compila con
// REACT_APP_DEMO=1 en una computadora de desarrollo. Usa datos inventados en
// memoria y no se conecta a nada. En Vercel la variable no existe, la
// condición es falsa al compilar y el código de demostración queda fuera.
export const esDemo = process.env.REACT_APP_DEMO === '1';

function crearCliente() {
  if (process.env.REACT_APP_DEMO === '1') {
    return require('./demo/clienteDemo').crearClienteDemo();
  }
  return configuracion.ok ? createClient(configuracion.url, configuracion.llave) : null;
}

export const supabase = crearCliente();
