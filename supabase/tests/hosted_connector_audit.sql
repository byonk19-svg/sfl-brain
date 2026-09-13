begin;

do $test$
declare
  v_workspace_a uuid := 'c1000000-0000-4000-8000-000000000001';
  v_workspace_b uuid := 'c1000000-0000-4000-8000-000000000002';
  v_actor_a uuid := 'c2000000-0000-4000-8000-000000000001';
  v_actor_b uuid := 'c2000000-0000-4000-8000-000000000002';
  v_actor_c uuid := 'c2000000-0000-4000-8000-000000000003';
  v_destination uuid := 'c3000000-0000-4000-8000-000000000001';
  v_create_request uuid := 'c4000000-0000-4000-8000-000000000001';
  v_update_request uuid := 'c4000000-0000-4000-8000-000000000002';
  v_post_request uuid := 'c4000000-0000-4000-8000-000000000003';
  v_opportunity uuid;
  v_updated_at timestamptz;
begin
  if has_table_privilege('authenticated', 'public.mcp_mutation_requests', 'select, insert, update, delete') then
    raise exception 'Authenticated role must not access connector mutation records';
  end if;
  if has_function_privilege('authenticated', 'public.create_mcp_content_opportunity(uuid,uuid,uuid,text,jsonb)', 'execute') then
    raise exception 'Authenticated role must not execute connector write RPCs';
  end if;

  insert into public.workspaces(id, name) values
    (v_workspace_a, 'Connector audit A'),
    (v_workspace_b, 'Connector audit B');
  insert into public.destinations(id, workspace_id, name, platform) values
    (v_destination, v_workspace_a, 'Connector test destination', 'other');
  set local session_replication_role = replica;
  insert into public.workspace_members(workspace_id, user_id) values
    (v_workspace_a, v_actor_a),
    (v_workspace_b, v_actor_b),
    (v_workspace_a, v_actor_c);
  set local session_replication_role = origin;

  v_opportunity := (
    public.create_mcp_content_opportunity(
      v_workspace_a, v_create_request, v_actor_a, 'chatgpt_connector',
      jsonb_build_object(
        'request_id', v_create_request,
        'title', 'Connector audit opportunity',
        'status', 'idea',
        'content_type', 'comparison'
      )
    )->>'opportunity_id'
  )::uuid;
  if not exists (
    select 1 from public.mcp_mutation_requests
    where workspace_id = v_workspace_a
      and action = 'create_content_opportunity'
      and request_id = v_create_request
      and actor_user_id = v_actor_a
      and source = 'chatgpt_connector'
  ) then raise exception 'Create audit identity was not persisted'; end if;

  select updated_at into v_updated_at
  from public.content_opportunities where id = v_opportunity;
  perform public.update_mcp_content_opportunity(
    v_workspace_a, v_update_request, v_actor_a, 'chatgpt_connector',
    v_opportunity, v_updated_at,
    jsonb_build_object('status', 'ready'),
    jsonb_build_object(
      'request_id', v_update_request,
      'opportunity_id', v_opportunity,
      'expected_updated_at', v_updated_at,
      'status', 'ready'
    )
  );
  perform public.record_mcp_post(
    v_workspace_a, v_post_request, v_actor_a, 'chatgpt_connector',
    v_opportunity, v_destination, now(), '{}', null, null, 'unknown',
    jsonb_build_object(
      'request_id', v_post_request,
      'opportunity_id', v_opportunity,
      'destination_id', v_destination,
      'published_at', now(),
      'asset_ids', jsonb_build_array(),
      'performance_label', 'unknown'
    )
  );
  if (
    select count(*) from public.mcp_mutation_requests
    where workspace_id = v_workspace_a
      and actor_user_id = v_actor_a
      and source = 'chatgpt_connector'
  ) <> 3 then raise exception 'Every connector write must have an actor audit record'; end if;

  begin
    perform public.create_mcp_content_opportunity(
      v_workspace_a, extensions.gen_random_uuid(), v_actor_b, 'chatgpt_connector',
      jsonb_build_object('title', 'Cross workspace attempt')
    );
    raise exception 'Cross-workspace actor was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace actor was accepted' then raise; end if;
  end;

  begin
    perform public.create_mcp_content_opportunity(
      v_workspace_a, v_create_request, v_actor_c, 'chatgpt_connector',
      jsonb_build_object(
        'request_id', v_create_request,
        'title', 'Connector audit opportunity',
        'status', 'idea',
        'content_type', 'comparison'
      )
    );
    raise exception 'Request identity conflict was accepted';
  exception when others then
    if sqlerrm = 'Request identity conflict was accepted' then raise; end if;
  end;
end;
$test$;

rollback;
