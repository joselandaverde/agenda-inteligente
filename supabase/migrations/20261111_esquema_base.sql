-- Bloque 0-B: esquema base de la app (las tres tablas que la app usa).
-- NIVEL C: no se aplica sin autorización expresa de José. Reversión al final.
--
-- Origen: esquema del proyecto de pruebas leído el 2026-11-11, copiado columna
-- por columna (tipos, valores por defecto, llaves e índices idénticos).
--
-- Diferencias deliberadas respecto al proyecto de pruebas:
--   1. Una sola política por tabla, dirigida al rol authenticated. En pruebas
--      tasks y projects tienen dos políticas duplicadas y aplican al rol public.
--   2. El rol anon no recibe ningún permiso; authenticated recibe solo
--      select, insert, update y delete.
--   3. No se crean las tablas sin uso (users, audit_log, config, feedback, rules).
--
-- Es idempotente: puede ejecutarse dos veces sin error.

-- ---------------------------------------------------------------------------
-- Categorías (la app las llama "proyectos")
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                  character varying(255) not null,
  description           text,
  state                 character varying(50) default 'Activo',
  priority              character varying(50) default 'Media',
  date_start            date,
  date_target           date,
  progress              integer default 0,
  created_at            timestamp without time zone default now(),
  updated_at            timestamp without time zone default now(),
  context               text,
  requires_confirmation boolean default false,
  has_deadlines         boolean default false,
  repetition            character varying(20) default 'Ninguna',
  priority_order        integer
);

create index if not exists idx_projects_user_id on public.projects using btree (user_id);

-- ---------------------------------------------------------------------------
-- Compromisos: reuniones, tareas y recordatorios
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid default auth.uid() references auth.users(id) on delete cascade,
  project_id              uuid references public.projects(id) on delete set null,
  title                   character varying(255) not null,
  description             text,
  type                    character varying(50),
  date_created            timestamp without time zone default now(),
  date_promised           timestamp without time zone,
  date_completed          timestamp without time zone,
  state                   character varying(50) default 'Pendiente',
  priority                character varying(50) default 'Media',
  urgency                 character varying(50) default 'Esta Semana',
  time_estimated          integer,
  time_real               integer,
  progress                integer default 0,
  assigned_to             character varying(255) default 'José',
  participantes           text[],
  notification_channels   text[] default array['Reminders'::text],
  reminder_minutes_before integer default 15,
  notes                   text,
  blocked_by              uuid,
  created_at              timestamp without time zone default now(),
  updated_at              timestamp without time zone default now(),
  location                character varying(255),
  deadline                date,
  repetition              character varying(20) default 'Ninguna',
  requires_confirmation   boolean default false,
  repetition_end          date
);

create index if not exists idx_tasks_user_id on public.tasks using btree (user_id);
create index if not exists idx_tasks_project_id on public.tasks using btree (project_id);
create index if not exists idx_tasks_date_promised on public.tasks using btree (date_promised);

-- ---------------------------------------------------------------------------
-- Subtareas
-- ---------------------------------------------------------------------------
create table if not exists public.subtasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid default auth.uid() references auth.users(id) on delete cascade,
  task_id        uuid not null references public.tasks(id) on delete cascade,
  title          character varying(255) not null,
  time_estimated integer,
  state          character varying(50) default 'Pendiente',
  orden          integer default 1,
  created_at     timestamp without time zone default now()
);

-- ---------------------------------------------------------------------------
-- Seguridad por fila: cada usuario ve y modifica solo sus filas
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.subtasks enable row level security;

revoke all on public.projects, public.tasks, public.subtasks from anon, authenticated;
grant select, insert, update, delete on public.projects, public.tasks, public.subtasks to authenticated;

drop policy if exists "el usuario gestiona sus categorias" on public.projects;
create policy "el usuario gestiona sus categorias"
  on public.projects for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "el usuario gestiona sus tareas" on public.tasks;
create policy "el usuario gestiona sus tareas"
  on public.tasks for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "el usuario gestiona sus subtareas" on public.subtasks;
create policy "el usuario gestiona sus subtareas"
  on public.subtasks for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- REVERSIÓN (ejecutar solo con autorización; BORRA LOS DATOS de estas tablas):
-- drop table if exists public.subtasks;
-- drop table if exists public.tasks;
-- drop table if exists public.projects;
-- ---------------------------------------------------------------------------
