// Escritura de categorías en la base (entrega I-4). Cada función recibe el
// cliente, para usarse igual con la base real, con la demostración y en las
// pruebas. Devuelven { error }: el de la base, o null si todo salió bien.
import { posicionValida, aRecorrerAlInsertar, aSubirAlBorrar, vecinaDeCategoria } from '../logica/categorias.mjs';

/** Agrega una categoría en la posición pedida y recorre las que quedan debajo. */
export async function agregarCategoria(cliente, categorias, nombre, posicion) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return { error: { message: 'Escribe el nombre de la categoría.' } };
  const pos = posicionValida(posicion, categorias.length);

  for (const c of aRecorrerAlInsertar(categorias, pos)) {
    await cliente.from('projects').update({ priority_order: c.priority_order + 1 }).eq('id', c.id);
  }
  const { error } = await cliente.from('projects').insert([{ name: limpio, priority_order: pos }]);
  return { error: error || null };
}

/** Borra una categoría y sube un lugar las que estaban debajo. */
export async function borrarCategoria(cliente, categorias, cat) {
  const { error } = await cliente.from('projects').delete().eq('id', cat.id);
  if (error) return { error };
  for (const c of aSubirAlBorrar(categorias, cat.priority_order)) {
    await cliente.from('projects').update({ priority_order: c.priority_order - 1 }).eq('id', c.id);
  }
  return { error: null };
}

/** Intercambia el lugar de una categoría con su vecina de arriba o de abajo. */
export async function moverCategoria(cliente, categorias, cat, direccion) {
  const vecina = vecinaDeCategoria(categorias, cat, direccion);
  if (!vecina) return { error: null };
  await cliente.from('projects').update({ priority_order: vecina.priority_order }).eq('id', cat.id);
  await cliente.from('projects').update({ priority_order: cat.priority_order }).eq('id', vecina.id);
  return { error: null };
}

/** Guarda la descripción de una categoría; vacía se guarda como sin descripción. */
export async function guardarDescripcion(cliente, id, texto) {
  const { error } = await cliente.from('projects').update({ context: texto || null }).eq('id', id);
  return { error: error || null };
}
