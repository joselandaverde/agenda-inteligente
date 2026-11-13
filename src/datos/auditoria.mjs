// Escritura y lectura del registro de acciones (bloque 0-D). Reciben el
// cliente, para usarse igual con la base real, con la demostración y en las
// pruebas. Nunca lanzan: anotar no debe tumbar la acción del usuario.
import { armarRenglon } from '../logica/auditoria.mjs';

/** Anota una acción. Devuelve { error }: null si quedó anotada. */
export async function anotar(cliente, datos) {
  const renglon = armarRenglon(datos);
  if (!renglon) return { error: { message: 'Acción no válida para el registro.' } };
  try {
    const { error } = await cliente.from('audit_log').insert([renglon]);
    return { error: error || null };
  } catch (e) {
    return { error: { message: e && e.message ? e.message : 'No se pudo anotar.' } };
  }
}

/** Los renglones más recientes de la cuenta. Devuelve { renglones, error }. */
export async function leerActividad(cliente, limite = 30) {
  try {
    const { data, error } = await cliente.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limite);
    if (error) return { renglones: [], error };
    return { renglones: data || [], error: null };
  } catch (e) {
    return { renglones: [], error: { message: e && e.message ? e.message : 'No se pudo leer.' } };
  }
}
