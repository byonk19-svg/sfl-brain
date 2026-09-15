-- Development-only MCP writes use a fixed record shape and a caller-provided
-- UUID so ChatGPT retries cannot create duplicate demo content.
alter table public.content_opportunities
  add column development_test_request_key uuid;

create unique index content_opportunities_development_test_request_key_idx
  on public.content_opportunities (workspace_id, development_test_request_key)
  where development_test_request_key is not null;

create function public.create_development_test_content_opportunity(
  p_workspace_id uuid,
  p_request_id uuid
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_opportunity_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 0)
  );

  select id into v_opportunity_id
  from public.content_opportunities
  where workspace_id = p_workspace_id
    and development_test_request_key = p_request_id;
  if v_opportunity_id is not null then
    return v_opportunity_id;
  end if;

  v_opportunity_id := public.create_content_opportunity(
    p_workspace_id,
    '[Development MCP test] ' || p_request_id::text,
    'idea'::public.content_opportunity_status,
    'unspecified'::public.content_opportunity_type,
    'Created only by the development MCP write test.',
    'Retrieve this record with get_content_opportunity_context.',
    null,
    null,
    '{}',
    '{}'
  );

  update public.content_opportunities
  set development_test_request_key = p_request_id
  where id = v_opportunity_id
    and workspace_id = p_workspace_id;

  return v_opportunity_id;
end;
$$;

revoke execute on function public.create_development_test_content_opportunity(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_development_test_content_opportunity(uuid, uuid)
  to service_role;
