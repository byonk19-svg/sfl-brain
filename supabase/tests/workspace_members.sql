begin;

do $test$
declare
  v_workspace_a uuid := 'a1000000-0000-4000-8000-000000000001';
  v_workspace_b uuid := 'b1000000-0000-4000-8000-000000000001';
  v_user_a uuid := 'a2000000-0000-4000-8000-000000000001';
  v_user_b uuid := 'b2000000-0000-4000-8000-000000000001';
begin
  if not has_schema_privilege('authenticated', 'public', 'usage') then
    raise exception 'Authenticated role requires public schema usage for the membership lookup';
  end if;
  if not has_table_privilege('authenticated', 'public.workspace_members', 'select') then
    raise exception 'Authenticated role requires RLS-limited membership reads';
  end if;
  if has_table_privilege('authenticated', 'public.workspace_members', 'insert, update, delete') then
    raise exception 'Authenticated role must not mutate memberships';
  end if;

  insert into public.workspaces (id, name, timezone)
  values
    (v_workspace_a, 'Workspace membership test A', 'America/Chicago'),
    (v_workspace_b, 'Workspace membership test B', 'America/Chicago');

  set local session_replication_role = replica;
  insert into public.workspace_members (workspace_id, user_id)
  values
    (v_workspace_a, v_user_a),
    (v_workspace_b, v_user_b);
  set local session_replication_role = origin;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_workspace_a and user_id = v_user_a
  ) then
    raise exception 'A signed-in user could not read their own membership';
  end if;
  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_workspace_b and user_id = v_user_b
  ) then
    raise exception 'A signed-in user could read another user''s membership';
  end if;
end;
$test$;

rollback;
