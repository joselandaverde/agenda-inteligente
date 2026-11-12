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

export const supabase = configuracion.ok
  ? createClient(configuracion.url, configuracion.llave)
  : null;
