begin;

do $test$
declare
  v_opportunity_id uuid;
  v_post_id uuid;
  v_status public.content_opportunity_status;
  v_other_workspace uuid := extensions.gen_random_uuid();
  v_other_product uuid := extensions.gen_random_uuid();
begin
  if (select count(*) from public.content_opportunities) < 10 then
    raise exception 'Expected at least ten seeded content opportunities';
  end if;
  if (
    select count(*) from public.posts
    where content_opportunity_id = '90000000-0000-4000-8000-000000000006'
  ) <> 2 then
    raise exception 'Antonia comparison must have two destination publications';
  end if;
  if has_table_privilege('anon', 'public.content_opportunities', 'select') then
    raise exception 'Anonymous role must not read content opportunities';
  end if;

  v_opportunity_id := public.create_content_opportunity(
    '11111111-1111-4111-8111-111111111111',
    'Lifecycle test',
    'ready',
    'standalone_product',
    null,
    'Publish',
    5
  );
  perform public.attach_content_opportunity_product(
    '11111111-1111-4111-8111-111111111111',
    v_opportunity_id,
    '30000000-0000-4000-8000-000000000001',
    'primary'
  );
  perform public.detach_content_opportunity_product(
    '11111111-1111-4111-8111-111111111111',
    v_opportunity_id,
    '30000000-0000-4000-8000-000000000001'
  );
  if exists (
    select 1 from public.content_opportunity_products
    where opportunity_id = v_opportunity_id
  ) then raise exception 'Detached product relationship remained'; end if;

  v_post_id := public.record_post(
    '11111111-1111-4111-8111-111111111111',
    v_opportunity_id,
    '20000000-0000-4000-8000-000000000001',
    now()
  );
  select status into v_status from public.content_opportunities where id = v_opportunity_id;
  if v_status <> 'posted' then
    raise exception 'First publication must move opportunity to posted';
  end if;
  if exists (
    select 1 from public.content_opportunities
    where id = v_opportunity_id
      and (next_action is not null or estimated_minutes_remaining <> 0)
  ) then
    raise exception 'Published content must have no remaining action or effort';
  end if;
  begin
    update public.content_opportunities
    set status = 'needs_caption'
    where id = v_opportunity_id;
    raise exception 'Published content was moved back to an unfinished stage';
  exception when others then
    if sqlerrm = 'Published content was moved back to an unfinished stage' then raise; end if;
  end;
  delete from public.posts where id = v_post_id;
  select status into v_status from public.content_opportunities where id = v_opportunity_id;
  if v_status <> 'ready' then
    raise exception 'Deleting the final publication must restore ready status';
  end if;
  if not exists (
    select 1 from public.content_opportunities
    where id = v_opportunity_id
      and next_action = 'Publish'
      and estimated_minutes_remaining = 5
  ) then
    raise exception 'Removing the final publication must restore publish readiness';
  end if;

  begin
    insert into public.content_opportunities (
      workspace_id, title, status, content_type
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'Invalid posted content',
      'posted',
      'standalone_product'
    );
    raise exception 'Invalid posted stage was accepted';
  exception when others then
    if sqlerrm = 'Invalid posted stage was accepted' then raise; end if;
  end;

  insert into public.workspaces (id, name, timezone)
  values (v_other_workspace, 'Other workspace', 'America/Chicago');
  insert into public.products (
    id, workspace_id, name, lifecycle_status, experience_level
  ) values (
    v_other_product, v_other_workspace, 'Other product', 'active', 'online_only'
  );
  begin
    insert into public.content_opportunity_products (
      opportunity_id, product_id, role
    ) values (
      '90000000-0000-4000-8000-000000000003',
      v_other_product,
      'supporting'
    );
    raise exception 'Cross-workspace relationship was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace relationship was accepted' then raise; end if;
  end;
end;
$test$;

rollback;
