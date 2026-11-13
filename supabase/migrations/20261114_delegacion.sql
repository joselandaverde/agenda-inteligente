-- Bloque 3-A2: delegación de tareas con seguimiento.
-- Solo agrega tres columnas opcionales a public.tasks. No cambia las
-- existentes, ni las reglas por fila, ni los permisos; las tareas que ya
-- existen quedan igual (sin delegar).
--
--   delegada_a   a quién se le delegó la tarea (vacío = no está delegada)
--   delegada_el  el día en que se delegó
--   revisar_el   el día de la próxima revisión del seguimiento
--
-- Idempotente. Aplicarla a cualquier base es nivel C: antes, respaldo.

alter table public.tasks
  add column if not exists delegada_a  text check (char_length(delegada_a) <= 80),
  add column if not exists delegada_el date,
  add column if not exists revisar_el  date;

-- ---------------------------------------------------------------------------
-- REVERSIÓN (ejecutar solo con autorización; BORRA esos datos de las tareas):
-- alter table public.tasks
--   drop column if exists delegada_a,
--   drop column if exists delegada_el,
--   drop column if exists revisar_el;
-- ---------------------------------------------------------------------------
