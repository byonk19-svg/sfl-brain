begin;

do $test$
declare
  v_workspace_a uuid := 'd1000000-0000-4000-8000-000000000001';
  v_workspace_b uuid := 'd1000000-0000-4000-8000-000000000002';
  v_actor_a uuid := 'd2000000-0000-4000-8000-000000000001';
  v_actor_b uuid := 'd2000000-0000-4000-8000-000000000002';
  v_opportunity_a uuid := 'd3000000-0000-4000-8000-000000000001';
  v_opportunity_b uuid := 'd3000000-0000-4000-8000-000000000002';
  v_request uuid := 'd4000000-0000-4000-8000-000000000001';
  v_hold jsonb;
  v_hold_id uuid;
  v_updated_at timestamptz;
begin
  if has_table_privilege('authenticated', 'public.content_opportunity_holds', 'select, insert, update, delete') then
    raise exception 'Authenticated role must not access hold history directly';
  end if;

  insert into public.workspaces(id, name) values
    (v_workspace_a, 'Hold test A'),
    (v_workspace_b, 'Hold test B');
  insert into public.content_opportunities(id, workspace_id, title, status, content_type) values
    (v_opportunity_a, v_workspace_a, 'Hold opportunity A', 'idea', 'comparison'),
    (v_opportunity_b, v_workspace_b, 'Hold opportunity B', 'needs_links', 'collection_roundup');
  set local session_replication_role = replica;
  insert into public.workspace_members(workspace_id, user_id) values
    (v_workspace_a, v_actor_a),
    (v_workspace_b, v_actor_b);
  set local session_replication_role = origin;

  v_hold := public.place_content_opportunity_on_hold(
    v_workspace_a, v_opportunity_a, v_actor_a, 'website', null,
    'Retailer is not commissionable',
    'Retailer becomes commissionable',
    current_date - 1
  );
  v_hold_id := (v_hold->>'id')::uuid;
  v_updated_at := (v_hold->>'updated_at')::timestamptz;

  if (select status from public.content_opportunities where id = v_opportunity_a) <> 'idea' then
    raise exception 'Placing a hold changed the editorial stage';
  end if;
  if (select count(*) from public.content_opportunity_holds where opportunity_id = v_opportunity_a and released_at is null) <> 1 then
    raise exception 'Expected one active hold';
  end if;

  begin
    perform public.place_content_opportunity_on_hold(
      v_workspace_a, v_opportunity_a, v_actor_a, 'website', null,
      'Duplicate', 'Duplicate', null
    );
    raise exception 'Duplicate active hold was accepted';
  exception when others then
    if sqlerrm = 'Duplicate active hold was accepted' then raise; end if;
  end;

  begin
    perform public.update_content_opportunity_hold(
      v_workspace_a, v_hold_id, v_actor_b, 'website', null, v_updated_at,
      'Cross workspace', 'Cross workspace', null
    );
    raise exception 'Cross-workspace hold edit was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace hold edit was accepted' then raise; end if;
  end;

  v_hold := public.update_content_opportunity_hold(
    v_workspace_a, v_hold_id, v_actor_a, 'website', null, v_updated_at,
    'Affiliate access is unavailable',
    'Affiliate access becomes available',
    current_date + 30
  );
  v_updated_at := (v_hold->>'updated_at')::timestamptz;

  begin
    perform public.release_content_opportunity_hold(
      v_workspace_a, v_hold_id, v_actor_a, 'website', null,
      v_updated_at - interval '1 second', null
    );
    raise exception 'Stale release was accepted';
  exception when others then
    if sqlerrm = 'Stale release was accepted' then raise; end if;
  end;

  perform public.release_content_opportunity_hold(
    v_workspace_a, v_hold_id, v_actor_a, 'website', null,
    v_updated_at, 'Affiliate access approved'
  );
  if not exists (
    select 1 from public.content_opportunity_holds
    where id = v_hold_id and released_at is not null and released_by = v_actor_a
  ) then raise exception 'Release history was not retained'; end if;

  perform public.place_content_opportunity_on_hold(
    v_workspace_a, v_opportunity_a, v_actor_a, 'chatgpt_connector', v_request,
    'Seasonal timing', 'The relevant season returns', null
  );
  perform public.place_content_opportunity_on_hold(
    v_workspace_a, v_opportunity_a, v_actor_a, 'chatgpt_connector', v_request,
    'Seasonal timing', 'The relevant season returns', null
  );
  if (select count(*) from public.content_opportunity_holds where opportunity_id = v_opportunity_a) <> 2 then
    raise exception 'Idempotent connector retry created another hold';
  end if;
  if not exists (
    select 1 from public.mcp_mutation_requests
    where workspace_id = v_workspace_a
      and action = 'place_content_opportunity_on_hold'
      and request_id = v_request
      and actor_user_id = v_actor_a
      and source = 'chatgpt_connector'
  ) then raise exception 'Connector hold mutation was not audited'; end if;

  begin
    perform public.place_content_opportunity_on_hold(
      v_workspace_b, v_opportunity_b, v_actor_a, 'website', null,
      'Wrong workspace', 'Wrong workspace', null
    );
    raise exception 'Unauthorized actor placed a hold';
  exception when others then
    if sqlerrm = 'Unauthorized actor placed a hold' then raise; end if;
  end;
end;
$test$;

rollback;
