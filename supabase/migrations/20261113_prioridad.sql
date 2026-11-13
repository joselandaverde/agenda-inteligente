-- Bloque 1-A: datos de prioridad de las tareas y datos de la carga inicial.
-- Los valores vienen del Excel de priorización del propietario; en este
-- bloque el puntaje se guarda tal cual (calcularlo en la app es el bloque 3-A).
--
-- Solo agrega columnas a public.tasks: no cambia las existentes, ni las
-- reglas por fila, ni los permisos. Todas admiten vacío, así que las tareas
-- que ya existen quedan igual.
--
-- Idempotente. Aplicarla a cualquier base es nivel C.

alter table public.tasks
  add column if not exists impact_generar   smallint check (impact_generar  between 0 and 2),
  add column if not exists impact_proteger  smallint check (impact_proteger between 0 and 2),
  add column if not exists impact_politico  smallint check (impact_politico between 0 and 2),
  add column if not exists impact_personal  smallint check (impact_personal between 0 and 2),
  add column if not exists urgency_category text check (urgency_category in ('Fecha dura', 'Ventana', 'Sin fecha')),
  add column if not exists esfuerzo         text check (esfuerzo in ('Rápido', 'Medio', 'Grande')),
  add column if not exists delegable        text check (delegable in ('Solo yo', 'Parcial', 'Delegable')),
  add column if not exists me_esperan       boolean,
  add column if not exists retomar_el       date,
  add column if not exists grupo            text check (char_length(grupo) <= 80),
  add column if not exists puntaje          numeric(8, 4),
  add column if not exists orden_sugerido   numeric(8, 4),
  -- De dónde vino la tarea si entró en una carga (por ejemplo "excel:23") y
  -- a qué carga pertenece, para poder deshacerla completa.
  add column if not exists origen           text check (char_length(origen) <= 60),
  add column if not exists lote_carga       uuid;

-- Sin duplicados: una cuenta no puede tener dos tareas con el mismo origen.
create unique index if not exists tasks_origen_por_cuenta_idx
  on public.tasks (user_id, origen)
  where origen is not null;

create index if not exists tasks_lote_carga_idx
  on public.tasks (lote_carga)
  where lote_carga is not null;

-- ---------------------------------------------------------------------------
-- REVERSIÓN (ejecutar solo con autorización; BORRA esos datos de las tareas):
-- drop index if exists public.tasks_lote_carga_idx;
-- drop index if exists public.tasks_origen_por_cuenta_idx;
-- alter table public.tasks
--   drop column if exists impact_generar,  drop column if exists impact_proteger,
--   drop column if exists impact_politico, drop column if exists impact_personal,
--   drop column if exists urgency_category, drop column if exists esfuerzo,
--   drop column if exists delegable, drop column if exists me_esperan,
--   drop column if exists retomar_el, drop column if exists grupo,
--   drop column if exists puntaje, drop column if exists orden_sugerido,
--   drop column if exists origen, drop column if exists lote_carga;
-- ---------------------------------------------------------------------------
