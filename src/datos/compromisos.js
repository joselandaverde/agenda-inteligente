// Escritura de compromisos en la base. Recibe el cliente para poder usarse
// igual con la base real y con el modo de demostración.

/**
 * Guarda un compromiso y, si las trae, sus subtareas en orden.
 * Devuelve { error } con el error de la base, o null si todo salió bien.
 */
export async function guardarCompromiso(cliente, datos, subtareas = []) {
  const { data: creada, error } = await cliente.from('tasks').insert([datos]).select().single();
  if (error) return { error };

  if (creada && subtareas.length > 0) {
    let orden = 1;
    for (const s of subtareas) {
      await cliente.from('subtasks').insert([
        { task_id: creada.id, title: s.titulo, time_estimated: s.tiempo, state: 'Pendiente', orden },
      ]);
      orden++;
    }
  }
  return { error: null };
}
