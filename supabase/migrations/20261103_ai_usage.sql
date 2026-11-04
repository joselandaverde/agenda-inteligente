-- Bloque 0-A (SEG-01): control de frecuencia del endpoint de IA por usuario.
-- NIVEL C: no se aplica sin autorización expresa de José. Reversión al final.
--
-- Diseño: el servidor llama a ai_check_and_increment() con el token del usuario
-- (auth.uid()). La tabla no es escribible por el usuario, así que no puede
-- reiniciar su propio contador; a lo más podría inflarlo llamando a la función.
-- No requiere la llave service_role en el servidor.

create table if not exists public.ai_usage (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        integer     not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

drop policy if exists "usuario lee su propio uso" on public.ai_usage;
create policy "usuario lee su propio uso"
  on public.ai_usage for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.ai_check_and_increment(
  p_limit integer default 30,
  p_window_seconds integer default 3600
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.ai_usage%rowtype;
begin
  if uid is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  insert into public.ai_usage (user_id, window_start, count)
  values (uid, now(), 0)
  on conflict (user_id) do nothing;

  select * into r from public.ai_usage where user_id = uid for update;

  if r.window_start + make_interval(secs => p_window_seconds) <= now() then
    update public.ai_usage
       set window_start = now(), count = 0, updated_at = now()
     where user_id = uid
     returning * into r;
  end if;

  if r.count >= p_limit then
    return query select false, 0, r.window_start + make_interval(secs => p_window_seconds);
    return;
  end if;

  update public.ai_usage
     set count = count + 1, updated_at = now()
   where user_id = uid
   returning * into r;

  return query select true, p_limit - r.count, r.window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.ai_check_and_increment(integer, integer) from public, anon;
grant execute on function public.ai_check_and_increment(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- REVERSIÓN (ejecutar solo con autorización):
-- drop function if exists public.ai_check_and_increment(integer, integer);
-- drop table if exists public.ai_usage;
-- ---------------------------------------------------------------------------
