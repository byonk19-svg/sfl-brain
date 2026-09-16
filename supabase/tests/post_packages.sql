begin;

do $test$
declare
  v_workspace_a uuid := 'e1000000-0000-4000-8000-000000000001';
  v_workspace_b uuid := 'e1000000-0000-4000-8000-000000000002';
  v_actor_a uuid := 'e2000000-0000-4000-8000-000000000001';
  v_actor_b uuid := 'e2000000-0000-4000-8000-000000000002';
  v_destination_a uuid := 'e3000000-0000-4000-8000-000000000001';
  v_destination_a2 uuid := 'e3000000-0000-4000-8000-000000000002';
  v_destination_b uuid := 'e3000000-0000-4000-8000-000000000003';
  v_opportunity_a uuid := 'e4000000-0000-4000-8000-000000000001';
  v_opportunity_b uuid := 'e4000000-0000-4000-8000-000000000002';
  v_asset_a uuid := 'e5000000-0000-4000-8000-000000000001';
  v_asset_a2 uuid := 'e5000000-0000-4000-8000-000000000002';
  v_asset_b uuid := 'e5000000-0000-4000-8000-000000000003';
  v_asset_a3 uuid := 'e5000000-0000-4000-8000-000000000004';
  v_package jsonb;
  v_package_id uuid;
  v_package_updated_at timestamptz;
  v_variant jsonb;
  v_variant_id uuid;
  v_variant_updated_at timestamptz;
  v_post jsonb;
  v_post_id uuid;
  v_distribution_item_id uuid;
  v_second_distribution_item_id uuid;
  v_second_package_id uuid;
  v_request_id uuid := 'e6000000-0000-4000-8000-000000000001';
  v_assets_request_id uuid := 'e6000000-0000-4000-8000-000000000002';
  v_record_request_id uuid := 'e6000000-0000-4000-8000-000000000003';
  v_skip_request_id uuid := 'e6000000-0000-4000-8000-000000000004';
  v_first_result jsonb;
