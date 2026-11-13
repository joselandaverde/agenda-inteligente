import { anotar } from './auditoria.mjs';
import { versionCorta } from '../logica/auditoria.mjs';
import { VERSION_APP } from '../version.mjs';

// Versión de la app que queda en cada renglón del registro. El commit lo
// aporta Vercel al compilar; en local no existe y se anota solo la versión.
const VERSION = versionCorta(VERSION_APP, process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA);

/** Base de datos sobre la que trabaja esta compilación: "produccion" o "pruebas". */
export const BASE_ACTUAL = process.env.REACT_APP_BASE_DATOS || '';

/**
 * Anota en el registro una acción hecha desde la app. Devuelve { error };
 * quien llama decide cómo avisar si no se pudo anotar.
 */
export function anotarAccion(cliente, { accion, recurso, resultado, detalle }) {
  return anotar(cliente, { accion, recurso, resultado, detalle, version: VERSION, actor: 'app' });
}
