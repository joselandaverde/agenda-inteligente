// MODO DE DEMOSTRACIÓN. Solo para revisar la interfaz en una computadora de
// desarrollo, sin cuenta y sin base de datos. Se activa únicamente al compilar
// con REACT_APP_DEMO=1; en Vercel esa variable no existe y este archivo no
// entra en la app publicada. Todos los datos son inventados y viven en memoria:
// al recargar la página se pierden. No se conecta a ningún servicio.
import { fechaLocalISO, sumarDias } from '../logica/agenda.mjs';

function datosIniciales() {
  const hoy = fechaLocalISO();
  const dia = (n) => sumarDias(hoy, n);
  const momento = (n, hora) => dia(n) + 'T' + hora + ':00';
  const usuario = 'demo-usuario';

  const projects = [
    { id: 'cat-1', user_id: usuario, name: 'Finanzas', priority_order: 1, context: 'Impuestos, bancos y reportes.' },
    { id: 'cat-2', user_id: usuario, name: 'Compras', priority_order: 2, context: null },
    { id: 'cat-3', user_id: usuario, name: 'Casa', priority_order: 3, context: null },
  ];

  const base = { user_id: usuario, state: 'Pendiente', priority: 'Media', repetition: 'Ninguna', project_id: null, date_promised: null, deadline: null, notes: null, location: null, time_estimated: 30 };
  const tasks = [
    { ...base, id: 't-1', title: 'Junta con el contador', type: 'Reunión', date_promised: momento(0, '10:00'), time_estimated: 60, location: 'Oficina', project_id: 'cat-1' },
    { ...base, id: 't-2', title: 'Enviar reporte trimestral', type: 'Tarea', priority: 'Alta', deadline: dia(0), project_id: 'cat-1', notes: 'Usar el formato nuevo del despacho.' },
    { ...base, id: 't-3', title: 'Llamar al proveedor', type: 'Tarea', date_promised: momento(0, '12:30'), time_estimated: 15, repetition: 'Semanal', project_id: 'cat-2' },
    { ...base, id: 't-4', title: 'Pagar el predial', type: 'Recordatorio', date_promised: momento(0, '18:30'), project_id: 'cat-3', notification_channels: ['App'], reminder_minutes_before: 15 },
    { ...base, id: 't-5', title: 'Confirmar cita con el notario', type: 'Tarea', state: 'Hecho', date_promised: momento(0, '08:00'), date_completed: momento(0, '08:20'), time_estimated: 15 },
    { ...base, id: 't-6', title: 'Renovar póliza de equipo', type: 'Tarea', priority: 'Muy alta', deadline: dia(-1), time_estimated: 20, project_id: 'cat-2' },
    { ...base, id: 't-7', title: 'Llamada con el proveedor', type: 'Reunión', date_promised: momento(1, '09:00'), time_estimated: 30, project_id: 'cat-2' },
    { ...base, id: 't-8', title: 'Revisar contrato de renta', type: 'Tarea', date_promised: momento(1, '16:00'), deadline: dia(2), time_estimated: 45, project_id: 'cat-3' },
    { ...base, id: 't-9', title: 'Entregar declaración mensual', type: 'Tarea', priority: 'Muy alta', deadline: dia(2), time_estimated: 60, repetition: 'Mensual', project_id: 'cat-1' },
    { ...base, id: 't-10', title: 'Ordenar el archivo fiscal', type: 'Tarea', priority: 'Baja', time_estimated: 90, project_id: 'cat-1' },
    { ...base, id: 't-11', title: 'Comprar tóner', type: 'Tarea', priority: 'Muy baja', time_estimated: 20 },
    { ...base, id: 't-12', title: 'Cotizar seguro del auto', type: 'Tarea', state: 'Hecho', date_promised: momento(-3, '11:00'), date_completed: momento(-3, '12:00'), time_estimated: 30 },
  ];

  const sub = (id, orden, title, min, hecho) => ({ id, user_id: usuario, task_id: 't-2', title, time_estimated: min, state: hecho ? 'Hecho' : 'Pendiente', orden });
  const subtasks = [
    sub('s-1', 1, 'Bajar estados de cuenta', 30, true),
    sub('s-2', 2, 'Conciliar bancos', 45, true),
    sub('s-3', 3, 'Capturar gastos', 30, false),
    sub('s-4', 4, 'Revisar con el contador', 30, false),
    sub('s-5', 5, 'Enviar', 15, false),
  ];

  return { projects, tasks, subtasks };
}

