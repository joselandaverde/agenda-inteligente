// Escritura de compromisos y subtareas en la base. Cada función recibe el
// cliente para poder usarse igual con la base real y con el modo de
// demostración. Devuelven { error }: el de la base, o null si todo salió bien.

/** Guarda un compromiso y, si las trae, sus subtareas en orden. */
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

export async function actualizarCompromiso(cliente, id, cambios) {
  const { error } = await cliente.from('tasks').update(cambios).eq('id', id);
  return { error: error || null };
}

export async function borrarCompromiso(cliente, id) {
  const { error } = await cliente.from('tasks').delete().eq('id', id);
  return { error: error || null };
}

/** Marca como hecho o reabre un compromiso. */
export async function alternarHecho(cliente, tarea) {
  const nuevoEstado = tarea.state === 'Hecho' ? 'Pendiente' : 'Hecho';
  const { error } = await cliente
    .from('tasks')
    .update({ state: nuevoEstado, date_completed: nuevoEstado === 'Hecho' ? new Date().toISOString() : null })
    .eq('id', tarea.id);
  return { error: error || null };
}

/** Agrega subtareas al final, una por título, todas con el mismo tiempo. */
export async function agregarSubtareas(cliente, tareaId, titulos, minutos, cuantasHay) {
  let orden = cuantasHay + 1;
  for (const titulo of titulos) {
    const { error } = await cliente
      .from('subtasks')
      .insert([{ task_id: tareaId, title: titulo, time_estimated: minutos, state: 'Pendiente', orden }]);
    if (error) return { error };
    orden++;
  }
  return { error: null };
}

export async function alternarSubtarea(cliente, sub) {
  const { error } = await cliente
    .from('subtasks')
    .update({ state: sub.state === 'Hecho' ? 'Pendiente' : 'Hecho' })
    .eq('id', sub.id);
  return { error: error || null };
}

/** Borra una subtarea y renumera las que quedan. */
export async function borrarSubtarea(cliente, sub, restantes) {
  const { error } = await cliente.from('subtasks').delete().eq('id', sub.id);
  if (error) return { error };
  let orden = 1;
  for (const s of restantes) {
    await cliente.from('subtasks').update({ orden }).eq('id', s.id);
    orden++;
  }
  return { error: null };
}

/** Intercambia el orden de dos subtareas vecinas. */
export async function intercambiarSubtareas(cliente, sub, vecina) {
  await cliente.from('subtasks').update({ orden: vecina.orden }).eq('id', sub.id);
  await cliente.from('subtasks').update({ orden: sub.orden }).eq('id', vecina.id);
  return { error: null };
}
