// api/interpretar.mjs
// Extensión .mjs a propósito: Vercel ejecuta el archivo como módulo ES nativo.
// Con .js (y sin "type": "module" en package.json) Vercel lo convierte a
// CommonJS y el import del núcleo .mjs falla al arrancar con ERR_REQUIRE_ESM
// (incidente del 2026-11-11 en la vista previa del PR #1).
// Recibe un texto (dictado o escrito) y le pide a Claude, vía Vercel AI Gateway,
// que lo interprete y devuelva los campos del compromiso ya organizados.
//
// Bloque 0-A (SEG-01): exige sesión válida de Supabase, limita frecuencia y
// tamaño, resuelve fechas con la fecha local del teléfono y valida la respuesta
// de la IA campo por campo. La lógica está en _lib/interpretar-core.mjs; aquí
// solo se conectan las dependencias reales.
//
// Secretos: AI_GATEWAY_API_KEY vive en Vercel, nunca en el navegador. La URL y
// la llave *publishable* de Supabase son públicas por diseño; se leen de
// variables de entorno y, mientras no existan (bloque 0-B), se usan los valores
// públicos actuales.

import { createClient } from '@supabase/supabase-js';
import {
  LIMITES,
  crearHandler,
  crearLimitadorMemoria,
} from './_lib/interpretar-core.mjs';

// No se usan las variables REACT_APP_SUPABASE_* de Vercel: su valor no está
// verificado y un valor distinto haría fallar la verificación de sesión.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uxpktmrurvxqigiiharn.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_UWLfZ0xy0jqGlJ5gQZGsNA_uDLKp1Nu';

const limites = {
  ...LIMITES,
  POR_HORA: Number(process.env.AI_LIMITE_POR_HORA) || LIMITES.POR_HORA,
};

const opcionesAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

async function verificarToken(token) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: opcionesAuth });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return { id: data.user.id };
}

const limitadorMemoria = crearLimitadorMemoria(limites);

async function registrarUso(token, userId) {
  // Cliente que actúa como el usuario: la función de base de datos usa auth.uid().
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: opcionesAuth,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.rpc('ai_check_and_increment', {
    p_limit: limites.POR_HORA,
    p_window_seconds: limites.VENTANA_SEG,
  });
  if (error) {
    // PGRST202: la función aún no existe (migración ai_usage sin aplicar).
    // Se usa el limitador en memoria y se deja constancia; cualquier otro error se propaga.
    if (error.code === 'PGRST202') {
      console.warn(JSON.stringify({ evento: 'interpretar', aviso: 'rpc ai_check_and_increment no existe; limitador en memoria' }));
      return limitadorMemoria(userId);
    }
    throw new Error(error.code || 'rpc_error');
  }
  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) throw new Error('rpc_sin_resultado');
  return { allowed: fila.allowed === true, remaining: fila.remaining, resetAt: fila.reset_at, modo: 'bd' };
}

async function llamarIA(prompt) {
  const respuesta = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });
  if (!respuesta.ok) {
    console.error(JSON.stringify({ evento: 'interpretar', error: 'gateway', status: respuesta.status }));
    throw new Error('gateway_' + respuesta.status);
  }
  const datos = await respuesta.json();
  return (datos.choices && datos.choices[0] && datos.choices[0].message && datos.choices[0].message.content) || '';
}

// Bitácora mínima: nunca incluye el texto del usuario ni el token.
function registrar(evento) {
  console.info(JSON.stringify({ ...evento, ts: new Date().toISOString() }));
}

export default crearHandler({ verificarToken, registrarUso, llamarIA, registrar, limites });
