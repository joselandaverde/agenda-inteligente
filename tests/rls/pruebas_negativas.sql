-- Pruebas negativas de permisos (bloque 0-D, §5.6.1 del libro).
-- Comprueban que una cuenta no puede leer, crear, cambiar ni borrar datos de
-- otra, que el registro de acciones no se puede alterar y que sin sesión no se
-- lee nada.
--
-- CÓMO SE USA
--   1. Poner abajo los identificadores de dos cuentas existentes (A y B).
--   2. Ejecutar todo el bloque en el editor de SQL de la base de PRUEBAS.
--   3. El resultado llega como un "error" que empieza con RESULTADO RLS: es a
--      propósito. Ese error deshace todo lo que el bloque escribió, así que la
--      base queda exactamente como estaba. "fallas: 0" significa que todo pasó.
--
-- No usa contraseñas: actúa como cada cuenta dentro de la propia base.

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a'; -- cuenta que intenta
  b uuid := '00000000-0000-0000-0000-00000000000b'; -- cuenta dueña de los datos
  cat_b uuid; tar_b uuid; sub_b uuid; aud_b uuid; aud_a uuid;
  n integer;
  bien text[] := '{}';
  mal  text[] := '{}';
  t text;
begin
  -- Preparación, como dueño de la base: filas de B y un renglón de registro de A.
  insert into public.projects (user_id, name) values (b, 'rls-prueba') returning id into cat_b;
  insert into public.tasks (user_id, title, project_id) values (b, 'rls-prueba', cat_b) returning id into tar_b;
  insert into public.subtasks (user_id, task_id, title) values (b, tar_b, 'rls-prueba') returning id into sub_b;
  insert into public.audit_log (user_id, actor, action, result) values (b, 'app', 'rls.prueba', 'ok') returning id into aud_b;
  insert into public.audit_log (user_id, actor, action, result) values (a, 'app', 'rls.prueba', 'ok') returning id into aud_a;
  insert into public.ai_usage (user_id) values (b) on conflict do nothing;

  -- ===== Como la cuenta A =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. A no ve las filas de B.
  select count(*) into n from public.projects where id = cat_b;
  if n = 0 then bien := bien || 'leer projects'; else mal := mal || 'A LEE projects de B'; end if;
  select count(*) into n from public.tasks where id = tar_b;
  if n = 0 then bien := bien || 'leer tasks'; else mal := mal || 'A LEE tasks de B'; end if;
  select count(*) into n from public.subtasks where id = sub_b;
  if n = 0 then bien := bien || 'leer subtasks'; else mal := mal || 'A LEE subtasks de B'; end if;
  select count(*) into n from public.audit_log where id = aud_b;
  if n = 0 then bien := bien || 'leer audit_log'; else mal := mal || 'A LEE audit_log de B'; end if;
  select count(*) into n from public.ai_usage where user_id = b;
  if n = 0 then bien := bien || 'leer ai_usage'; else mal := mal || 'A LEE ai_usage de B'; end if;

  -- 2. A no cambia las filas de B.
  update public.projects set name = 'alterada' where id = cat_b; get diagnostics n = row_count;
  if n = 0 then bien := bien || 'cambiar projects'; else mal := mal || 'A CAMBIA projects de B'; end if;
  update public.tasks set title = 'alterada' where id = tar_b; get diagnostics n = row_count;
  if n = 0 then bien := bien || 'cambiar tasks'; else mal := mal || 'A CAMBIA tasks de B'; end if;
  update public.subtasks set title = 'alterada' where id = sub_b; get diagnostics n = row_count;
  if n = 0 then bien := bien || 'cambiar subtasks'; else mal := mal || 'A CAMBIA subtasks de B'; end if;

  -- 3. A no borra las filas de B.
  delete from public.subtasks where id = sub_b; get diagnostics n = row_count;
  if n = 0 then bien := bien || 'borrar subtasks'; else mal := mal || 'A BORRA subtasks de B'; end if;
  delete from public.tasks where id = tar_b; get diagnostics n = row_count;
  if n = 0 then bien := bien || 'borrar tasks'; else mal := mal || 'A BORRA tasks de B'; end if;
  delete from public.projects where id = cat_b; get diagnostics n = row_count;
  if n = 0 then bien := bien || 'borrar projects'; else mal := mal || 'A BORRA projects de B'; end if;

  -- 4. A no crea filas a nombre de B.
  begin
    insert into public.projects (user_id, name) values (b, 'intrusa');
    mal := mal || 'A CREA projects a nombre de B';
  exception when others then bien := bien || 'crear projects ajeno'; end;
  begin
    insert into public.tasks (user_id, title) values (b, 'intrusa');
    mal := mal || 'A CREA tasks a nombre de B';
  exception when others then bien := bien || 'crear tasks ajeno'; end;
  begin
    insert into public.subtasks (user_id, task_id, title) values (b, tar_b, 'intrusa');
    mal := mal || 'A CREA subtasks a nombre de B';
  exception when others then bien := bien || 'crear subtasks ajeno'; end;
  -- El contador de uso de la IA solo lo mueve la función de la base, no el usuario.
  begin
    insert into public.ai_usage (user_id) values (a);
    mal := mal || 'A ESCRIBE en ai_usage';
  exception when others then bien := bien || 'escribir ai_usage'; end;

  -- 5. El registro de acciones: A agrega lo suyo y nada más.
  begin
    insert into public.audit_log (actor, action, result) values ('app', 'rls.prueba', 'ok');
    bien := bien || 'anotar propio';
  exception when others then mal := mal || 'A NO PUEDE anotar su propia actividad: ' || sqlerrm; end;
  begin
    insert into public.audit_log (user_id, actor, action, result) values (b, 'app', 'rls.prueba', 'ok');
    mal := mal || 'A ANOTA a nombre de B';
  exception when others then bien := bien || 'anotar ajeno'; end;
  begin
    insert into public.audit_log (created_at, actor, action, result) values (now() - interval '1 year', 'app', 'rls.prueba', 'ok');
    mal := mal || 'A FIJA la fecha de un renglón';
  exception when others then bien := bien || 'fijar fecha'; end;
  begin
    update public.audit_log set action = 'alterada' where id = aud_a; get diagnostics n = row_count;
    if n = 0 then bien := bien || 'cambiar registro propio'; else mal := mal || 'A CAMBIA su registro'; end if;
  exception when others then bien := bien || 'cambiar registro propio'; end;
  begin
    delete from public.audit_log where id = aud_a; get diagnostics n = row_count;
    if n = 0 then bien := bien || 'borrar registro propio'; else mal := mal || 'A BORRA su registro'; end if;
  exception when others then bien := bien || 'borrar registro propio'; end;
  select count(*) into n from public.audit_log where id = aud_a;
  if n = 1 then bien := bien || 'leer registro propio'; else mal := mal || 'A NO LEE su propio registro'; end if;

  -- ===== Sin sesión =====
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  foreach t in array array['projects', 'tasks', 'subtasks', 'audit_log', 'ai_usage'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n = 0 then bien := bien || ('sin sesión ' || t); else mal := mal || ('SIN SESIÓN SE LEE ' || t); end if;
    exception when others then bien := bien || ('sin sesión ' || t); end;
  end loop;
  reset role;

  -- Las filas de B siguen intactas (vistas otra vez como dueño de la base).
  select count(*) into n from public.projects p join public.tasks k on k.project_id = p.id join public.subtasks s on s.task_id = k.id
    where p.id = cat_b and p.name = 'rls-prueba' and k.title = 'rls-prueba' and s.title = 'rls-prueba';
  if n = 1 then bien := bien || 'filas de B intactas'; else mal := mal || 'LAS FILAS DE B CAMBIARON'; end if;

  -- El error es a propósito: deshace todo lo escrito por este bloque.
  raise exception 'RESULTADO RLS | correctas: % | fallas: % | %',
    coalesce(array_length(bien, 1), 0), coalesce(array_length(mal, 1), 0),
    case when coalesce(array_length(mal, 1), 0) = 0 then 'todo se rechazó como debe' else array_to_string(mal, '; ') end;
end $$;