export function crearClienteDemo() {
  const tablas = datosIniciales();
  let contador = 1000;
  let sesion = { access_token: 'demostracion', user: { id: 'demo-usuario', email: 'demostracion@ejemplo.com' } };
  const oyentes = new Set();

  function ejecutar(nombre, c) {
    const filas = tablas[nombre];
    if (!filas) return { data: null, error: { message: 'Tabla desconocida en la demostración: ' + nombre } };
    const cumple = (f) => c.filtros.every(([col, val]) => f[col] === val);

    if (c.op === 'insert') {
      const nuevas = (c.datos || []).map((d) => ({ id: 'demo-' + ++contador, user_id: 'demo-usuario', created_at: new Date().toISOString(), ...d }));
      filas.push(...nuevas);
      return { data: c.unico ? nuevas[0] : nuevas, error: null };
    }
    if (c.op === 'update') {
      const tocadas = filas.filter(cumple);
      tocadas.forEach((f) => Object.assign(f, c.datos));
      return { data: c.unico ? tocadas[0] || null : tocadas, error: null };
    }
    if (c.op === 'delete') {
      const fuera = filas.filter(cumple);
      tablas[nombre] = filas.filter((f) => !cumple(f));
      // Lo mismo que hace la base real al borrar: arrastra o desvincula.
      if (nombre === 'tasks') tablas.subtasks = tablas.subtasks.filter((s) => !fuera.some((t) => t.id === s.task_id));
      if (nombre === 'projects') tablas.tasks.forEach((t) => { if (fuera.some((p) => p.id === t.project_id)) t.project_id = null; });
      return { data: fuera, error: null };
    }

    let resultado = filas.filter(cumple).map((f) => ({ ...f }));
    if (c.orden) {
      const [col, asc] = c.orden;
      resultado.sort((x, y) => {
        const a = x[col];
        const b = y[col];
        if (a === b) return 0;
        if (a === null || a === undefined) return 1; // los vacíos al final, como en la base
        if (b === null || b === undefined) return -1;
        return (a < b ? -1 : 1) * (asc ? 1 : -1);
      });
    }
    return { data: c.unico ? resultado[0] || null : resultado, error: null };
  }

  function from(nombre) {
    const c = { op: 'select', filtros: [], orden: null, datos: null, unico: false };
    const api = {
      select: () => api,
      insert: (datos) => { c.op = 'insert'; c.datos = datos; return api; },
      update: (datos) => { c.op = 'update'; c.datos = datos; return api; },
      delete: () => { c.op = 'delete'; return api; },
      eq: (col, val) => { c.filtros.push([col, val]); return api; },
      order: (col, opciones = {}) => { c.orden = [col, opciones.ascending !== false]; return api; },
      single: () => { c.unico = true; return api; },
      then: (bien, mal) => Promise.resolve().then(() => ejecutar(nombre, c)).then(bien, mal),
    };
    return api;
  }

  return {
    from,
    auth: {
      getSession: () => Promise.resolve({ data: { session: sesion }, error: null }),
      onAuthStateChange: (aviso) => {
        oyentes.add(aviso);
        return { data: { subscription: { unsubscribe: () => oyentes.delete(aviso) } } };
      },
      signOut: () => {
        sesion = null;
        oyentes.forEach((aviso) => aviso('SIGNED_OUT', null));
        return Promise.resolve({ error: null });
      },
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'La demostración no tiene cuentas. Recarga la página para volver a entrar.' } }),
    },
  };
}
