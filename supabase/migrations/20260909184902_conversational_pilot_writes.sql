-- Private development-pilot write requests are idempotent per workspace,
-- action, and caller request ID. Only service_role may invoke the wrappers.
create table public.mcp_mutation_requests (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action text not null check (action in ('create_content_opportunity', 'update_content_opportunity', 'record_post')),
  request_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, action, request_id)
);

alter table public.mcp_mutation_requests enable row level security;
revoke all on public.mcp_mutation_requests from public, anon, authenticated;
grant all on public.mcp_mutation_requests to service_role;

create function public.create_mcp_content_opportunity(
  p_workspace_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_hash text := pg_catalog.md5(p_payload::text);
  v_result jsonb;
  v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('create_content_opportunity:' || p_request_id::text, 0)
  );
  select payload_hash, result into v_hash, v_result
  from public.mcp_mutation_requests
  where workspace_id = p_workspace_id and action = 'create_content_opportunity' and request_id = p_request_id;
  if found then
    if v_hash <> pg_catalog.md5(p_payload::text) then raise exception 'Request ID payload conflict'; end if;
    return v_result;
  end if;
  v_id := public.create_content_opportunity(
    p_workspace_id,
    p_payload->>'title',
    coalesce((p_payload->>'status')::public.content_opportunity_status, 'idea'::public.content_opportunity_status),
    coalesce((p_payload->>'content_type')::public.content_opportunity_type, 'unspecified'::public.content_opportunity_type),
    p_payload->>'notes', p_payload->>'next_action',
    (p_payload->>'estimated_minutes_remaining')::integer,
    null, '{}', '{}'
  );
  v_result := jsonb_build_object('opportunity_id', v_id);
  insert into public.mcp_mutation_requests(workspace_id, action, request_id, payload_hash, result)
  values (p_workspace_id, 'create_content_opportunity', p_request_id, pg_catalog.md5(p_payload::text), v_result);
  return v_result;
end;
$$;

create function public.update_mcp_content_opportunity(
  p_workspace_id uuid,
  p_request_id uuid,
  p_opportunity_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb,
  p_payload jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_hash text := pg_catalog.md5(p_payload::text);
  v_result jsonb;
  v_updated_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('update_content_opportunity:' || p_request_id::text, 0)
  );
  select payload_hash, result into v_hash, v_result
  from public.mcp_mutation_requests
  where workspace_id = p_workspace_id and action = 'update_content_opportunity' and request_id = p_request_id;
  if found then
    if v_hash <> pg_catalog.md5(p_payload::text) then raise exception 'Request ID payload conflict'; end if;
    return v_result;
  end if;
  if not exists (
    select 1 from public.content_opportunities
    where id = p_opportunity_id and workspace_id = p_workspace_id and archived_at is null
  ) then raise exception 'Content opportunity is unavailable'; end if;
  update public.content_opportunities
  set title = case when p_patch ? 'title' then p_patch->>'title' else title end,
      status = case when p_patch ? 'status' then (p_patch->>'status')::public.content_opportunity_status else status end,
      content_type = case when p_patch ? 'content_type' then (p_patch->>'content_type')::public.content_opportunity_type else content_type end,
      notes = case when p_patch ? 'notes' then nullif(trim(p_patch->>'notes'), '') else notes end,
      next_action = case when p_patch ? 'next_action' then nullif(trim(p_patch->>'next_action'), '') else next_action end,
      estimated_minutes_remaining = case when p_patch ? 'estimated_minutes_remaining' then (p_patch->>'estimated_minutes_remaining')::integer else estimated_minutes_remaining end
  where id = p_opportunity_id
    and workspace_id = p_workspace_id
    and updated_at = p_expected_updated_at
  returning updated_at into v_updated_at;
  if v_updated_at is null then raise exception 'Content opportunity changed since it was last read'; end if;
  v_result := jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'updated_at', v_updated_at,
    'changed_fields', (select coalesce(jsonb_agg(key order by key), '[]'::jsonb) from jsonb_object_keys(p_patch) key)
  );
  insert into public.mcp_mutation_requests(workspace_id, action, request_id, payload_hash, result)
  values (p_workspace_id, 'update_content_opportunity', p_request_id, pg_catalog.md5(p_payload::text), v_result);
  return v_result;
end;
$$;

create function public.record_mcp_post(
  p_workspace_id uuid,
  p_request_id uuid,
  p_opportunity_id uuid,
  p_destination_id uuid,
  p_published_at timestamptz,
  p_asset_ids uuid[],
  p_caption text,
  p_angle text,
  p_performance_label public.performance_label,
  p_payload jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_hash text := pg_catalog.md5(p_payload::text);
  v_result jsonb;
  v_post_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('record_post:' || p_request_id::text, 0)
  );
  select payload_hash, result into v_hash, v_result
  from public.mcp_mutation_requests
  where workspace_id = p_workspace_id and action = 'record_post' and request_id = p_request_id;
  if found then
    if v_hash <> pg_catalog.md5(p_payload::text) then raise exception 'Request ID payload conflict'; end if;
    return v_result;
  end if;
  v_post_id := public.record_post(
    p_workspace_id, p_opportunity_id, p_destination_id, p_published_at,
    '{}', coalesce(p_asset_ids, '{}'), p_caption, p_angle, p_performance_label, null
  );
  v_result := jsonb_build_object('post_id', v_post_id, 'opportunity_id', p_opportunity_id);
  insert into public.mcp_mutation_requests(workspace_id, action, request_id, payload_hash, result)
  values (p_workspace_id, 'record_post', p_request_id, pg_catalog.md5(p_payload::text), v_result);
  return v_result;
end;
$$;

revoke execute on function public.create_mcp_content_opportunity(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.update_mcp_content_opportunity(uuid, uuid, uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.record_mcp_post(uuid, uuid, uuid, uuid, timestamptz, uuid[], text, text, public.performance_label, jsonb) from public, anon, authenticated;
grant execute on function public.create_mcp_content_opportunity(uuid, uuid, jsonb) to service_role;
grant execute on function public.update_mcp_content_opportunity(uuid, uuid, uuid, timestamptz, jsonb, jsonb) to service_role;
grant execute on function public.record_mcp_post(uuid, uuid, uuid, uuid, timestamptz, uuid[], text, text, public.performance_label, jsonb) to service_role;