begin
  insert into public.workspaces(id, name) values
    (v_workspace_a, 'Post package test A'),
    (v_workspace_b, 'Post package test B');
  insert into auth.users(id, aud, role, email, created_at, updated_at) values
    (v_actor_a, 'authenticated', 'authenticated', 'package-a@example.test', now(), now()),
    (v_actor_b, 'authenticated', 'authenticated', 'package-b@example.test', now(), now());
  insert into public.workspace_members(workspace_id, user_id) values
    (v_workspace_a, v_actor_a),
    (v_workspace_b, v_actor_b);
  insert into public.destinations(id, workspace_id, name, platform) values
    (v_destination_a, v_workspace_a, 'SFL Page', 'facebook_page'),
    (v_destination_a2, v_workspace_a, 'SFL Group', 'facebook_group'),
    (v_destination_b, v_workspace_b, 'Other workspace', 'other');
  insert into public.content_opportunities(id, workspace_id, title, status, content_type) values
    (v_opportunity_a, v_workspace_a, 'Package opportunity A', 'ready', 'comparison'),
    (v_opportunity_b, v_workspace_b, 'Package opportunity B', 'ready', 'comparison');
  insert into public.assets(id, workspace_id, title, asset_type, source) values
    (v_asset_a, v_workspace_a, 'Hero', 'photo', 'home'),
    (v_asset_a2, v_workspace_a, 'Supporting', 'canva_graphic', 'canva'),
    (v_asset_b, v_workspace_b, 'Wrong workspace', 'photo', 'home'),
    (v_asset_a3, v_workspace_a, 'Unused local asset', 'screenshot', 'web');

  if has_table_privilege('anon', 'public.post_packages', 'select, insert, update, delete')
    or has_table_privilege('authenticated', 'public.post_packages', 'select, insert, update, delete')
    or has_table_privilege('anon', 'public.post_package_caption_variants', 'select, insert, update, delete')
    or has_table_privilege('authenticated', 'public.post_package_caption_variants', 'select, insert, update, delete')
    or has_table_privilege('anon', 'public.post_package_assets', 'select, insert, update, delete')
    or has_table_privilege('authenticated', 'public.post_package_assets', 'select, insert, update, delete')
    or has_table_privilege('anon', 'public.post_package_destinations', 'select, insert, update, delete')
    or has_table_privilege('authenticated', 'public.post_package_destinations', 'select, insert, update, delete') then
    raise exception 'Browser roles must not access post package tables';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_post_package', 'update_post_package', 'upsert_post_package_caption_variant',
        'set_post_package_assets', 'set_post_package_destinations',
        'skip_post_package_destination', 'record_post_from_package', 'finish_post_package'
      )
      and (
        has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute')
      )
  ) then
    raise exception 'Browser roles must not execute post package RPCs';
  end if;

  v_package := public.create_post_package(
    v_workspace_a, v_opportunity_a, v_actor_a, 'chatgpt_connector', v_request_id,
    'Base caption one', 'Launch angle', 'Package notes'
  );
  if public.create_post_package(
    v_workspace_a, v_opportunity_a, v_actor_a, 'chatgpt_connector', v_request_id,
    'Base caption one', 'Launch angle', 'Package notes'
  ) <> v_package then raise exception 'Connector package create was not idempotent'; end if;
  v_package_id := (v_package->>'id')::uuid;
  v_package_updated_at := (v_package->>'updated_at')::timestamptz;
  if (v_package->>'sequence')::integer <> 1
    or v_package->>'status' <> 'draft'
    or v_package->>'created_by' <> v_actor_a::text
    or v_package->>'created_source' <> 'chatgpt_connector'
    or not exists (
      select 1 from public.mcp_mutation_requests
      where workspace_id = v_workspace_a and action = 'create_post_package'
        and request_id = v_request_id and actor_user_id = v_actor_a
        and source = 'chatgpt_connector'
    ) then raise exception 'Package create audit or initial state is incorrect'; end if;
  begin
    perform public.create_post_package(
      v_workspace_a, v_opportunity_a, v_actor_a, 'chatgpt_connector', v_request_id,
      'Conflicting retry', 'Launch angle', 'Package notes'
    );
    raise exception 'Connector request ID payload conflict was accepted';
  exception when others then
    if sqlerrm = 'Connector request ID payload conflict was accepted' then raise; end if;
  end;
  begin
    perform public.create_post_package(
      v_workspace_a, v_opportunity_a, v_actor_b, 'website', null,
      'Unauthorized package', null, null
    );
    raise exception 'Cross-workspace actor created a package';
  exception when others then
    if sqlerrm = 'Cross-workspace actor created a package' then raise; end if;
  end;

  begin
    perform public.create_post_package(
      v_workspace_a, v_opportunity_a, v_actor_a, 'website', null,
      'Second active', null, null
    );
    raise exception 'Second active package was accepted';
  exception when others then
    if sqlerrm = 'Second active package was accepted' then raise; end if;
  end;

  v_variant := public.upsert_post_package_caption_variant(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, null,
    'sfl_page', null, null, 'draft', null
  );
  v_variant_id := (v_variant->>'id')::uuid;
  v_variant_updated_at := (v_variant->>'updated_at')::timestamptz;
  if v_variant->>'body' <> 'Base caption one' then
    raise exception 'New caption variant did not copy the current base caption';
  end if;
  begin
    insert into public.posts(
      workspace_id, destination_id, published_at, caption_variant_id
    ) values (v_workspace_a, v_destination_a, now(), v_variant_id);
    raise exception 'Caption variant without package relationship was accepted';
  exception when others then
    if sqlerrm = 'Caption variant without package relationship was accepted' then raise; end if;
  end;

  v_package := public.update_post_package(
    v_workspace_a, v_package_id, v_actor_a, 'website', null,
    v_package_updated_at, 'Base caption two', 'Changed angle', 'Changed notes'
  );
  v_package_updated_at := (v_package->>'updated_at')::timestamptz;
  begin
    perform public.update_post_package(
      v_workspace_a, v_package_id, v_actor_a, 'website', null,
      v_package_updated_at - interval '1 second', 'Stale caption', null, null
    );
    raise exception 'Stale package update was accepted';
  exception when others then
    if sqlerrm = 'Stale package update was accepted' then raise; end if;
  end;
  if (select body from public.post_package_caption_variants where id = v_variant_id) <> 'Base caption one' then
    raise exception 'Base caption edit changed an existing caption variant';
  end if;

  v_variant := public.upsert_post_package_caption_variant(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, v_variant_id,
    'sfl_page', null, 'Approved caption', 'approved', v_variant_updated_at
  );
  v_variant_updated_at := (v_variant->>'updated_at')::timestamptz;
  v_variant := public.upsert_post_package_caption_variant(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, v_variant_id,
    'sfl_page', null, 'Edited approved caption', 'approved', v_variant_updated_at
  );
  if v_variant->>'status' <> 'draft' then
    raise exception 'Editing approved copy did not return it to draft';
  end if;
  v_variant_updated_at := (v_variant->>'updated_at')::timestamptz;
  begin
    perform public.upsert_post_package_caption_variant(
      v_workspace_a, v_package_id, v_actor_a, 'website', null, v_variant_id,
      'sfl_page', null, 'Stale variant', 'draft',
      v_variant_updated_at - interval '1 second'
    );
    raise exception 'Stale caption variant update was accepted';
  exception when others then
    if sqlerrm = 'Stale caption variant update was accepted' then raise; end if;
  end;

  begin
    perform public.set_post_package_assets(
      v_workspace_a, v_package_id, v_actor_a, 'development_tunnel', null, v_package_updated_at,
      jsonb_build_array()
    );
    raise exception 'Development connector write without request ID was accepted';
  exception when others then
    if sqlerrm = 'Development connector write without request ID was accepted' then raise; end if;
  end;
  begin
    perform public.set_post_package_assets(
      v_workspace_a, v_package_id, v_actor_a, 'website', null, v_package_updated_at,
      jsonb_build_array(
        jsonb_build_object('asset_id', v_asset_a, 'role', 'hero', 'position', 0),
        jsonb_build_object('asset_id', v_asset_a2, 'role', 'hero', 'position', 1)
      )
    );
    raise exception 'Multiple package heroes were accepted';
  exception when others then
    if sqlerrm = 'Multiple package heroes were accepted' then raise; end if;
  end;
  begin
    perform public.set_post_package_assets(
      v_workspace_a, v_package_id, v_actor_a, 'website', null, v_package_updated_at,
      jsonb_build_array(
        jsonb_build_object('asset_id', v_asset_a, 'role', 'hero', 'position', 0),
        jsonb_build_object('asset_id', v_asset_a2, 'role', 'supporting', 'position', 0)
      )
    );
    raise exception 'Duplicate package asset positions were accepted';
  exception when others then
    if sqlerrm = 'Duplicate package asset positions were accepted' then raise; end if;
  end;
  begin
    perform public.set_post_package_assets(
      v_workspace_a, v_package_id, v_actor_a, 'website', null, v_package_updated_at,
      jsonb_build_array(jsonb_build_object('asset_id', v_asset_b, 'role', 'hero', 'position', 0))
    );
    raise exception 'Cross-workspace package asset was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace package asset was accepted' then raise; end if;
  end;
  v_package := public.set_post_package_assets(
    v_workspace_a, v_package_id, v_actor_a, 'development_tunnel', v_assets_request_id, v_package_updated_at,
    jsonb_build_array(
      jsonb_build_object('asset_id', v_asset_a, 'role', 'hero', 'position', 0, 'note', 'Lead'),
      jsonb_build_object('asset_id', v_asset_a2, 'role', 'supporting', 'position', 1)
    )
  );
  v_first_result := v_package;
  if public.set_post_package_assets(
    v_workspace_a, v_package_id, v_actor_a, 'development_tunnel', v_assets_request_id, v_package_updated_at,
    jsonb_build_array(
      jsonb_build_object('asset_id', v_asset_a, 'role', 'hero', 'position', 0, 'note', 'Lead'),
      jsonb_build_object('asset_id', v_asset_a2, 'role', 'supporting', 'position', 1)
    )
  ) <> v_first_result then raise exception 'Non-create connector retry was not idempotent'; end if;
  v_package_updated_at := (v_package->>'updated_at')::timestamptz;
  begin
    perform public.set_post_package_assets(
      v_workspace_a, v_package_id, v_actor_a, 'website', null,
      v_package_updated_at - interval '1 second', jsonb_build_array()
    );
    raise exception 'Stale asset replacement was accepted';
  exception when others then
    if sqlerrm = 'Stale asset replacement was accepted' then raise; end if;
  end;

  begin
    perform public.upsert_post_package_caption_variant(
      v_workspace_a, v_package_id, v_actor_a, 'website', null, null,
      'custom', v_destination_b, 'Wrong workspace', 'draft', null
    );
    raise exception 'Cross-workspace destination override was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace destination override was accepted' then raise; end if;
  end;
  begin
    perform public.set_post_package_destinations(
      v_workspace_a, v_package_id, v_actor_a, 'website', null, v_package_updated_at,
      jsonb_build_array(jsonb_build_object('destination_id', v_destination_b, 'caption_variant_id', v_variant_id))
    );
    raise exception 'Cross-workspace distribution destination was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace distribution destination was accepted' then raise; end if;
  end;
  begin
    insert into public.post_packages(
      workspace_id, opportunity_id, sequence, base_caption, created_by, updated_by, created_source, updated_source
    ) values (v_workspace_a, v_opportunity_b, 99, 'Wrong workspace', v_actor_a, v_actor_a, 'website', 'website');
    raise exception 'Cross-workspace package opportunity was accepted';
  exception when others then
    if sqlerrm = 'Cross-workspace package opportunity was accepted' then raise; end if;
  end;

  v_package := public.set_post_package_destinations(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, v_package_updated_at,
    jsonb_build_array(
      jsonb_build_object('destination_id', v_destination_a, 'caption_variant_id', v_variant_id)
    )
  );
  v_package_updated_at := (v_package->>'updated_at')::timestamptz;
  select id into v_distribution_item_id
  from public.post_package_destinations
  where package_id = v_package_id and destination_id = v_destination_a;
  if v_distribution_item_id is null or not exists (
    select 1 from public.post_package_destinations
    where id = v_distribution_item_id and workspace_id = v_workspace_a
  ) then raise exception 'Distribution item UUID/workspace identity is missing'; end if;
  begin
    update public.post_package_destinations
    set workspace_id = v_workspace_b where id = v_distribution_item_id;
    raise exception 'Distribution item crossed workspace identity';
  exception when others then
    if sqlerrm = 'Distribution item crossed workspace identity' then raise; end if;
  end;
  begin
    perform public.set_post_package_destinations(
      v_workspace_a, v_package_id, v_actor_a, 'website', null,
      v_package_updated_at - interval '1 second',
      jsonb_build_array(
        jsonb_build_object('destination_id', v_destination_a, 'caption_variant_id', v_variant_id)
      )
    );
    raise exception 'Stale distribution replacement was accepted';
  exception when others then
    if sqlerrm = 'Stale distribution replacement was accepted' then raise; end if;
  end;

  begin
    perform public.record_post_from_package(
      v_workspace_a, v_package_id, v_distribution_item_id, v_actor_a, 'website', null,
      v_package_updated_at, now(), null
    );
    raise exception 'Draft caption variant was published';
  exception when others then
    if sqlerrm = 'Draft caption variant was published' then raise; end if;
  end;
  v_variant := public.upsert_post_package_caption_variant(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, v_variant_id,
    'sfl_page', null, 'Final approved caption', 'draft', v_variant_updated_at
  );
  v_variant_updated_at := (v_variant->>'updated_at')::timestamptz;
  v_variant := public.upsert_post_package_caption_variant(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, v_variant_id,
    'sfl_page', null, 'Final approved caption', 'approved', v_variant_updated_at
  );
  v_package_updated_at := (select updated_at from public.post_packages where id = v_package_id);
  begin
    perform public.record_post_from_package(
      v_workspace_a, v_package_id, v_distribution_item_id, v_actor_a, 'website', null,
      v_package_updated_at - interval '1 second', now(), 'Stale publication'
    );
    raise exception 'Stale package publication was accepted';
  exception when others then
    if sqlerrm = 'Stale package publication was accepted' then raise; end if;
  end;
  v_post := public.record_post_from_package(
    v_workspace_a, v_package_id, v_distribution_item_id, v_actor_a,
    'chatgpt_connector', v_record_request_id,
    v_package_updated_at, now(), 'Published from package'
  );
  v_first_result := v_post;
  if public.record_post_from_package(
    v_workspace_a, v_package_id, v_distribution_item_id, v_actor_a,
    'chatgpt_connector', v_record_request_id,
    v_package_updated_at, now(), 'Published from package'
  ) <> v_first_result then raise exception 'Publication retry was not idempotent'; end if;
  v_post_id := (v_post->>'id')::uuid;
  v_package_updated_at := (select updated_at from public.post_packages where id = v_package_id);
  if not exists (
    select 1 from public.posts
    where id = v_post_id and post_package_id = v_package_id
      and caption_variant_id = v_variant_id and caption = 'Final approved caption'
  ) or (v_post->>'package_updated_at')::timestamptz is distinct from
      (select updated_at from public.post_packages where id = v_package_id)
    or (v_post->>'distribution_item_id')::uuid <> v_distribution_item_id
    or (select status from public.post_packages where id = v_package_id) <> 'publishing'
    or (select status from public.content_opportunities where id = v_opportunity_a) <> 'posted'
    or (select status from public.post_package_destinations where package_id = v_package_id and destination_id = v_destination_a) <> 'published'
    or (select post_id from public.post_package_destinations where package_id = v_package_id and destination_id = v_destination_a) <> v_post_id
    or (select count(*) from public.post_assets where post_id = v_post_id) <> 2
    or (select position from public.post_assets where post_id = v_post_id and asset_id = v_asset_a) <> 0
    or (select position from public.post_assets where post_id = v_post_id and asset_id = v_asset_a2) <> 1 then
    raise exception 'Package publication snapshot was not atomic and exact';
  end if;
  begin
    perform public.record_post_from_package(
      v_workspace_a, v_package_id, v_distribution_item_id, v_actor_a, 'website', null,
      v_package_updated_at, now(), 'Duplicate publication'
    );
    raise exception 'Distribution item was published twice';
  exception when others then
    if sqlerrm = 'Distribution item was published twice' then raise; end if;
  end;
  if (select count(*) from public.posts where post_package_id = v_package_id) <> 1
    or position('FOR UPDATE' in upper(pg_get_functiondef(
      'public.record_post_from_package(uuid,uuid,uuid,uuid,text,uuid,timestamptz,timestamptz,text)'::regprocedure
    ))) = 0 then
    raise exception 'Publication serialization did not preserve exactly one Post';
  end if;

  v_package := public.set_post_package_destinations(
    v_workspace_a, v_package_id, v_actor_a, 'website', null, v_package_updated_at,
    jsonb_build_array(
      jsonb_build_object('destination_id', v_destination_a, 'caption_variant_id', v_variant_id),
      jsonb_build_object('destination_id', v_destination_a2, 'caption_variant_id', v_variant_id)
    )
  );
  v_package_updated_at := (v_package->>'updated_at')::timestamptz;
  select id into v_second_distribution_item_id
  from public.post_package_destinations
  where package_id = v_package_id and destination_id = v_destination_a2;
  if (select status from public.post_package_destinations where package_id = v_package_id and destination_id = v_destination_a) <> 'published'
    or (select status from public.post_package_destinations where package_id = v_package_id and destination_id = v_destination_a2) <> 'planned' then
    raise exception 'Late destination addition did not preserve published distribution history';
  end if;

  begin
    perform public.finish_post_package(
      v_workspace_a, v_package_id, v_actor_a, 'website', null,
      v_package_updated_at, 'closed'
    );
    raise exception 'Package with planned destinations was closed';
  exception when others then
    if sqlerrm = 'Package with planned destinations was closed' then raise; end if;
  end;
  begin
    perform public.finish_post_package(
      v_workspace_a, v_package_id, v_actor_a, 'website', null,
      v_package_updated_at, 'abandoned'
    );
    raise exception 'Package with a publication was abandoned';
  exception when others then
    if sqlerrm = 'Package with a publication was abandoned' then raise; end if;
  end;
  begin
    perform public.skip_post_package_destination(
      v_workspace_a, v_package_id, v_second_distribution_item_id, v_actor_a, 'website', null,
      v_package_updated_at - interval '1 second', 'Stale skip'
    );
    raise exception 'Stale destination skip was accepted';
  exception when others then
    if sqlerrm = 'Stale destination skip was accepted' then raise; end if;
  end;
  v_package := public.skip_post_package_destination(
    v_workspace_a, v_package_id, v_second_distribution_item_id, v_actor_a,
    'development_tunnel', v_skip_request_id,
    v_package_updated_at, 'Not needed this cycle'
  );
  v_first_result := v_package;
  if public.skip_post_package_destination(
    v_workspace_a, v_package_id, v_second_distribution_item_id, v_actor_a,
    'development_tunnel', v_skip_request_id,
    v_package_updated_at, 'Not needed this cycle'
  ) <> v_first_result then raise exception 'Skip retry was not idempotent'; end if;
  v_package_updated_at := (v_package->>'updated_at')::timestamptz;
  begin
    perform public.finish_post_package(
      v_workspace_a, v_package_id, v_actor_a, 'website', null,
      v_package_updated_at - interval '1 second', 'closed'
    );
    raise exception 'Stale package finish was accepted';
  exception when others then
    if sqlerrm = 'Stale package finish was accepted' then raise; end if;
  end;
  v_package := public.finish_post_package(
    v_workspace_a, v_package_id, v_actor_a, 'website', null,
    v_package_updated_at, 'closed'
  );
  if v_package->>'status' <> 'closed' or v_package->>'closed_at' is null then
    raise exception 'Resolved package did not close';
  end if;

  begin
    update public.post_packages set notes = 'mutated' where id = v_package_id;
    raise exception 'Closed package was updated';
  exception when others then if sqlerrm = 'Closed package was updated' then raise; end if; end;
  begin
    delete from public.post_package_caption_variants where id = v_variant_id;
    raise exception 'Closed package variant was deleted';
  exception when others then if sqlerrm = 'Closed package variant was deleted' then raise; end if; end;
  begin
    insert into public.post_package_assets(workspace_id, package_id, asset_id, role, position)
    values (v_workspace_a, v_package_id, v_asset_a3, 'supporting', 2);
    raise exception 'Closed package asset was inserted';
  exception when others then if sqlerrm = 'Closed package asset was inserted' then raise; end if; end;
  begin
    update public.post_package_destinations set skip_reason = 'mutated'
    where package_id = v_package_id and destination_id = v_destination_a2;
    raise exception 'Closed package destination was updated';
  exception when others then if sqlerrm = 'Closed package destination was updated' then raise; end if; end;
  begin
    update public.posts set caption = 'mutated' where id = v_post_id;
    raise exception 'Closed package publication was updated';
  exception when others then if sqlerrm = 'Closed package publication was updated' then raise; end if; end;
  begin
    delete from public.post_assets where post_id = v_post_id and asset_id = v_asset_a;
    raise exception 'Closed package publication asset was deleted';
  exception when others then if sqlerrm = 'Closed package publication asset was deleted' then raise; end if; end;

  v_package := public.create_post_package(
    v_workspace_a, v_opportunity_a, v_actor_a, 'website', null,
    'Next cycle', null, null
  );
  v_second_package_id := (v_package->>'id')::uuid;
  if (v_package->>'sequence')::integer <> 2 then
    raise exception 'Next package sequence was not allocated after closure';
  end if;
  begin
    update public.post_package_assets
    set package_id = v_second_package_id
    where package_id = v_package_id and asset_id = v_asset_a;
    raise exception 'Asset was moved out of a closed package';
  exception when others then if sqlerrm = 'Asset was moved out of a closed package' then raise; end if; end;
  perform public.finish_post_package(
    v_workspace_a, v_second_package_id, v_actor_a, 'website', null,
    (v_package->>'updated_at')::timestamptz, 'abandoned'
  );
  begin
    update public.post_packages set notes = 'mutated' where id = v_second_package_id;
    raise exception 'Abandoned package was updated';
  exception when others then if sqlerrm = 'Abandoned package was updated' then raise; end if; end;
end;
$test$;

rollback;
