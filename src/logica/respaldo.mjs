// Respaldo y restauración (bloque 0-C). Funciones puras, con pruebas.
// El respaldo es un archivo con todas las filas del usuario en las tres
// tablas de la app, más una ficha con cantidades y una huella por tabla.

export const FORMATO = 'agenda-respaldo';
export const VERSION_FORMATO = 1;
// En este orden se restaura: primero lo que otros necesitan.
export const TABLAS = ['projects', 'tasks', 'subtasks'];
// Migraciones con las que se creó la estructura que guarda estos datos.
export const ESQUEMA = ['20261111_esquema_base', '20261103_ai_usage'];
export const DIAS_AVISO = 7;

// El dueño de cada fila cambia al restaurar en otra cuenta: no entra en la
// huella ni se escribe al restaurar (la base pone al usuario de la sesión).
const FUERA_DE_HUELLA = ['user_id'];

const NOMBRES = { projects: 'categorías', tasks: 'compromisos', subtasks: 'subtareas' };

function ordenada(fila, columnas) {
  const salida = {};
  const claves = (columnas || Object.keys(fila)).filter((c) => !FUERA_DE_HUELLA.includes(c)).sort();
  for (const c of claves) salida[c] = fila[c] === undefined ? null : fila[c];
  return salida;
}

async function sha256(texto) {
  const bytes = new TextEncoder().encode(texto);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Columnas presentes en un conjunto de filas. */
export function columnasDe(filas) {
  const todas = new Set();
  for (const f of filas || []) for (const c of Object.keys(f)) todas.add(c);
  return [...todas].sort();
}

/**
 * Huella de una tabla: no depende del orden de las filas ni de su dueño. Si
 * se dan `columnas`, solo esas entran (sirve para comparar con una base que
 * tenga columnas de más).
 */
export async function huellaDe(filas, columnas) {
  const lista = [...(filas || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return sha256(JSON.stringify(lista.map((f) => ordenada(f, columnas))));
}

/** Arma el archivo de respaldo a partir de las filas leídas. */
export async function armarRespaldo(datos, { ahora = new Date(), versionApp = '', base = '' } = {}) {
  const limpio = {};
  const cantidades = {};
  const huellas = {};
  for (const tabla of TABLAS) {
    limpio[tabla] = Array.isArray(datos && datos[tabla]) ? datos[tabla] : [];
    cantidades[tabla] = limpio[tabla].length;
    huellas[tabla] = await huellaDe(limpio[tabla]);
  }
  return {
    formato: FORMATO,
    version: VERSION_FORMATO,
    creado: ahora.toISOString(),
    app: versionApp,
    base,
    esquema: ESQUEMA,
    cantidades,
    huellas,
    datos: limpio,
  };
}

/** "agenda-respaldo-2026-11-11.json", con la fecha local. */
export function nombreArchivo(ahora = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return FORMATO + '-' + ahora.getFullYear() + '-' + dos(ahora.getMonth() + 1) + '-' + dos(ahora.getDate()) + '.json';
}

/**
 * Revisa que un objeto sea un respaldo utilizable: formato y versión
 * conocidos, tablas completas, identificadores presentes y sin repetir,
 * cantidades que cuadran y relaciones que no apuntan a filas inexistentes.
 * Devuelve { ok, error }.
 */
export function validarRespaldo(objeto) {
  const mal = (error) => ({ ok: false, error });
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) return mal('El archivo no es un respaldo de la agenda.');
  if (objeto.formato !== FORMATO) return mal('El archivo no es un respaldo de la agenda.');
  if (objeto.version !== VERSION_FORMATO) return mal('El respaldo es de una versión que esta app no sabe leer (versión ' + String(objeto.version) + ').');
  if (!objeto.datos || typeof objeto.datos !== 'object') return mal('El respaldo no trae datos.');

  for (const tabla of TABLAS) {
    const filas = objeto.datos[tabla];
    if (!Array.isArray(filas)) return mal('Al respaldo le falta la tabla de ' + NOMBRES[tabla] + '.');
    const vistos = new Set();
    for (const f of filas) {
      if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !f.id) return mal('El respaldo tiene ' + NOMBRES[tabla] + ' sin identificador.');
      if (vistos.has(f.id)) return mal('El respaldo tiene ' + NOMBRES[tabla] + ' repetidas.');
      vistos.add(f.id);
    }
    if (!objeto.cantidades || objeto.cantidades[tabla] !== filas.length) return mal('La cantidad de ' + NOMBRES[tabla] + ' no coincide con la ficha del respaldo.');
  }

  const categorias = new Set(objeto.datos.projects.map((p) => p.id));
  const compromisos = new Set(objeto.datos.tasks.map((t) => t.id));
  if (objeto.datos.tasks.some((t) => t.project_id != null && !categorias.has(t.project_id))) return mal('El respaldo tiene compromisos que apuntan a una categoría que no está en el archivo.');
  if (objeto.datos.subtasks.some((s) => !compromisos.has(s.task_id))) return mal('El respaldo tiene subtareas que apuntan a un compromiso que no está en el archivo.');

  return { ok: true, error: null };
}

/** Comprueba que el contenido del archivo no cambió desde que se creó. */
export async function verificarHuellas(objeto) {
  for (const tabla of TABLAS) {
    const esperada = objeto.huellas && objeto.huellas[tabla];
    if ((await huellaDe(objeto.datos[tabla])) !== esperada) {
      return { ok: false, error: 'El contenido de ' + NOMBRES[tabla] + ' no coincide con su huella: el archivo está dañado o fue modificado.' };
    }
  }
  return { ok: true, error: null };
}

/** Filas listas para escribirse: sin dueño, para que la base ponga el de la sesión. */
export function filasParaRestaurar(objeto) {
  const salida = {};
  for (const tabla of TABLAS) {
    salida[tabla] = objeto.datos[tabla].map((f) => {
      const copia = { ...f };
      for (const c of FUERA_DE_HUELLA) delete copia[c];
      return copia;
    });
  }
  return salida;
}

/**
 * Compara lo que quedó en la base con el respaldo: mismas cantidades y mismo
 * contenido, mirando solo las columnas que el respaldo trae.
 * Devuelve { ok, diferencias: [{ tabla, nombre, motivo }] }.
 */
export async function compararConRespaldo(objeto, actuales) {
  const diferencias = [];
  for (const tabla of TABLAS) {
    const esperadas = objeto.datos[tabla];
    const obtenidas = (actuales && actuales[tabla]) || [];
    if (esperadas.length !== obtenidas.length) {
      diferencias.push({ tabla, nombre: NOMBRES[tabla], motivo: 'se esperaban ' + esperadas.length + ' y hay ' + obtenidas.length });
      continue;
    }
    const columnas = columnasDe(esperadas);
    if ((await huellaDe(esperadas, columnas)) !== (await huellaDe(obtenidas, columnas))) {
      diferencias.push({ tabla, nombre: NOMBRES[tabla], motivo: 'el contenido no coincide' });
    }
  }
  return { ok: diferencias.length === 0, diferencias };
}

/** "3 categorías, 22 compromisos y 10 subtareas". */
export function resumenCantidades(cantidades) {
  const c = cantidades || {};
  const parte = (n, uno, varios) => (n || 0) + ' ' + ((n || 0) === 1 ? uno : varios);
  return parte(c.projects, 'categoría', 'categorías') + ', ' + parte(c.tasks, 'compromiso', 'compromisos') + ' y ' + parte(c.subtasks, 'subtarea', 'subtareas');
}

/** Días completos desde una fecha ISO; null si no hay fecha válida. */
export function diasDesde(iso, ahora = new Date()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((ahora.getTime() - t) / 86400000));
}

