-- Bloque 0-D (SEG-05): registro de acciones delicadas.
-- Cada renglón dice qué se hizo, quién, cuándo y con qué resultado. No guarda
-- contenido (títulos, notas, texto dictado): solo identificadores y cantidades.
--
-- Quién escribe: la app (respaldo, restauración, borrados) y la función de IA
-- (resultado de cada interpretación), siempre con la sesión del propio usuario.
-- El usuario puede agregar y leer sus renglones; no puede cambiarlos ni
-- borrarlos. Tampoco puede fijar la fecha, el dueño ni el identificador: esos
-- tres los pone la base.
--
-- Idempotente. Aplicarla a cualquier base es nivel C.

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  actor       text not null check (actor in ('app', 'servidor')),
  action      text not null check (char_length(action) between 1 and 60),
  resource    text check (resource is null or char_length(resource) <= 120),
  result      text not null check (result in ('ok', 'error', 'rechazado')),
  detail      jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 2048),
  app_version text check (app_version is null or char_length(app_version) <= 60)
);

-- Si ya existía una tabla con este nombre y otra forma, no se sigue: hay que
-- retirarla antes (ocurre en la base de pruebas, que traía una versión vieja).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'actor'
  ) then
    raise exception 'public.audit_log existe con otra forma; retírala antes de aplicar esta migración';
  end if;
end $$;

create index if not exists audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
-- Solo estas columnas pueden venir del usuario; el resto lo pone la base.
grant insert (actor, action, resource, result, detail, app_version) on public.audit_log to authenticated;

drop policy if exists "el usuario lee su actividad" on public.audit_log;
create policy "el usuario lee su actividad"
  on public.audit_log for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "el usuario anota su actividad" on public.audit_log;
create policy "el usuario anota su actividad"
  on public.audit_log for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Sin reglas ni permisos para cambiar o borrar: el registro no se altera desde la app.

-- ---------------------------------------------------------------------------
-- REVERSIÓN (ejecutar solo con autorización; BORRA EL REGISTRO):
-- drop table if exists public.audit_log;
-- ---------------------------------------------------------------------------
