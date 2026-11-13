// Lógica de las categorías (entrega I-4). Funciones puras, con pruebas.
// Fija el comportamiento que tenía la gestión de categorías dentro de App.js.

/** Posición válida para una categoría nueva: entre 1 y total + 1. */
export function posicionValida(valor, total) {
  let pos = parseInt(valor, 10);
  if (isNaN(pos) || pos < 1) pos = 1;
  if (pos > total + 1) pos = total + 1;
  return pos;
}

/** Posiciones que se ofrecen al agregar: "1" a total + 1. */
export function opcionesDePosicion(total) {
  return Array.from({ length: total + 1 }, (_, i) => String(i + 1));
}

/** Categorías que bajan un lugar al insertar una nueva en `pos`. */
export function aRecorrerAlInsertar(categorias, pos) {
  return (categorias || []).filter((c) => c.priority_order >= pos);
}

/** Categorías que suben un lugar al borrar la que estaba en `ordenBorrado`. */
export function aSubirAlBorrar(categorias, ordenBorrado) {
  return (categorias || []).filter((c) => c.priority_order > ordenBorrado);
}

/** Vecina con la que se intercambia el orden al subir o bajar una categoría. */
export function vecinaDeCategoria(categorias, cat, direccion) {
  const orden = direccion === 'subir' ? cat.priority_order - 1 : cat.priority_order + 1;
  return (categorias || []).find((c) => c.priority_order === orden) || null;
}

/**
 * Compromisos abiertos por categoría. Devuelve { porId, sinCategoria, total }.
 */
export function abiertosPorCategoria(tareas) {
  const porId = {};
  let sinCategoria = 0;
  let total = 0;
  for (const t of tareas || []) {
    if (t.state === 'Hecho') continue;
    total += 1;
    if (t.project_id) porId[t.project_id] = (porId[t.project_id] || 0) + 1;
    else sinCategoria += 1;
  }
  return { porId, sinCategoria, total };
}

/** Compromisos de una categoría; sin categoría elegida, todos. */
export function filtrarPorCategoria(tareas, categoriaId) {
  if (!categoriaId) return tareas || [];
  return (tareas || []).filter((t) => t.project_id === categoriaId);
}

/** Tono (0 a 5) del punto de color de una categoría según su lugar en la lista. */
export function tonoDe(indice) {
  return ((indice % 6) + 6) % 6;
}

/** "4 abiertos", "1 abierto", "Sin compromisos abiertos". */
export function textoAbiertos(n) {
  if (!n) return 'Sin compromisos abiertos';
  return n + (n === 1 ? ' abierto' : ' abiertos');
}
