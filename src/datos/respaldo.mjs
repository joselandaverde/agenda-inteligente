// Lectura y escritura completas de los datos del usuario para el respaldo
// (bloque 0-C). Usa la sesión del usuario: las reglas de seguridad por fila
// siguen aplicando, así que solo se lee y se escribe lo propio.
import { TABLAS, validarRespaldo, verificarHuellas, filasParaRestaurar, compararConRespaldo } from '../logica/respaldo.mjs';

const PAGINA = 1000; // la base entrega como máximo esta cantidad por consulta
const LOTE = 200;

async function leerTabla(cliente, tabla) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await cliente.from(tabla).select('*').order('id', { ascending: true }).range(desde, desde + PAGINA - 1);
    if (error) return { filas: null, error };
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) return { filas, error: null };
  }
}

/** Lee todas las filas del usuario en las tres tablas. Devuelve { datos, error }. */
export async function leerDatos(cliente) {
  const datos = {};
  for (const tabla of TABLAS) {
    const { filas, error } = await leerTabla(cliente, tabla);
    if (error) return { datos: null, error };
    datos[tabla] = filas;
  }
  return { datos, error: null };
}

const enLotes = (lista) => {
  const lotes = [];
  for (let i = 0; i < lista.length; i += LOTE) lotes.push(lista.slice(i, i + LOTE));
  return lotes;
};

// Quita lo que se alcanzó a escribir, en orden inverso. Solo se usa sobre una
// cuenta que estaba vacía, así que no puede tocar datos anteriores.
async function deshacer(cliente, escritas) {
  let limpio = true;
  for (const tabla of [...TABLAS].reverse()) {
    for (const lote of enLotes(escritas[tabla] || [])) {
      const { error } = await cliente.from(tabla).delete().in('id', lote);
      if (error) limpio = false;
    }
  }
  return limpio;
}

/**
 * Todo lo que debe cumplirse antes de escribir: archivo válido, sin daños y
 * cuenta vacía. No escribe nada. Devuelve { ok, error }.
 */
export async function revisarAntesDeRestaurar(cliente, objeto) {
  const forma = validarRespaldo(objeto);
  if (!forma.ok) return { ok: false, error: forma.error };
  const integridad = await verificarHuellas(objeto);
  if (!integridad.ok) return { ok: false, error: integridad.error };

  const antes = await leerDatos(cliente);
  if (antes.error) return { ok: false, error: 'No se pudo revisar la cuenta: ' + antes.error.message };
  if (TABLAS.some((t) => antes.datos[t].length > 0)) {
    return { ok: false, error: 'Esta cuenta ya tiene datos. Un respaldo solo se restaura en una cuenta vacía, para no mezclar ni sobrescribir nada.' };
  }
  return { ok: true, error: null };
}

/**
 * Restaura un respaldo en la cuenta de la sesión. Devuelve { ok, error, cantidades }.
 *  - Se niega si el archivo no es válido o está dañado.
 *  - Se niega si la cuenta ya tiene datos: nunca sobrescribe ni mezcla.
 *  - Si falla a la mitad, quita lo que alcanzó a escribir y lo dice.
 *  - Al terminar compara lo escrito con el respaldo.
 */
export async function restaurar(cliente, objeto) {
  const revision = await revisarAntesDeRestaurar(cliente, objeto);
  if (!revision.ok) return revision;

  const filas = filasParaRestaurar(objeto);
  const escritas = {};
  for (const tabla of TABLAS) {
    escritas[tabla] = [];
    for (const lote of enLotes(filas[tabla])) {
      const { error } = await cliente.from(tabla).insert(lote);
      if (error) {
        const limpio = await deshacer(cliente, escritas);
        // 23505: el identificador ya existe en la base. Como la cuenta estaba
        // vacía, solo puede ser de otra cuenta de esta misma base.
        const motivo = error.code === '23505'
          ? 'estos datos ya existen en esta base, en otra cuenta; un respaldo solo entra una vez por base'
          : error.message;
        return {
          ok: false,
          error:
            'La restauración falló al escribir (' + motivo + '). ' +
            (limpio ? 'Se quitó lo que se había escrito: la cuenta quedó vacía otra vez.' : 'No se pudo quitar todo lo escrito: revisa la cuenta antes de volver a intentar.'),
        };
      }
      escritas[tabla].push(...lote.map((f) => f.id));
    }
  }

  const despues = await leerDatos(cliente);
  if (despues.error) return { ok: false, error: 'Se escribió el respaldo, pero no se pudo comprobar: ' + despues.error.message };
  const comparacion = await compararConRespaldo(objeto, despues.datos);
  if (!comparacion.ok) {
    return {
      ok: false,
      error: 'Se escribió el respaldo, pero no quedó igual: ' + comparacion.diferencias.map((d) => d.nombre + ' (' + d.motivo + ')').join('; ') + '.',
    };
  }
  return { ok: true, error: null, cantidades: objeto.cantidades };
}