/** ¿Hay que recordar el respaldo? Solo si hay datos y el último es viejo o no existe. */
export function necesitaRespaldo(ultimoISO, ahora = new Date(), hayDatos = true) {
  if (!hayDatos) return false;
  const dias = diasDesde(ultimoISO, ahora);
  return dias === null || dias > DIAS_AVISO;
}

/**
 * ¿Se muestra el recordatorio fuera de la sección de respaldo? Igual que
 * necesitaRespaldo, salvo que el usuario lo haya pospuesto hace menos de
 * DIAS_AVISO días en este equipo.
 */
export function debeAvisar(ultimoISO, pospuestoISO, ahora = new Date(), hayDatos = true) {
  if (!necesitaRespaldo(ultimoISO, ahora, hayDatos)) return false;
  const dias = diasDesde(pospuestoISO, ahora);
  return dias === null || dias >= DIAS_AVISO;
}

/**
 * Lee el texto de un archivo elegido por el usuario. Devuelve { objeto, error }.
 */
export function leerArchivo(texto) {
  let objeto = null;
  try {
    objeto = JSON.parse(String(texto || '').replace(/^﻿/, ''));
  } catch (e) {
    return { objeto: null, error: 'El archivo no es un respaldo de la agenda.' };
  }
  const forma = validarRespaldo(objeto);
  return forma.ok ? { objeto, error: null } : { objeto: null, error: forma.error };
}

/** Texto del último respaldo para mostrar al usuario. */
export function textoUltimoRespaldo(ultimoISO, ahora = new Date()) {
  const dias = diasDesde(ultimoISO, ahora);
  if (dias === null) return 'Aún no has descargado un respaldo en este equipo.';
  if (dias === 0) return 'Último respaldo en este equipo: hoy.';
  if (dias === 1) return 'Último respaldo en este equipo: ayer.';
  return 'Último respaldo en este equipo: hace ' + dias + ' días.';
}
