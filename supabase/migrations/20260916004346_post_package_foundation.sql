create type public.post_package_status as enum ('draft', 'publishing', 'closed', 'abandoned');
create type public.caption_variant_status as enum ('draft', 'approved');
create type public.caption_audience as enum ('sfl_page', 'sfl_groups', 'personal_groups', 'instagram', 'custom');
create type public.package_asset_role as enum ('hero', 'supporting', 'comparison');
create type public.distribution_item_status as enum ('planned', 'published', 'skipped');

create table public.post_packages (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null,
  sequence integer not null check (sequence > 0),
  status public.post_package_status not null default 'draft',
  base_caption text,
  working_angle text,
  notes text,
  created_by uuid references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_source text not null check (created_source in ('website', 'chatgpt_connector', 'development_tunnel', 'migration')),
  updated_source text not null check (updated_source in ('website', 'chatgpt_connector', 'development_tunnel', 'migration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  abandoned_at timestamptz,
  unique (id, workspace_id),
  unique (opportunity_id, sequence),
  foreign key (opportunity_id, workspace_id)
    references public.content_opportunities(id, workspace_id) on delete cascade,
  check ((status = 'closed') = (closed_at is not null)),
  check ((status = 'abandoned') = (abandoned_at is not null)),
  check (closed_at is null or abandoned_at is null),
  check (created_source = 'migration' or created_by is not null),
  check (updated_source = 'migration' or updated_by is not null)
);

create unique index one_active_post_package_per_opportunity
  on public.post_packages(opportunity_id)
  where status in ('draft', 'publishing');
create index post_packages_workspace_opportunity_idx
  on public.post_packages(workspace_id, opportunity_id, sequence desc);

create table public.post_package_caption_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null,
  package_id uuid not null,
  audience public.caption_audience not null,
  destination_id uuid,
  body text not null check (length(trim(body)) > 0),
  status public.caption_variant_status not null default 'draft',
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_source text not null check (created_source in ('website', 'chatgpt_connector', 'development_tunnel')),
  updated_source text not null check (updated_source in ('website', 'chatgpt_connector', 'development_tunnel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, package_id, workspace_id),
  foreign key (package_id, workspace_id)
    references public.post_packages(id, workspace_id) on delete cascade,
  foreign key (destination_id, workspace_id)
    references public.destinations(id, workspace_id) on delete restrict,
  check ((status = 'approved') = (approved_by is not null and approved_at is not null))
);

create unique index one_general_variant_per_audience
  on public.post_package_caption_variants(package_id, audience)
  where destination_id is null;
create unique index one_override_per_destination
  on public.post_package_caption_variants(package_id, destination_id)
  where destination_id is not null;

create table public.post_package_assets (
  workspace_id uuid not null,
  package_id uuid not null,
  asset_id uuid not null,
  role public.package_asset_role not null default 'supporting',
  position integer not null check (position >= 0),
  note text,
  created_at timestamptz not null default now(),
  primary key (package_id, asset_id),
  unique (package_id, position),
  foreign key (package_id, workspace_id)
    references public.post_packages(id, workspace_id) on delete cascade,
  foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id) on delete restrict
);

create unique index one_hero_per_post_package
  on public.post_package_assets(package_id) where role = 'hero';

create table public.post_package_destinations (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null,
  package_id uuid not null,
  destination_id uuid not null,
  caption_variant_id uuid not null,
  status public.distribution_item_status not null default 'planned',
  post_id uuid,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, package_id, workspace_id),
  unique (package_id, destination_id),
  foreign key (package_id, workspace_id)
    references public.post_packages(id, workspace_id) on delete cascade,
  foreign key (destination_id, workspace_id)
    references public.destinations(id, workspace_id) on delete restrict,
  foreign key (caption_variant_id, package_id, workspace_id)
    references public.post_package_caption_variants(id, package_id, workspace_id) on delete restrict,
  foreign key (post_id, workspace_id)
    references public.posts(id, workspace_id) on delete restrict,
  check (
    (status = 'published' and post_id is not null and skip_reason is null)
    or (status = 'planned' and post_id is null and skip_reason is null)
    or (status = 'skipped' and post_id is null)
  )
);

alter table public.posts
  add column post_package_id uuid,
  add column caption_variant_id uuid,
  add foreign key (post_package_id, workspace_id)
    references public.post_packages(id, workspace_id) on delete restrict,
  add foreign key (caption_variant_id, post_package_id, workspace_id)
    references public.post_package_caption_variants(id, package_id, workspace_id) on delete restrict,
  add constraint posts_caption_variant_requires_package
    check (caption_variant_id is null or post_package_id is not null),
  add constraint posts_package_publication_identity
    unique (id, workspace_id, post_package_id, destination_id, caption_variant_id);

alter table public.post_package_destinations
  add constraint post_package_destinations_publication_identity_fkey
  foreign key (post_id, workspace_id, package_id, destination_id, caption_variant_id)
  references public.posts(
    id, workspace_id, post_package_id, destination_id, caption_variant_id
  ) on delete restrict;

create unique index one_distribution_item_per_post
  on public.post_package_destinations(post_id) where post_id is not null;

create index posts_post_package_idx on public.posts(post_package_id)
  where post_package_id is not null;

create trigger post_packages_set_updated_at
  before update on public.post_packages
  for each row execute function public.set_updated_at();
create trigger post_package_caption_variants_set_updated_at
  before update on public.post_package_caption_variants
  for each row execute function public.set_updated_at();
create trigger post_package_destinations_set_updated_at
  before update on public.post_package_destinations
  for each row execute function public.set_updated_at();

create function public.reject_terminal_post_package_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('closed', 'abandoned') then
    raise exception 'Closed or abandoned post packages are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.reject_terminal_post_package_child_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op <> 'INSERT' and exists (
      select 1 from public.post_packages
      where id = old.package_id and status in ('closed', 'abandoned')
    )) or (tg_op <> 'DELETE' and exists (
      select 1 from public.post_packages
      where id = new.package_id and status in ('closed', 'abandoned')
    ))
  then raise exception 'Closed or abandoned post package contents are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger post_packages_reject_terminal_update
  before update or delete on public.post_packages
  for each row execute function public.reject_terminal_post_package_update();
create trigger post_package_variants_reject_terminal_mutation
  before insert or update or delete on public.post_package_caption_variants
  for each row execute function public.reject_terminal_post_package_child_mutation();
create trigger post_package_assets_reject_terminal_mutation
  before insert or update or delete on public.post_package_assets
  for each row execute function public.reject_terminal_post_package_child_mutation();
create trigger post_package_destinations_reject_terminal_mutation
  before insert or update or delete on public.post_package_destinations
  for each row execute function public.reject_terminal_post_package_child_mutation();

alter table public.post_packages enable row level security;
alter table public.post_package_caption_variants enable row level security;
alter table public.post_package_assets enable row level security;
alter table public.post_package_destinations enable row level security;
revoke all on public.post_packages from public, anon, authenticated;
revoke all on public.post_package_caption_variants from public, anon, authenticated;
revoke all on public.post_package_assets from public, anon, authenticated;
revoke all on public.post_package_destinations from public, anon, authenticated;
grant all on public.post_packages to service_role;
grant all on public.post_package_caption_variants to service_role;
grant all on public.post_package_assets to service_role;
grant all on public.post_package_destinations to service_role;

alter table public.mcp_mutation_requests
  drop constraint mcp_mutation_requests_action_check,
  add constraint mcp_mutation_requests_action_check check (
    action in (
      'create_content_opportunity', 'update_content_opportunity', 'record_post',
      'place_content_opportunity_on_hold', 'update_content_opportunity_hold',
      'release_content_opportunity_hold', 'create_post_package',
      'update_post_package', 'upsert_post_package_caption_variant',
      'set_post_package_assets', 'set_post_package_destinations',
      'skip_post_package_destination', 'record_post_from_package',
      'finish_post_package'
    )
  );

create function public.begin_post_package_mutation(
  p_workspace_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_result jsonb;
  v_hash text;
  v_actor uuid;
  v_source text;
begin
  if p_source not in ('website', 'chatgpt_connector', 'development_tunnel') then
    raise exception 'Unsupported post package mutation source';
  end if;
  if p_source = 'website' and p_request_id is not null then
    raise exception 'Website post package request ID must be null';
  end if;
  if p_source in ('chatgpt_connector', 'development_tunnel') and p_request_id is null then
    raise exception 'Connector post package request ID is required';
  end if;
  if p_source in ('website', 'chatgpt_connector', 'development_tunnel') and (
    p_actor_user_id is null or not exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id and user_id = p_actor_user_id
    )
  ) then raise exception 'Member is not authorized for this workspace'; end if;
  if p_actor_user_id is null then raise exception 'Post package actor is required'; end if;

  if p_request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_action || ':' || p_workspace_id::text || ':' || p_request_id::text, 0
      )
    );
    select payload_hash, result, actor_user_id, source
      into v_hash, v_result, v_actor, v_source
    from public.mcp_mutation_requests
    where workspace_id = p_workspace_id
      and action = p_action
      and request_id = p_request_id;
    if found then
      if v_hash <> pg_catalog.md5(p_payload::text)
        or v_actor is distinct from p_actor_user_id
        or v_source <> p_source
      then raise exception 'Request ID context conflict'; end if;
      return v_result;
    end if;
  end if;
  return null;
end;
$$;

create function public.complete_post_package_mutation(
  p_workspace_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_payload jsonb,
  p_result jsonb
)
returns void language plpgsql set search_path = '' as $$
begin
  if p_request_id is not null then
    insert into public.mcp_mutation_requests(
      workspace_id, action, request_id, payload_hash, result, actor_user_id, source
    ) values (
      p_workspace_id, p_action, p_request_id, pg_catalog.md5(p_payload::text),
      p_result, p_actor_user_id, p_source
    );
  end if;
end;
$$;

create function public.create_post_package(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_base_caption text,
  p_working_angle text,
  p_notes text
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'opportunity_id', p_opportunity_id, 'base_caption', nullif(trim(p_base_caption), ''),
    'working_angle', nullif(trim(p_working_angle), ''), 'notes', nullif(trim(p_notes), '')
  );
  v_result jsonb;
  v_sequence integer;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'create_post_package', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  if not exists (
    select 1 from public.content_opportunities
    where id = p_opportunity_id and workspace_id = p_workspace_id and archived_at is null
  ) then raise exception 'Content opportunity is unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('post_package_sequence:' || p_opportunity_id::text, 0)
  );
  select coalesce(max(sequence), 0) + 1 into v_sequence
  from public.post_packages where opportunity_id = p_opportunity_id;
  insert into public.post_packages(
    workspace_id, opportunity_id, sequence, base_caption, working_angle, notes,
    created_by, updated_by, created_source, updated_source
  ) values (
    p_workspace_id, p_opportunity_id, v_sequence, nullif(trim(p_base_caption), ''),
    nullif(trim(p_working_angle), ''), nullif(trim(p_notes), ''),
    p_actor_user_id, p_actor_user_id, p_source, p_source
  ) returning to_jsonb(post_packages.*) into v_result;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'create_post_package', p_actor_user_id, p_source, p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.update_post_package(
  p_workspace_id uuid,
  p_package_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_base_caption text,
  p_working_angle text,
  p_notes text
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'expected_updated_at', p_expected_updated_at,
    'base_caption', nullif(trim(p_base_caption), ''),
    'working_angle', nullif(trim(p_working_angle), ''), 'notes', nullif(trim(p_notes), '')
  );
  v_result jsonb;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'update_post_package', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  update public.post_packages
  set base_caption = nullif(trim(p_base_caption), ''),
      working_angle = nullif(trim(p_working_angle), ''),
      notes = nullif(trim(p_notes), ''), updated_by = p_actor_user_id, updated_source = p_source
  where id = p_package_id and workspace_id = p_workspace_id
    and status in ('draft', 'publishing') and updated_at = p_expected_updated_at
  returning to_jsonb(post_packages.*) into v_result;
  if v_result is null then raise exception 'Post package changed since it was last read'; end if;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'update_post_package', p_actor_user_id, p_source, p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.upsert_post_package_caption_variant(
  p_workspace_id uuid,
  p_package_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_variant_id uuid,
  p_audience text,
  p_destination_id uuid,
  p_body text,
  p_status text,
  p_expected_updated_at timestamptz
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'variant_id', p_variant_id, 'audience', p_audience,
    'destination_id', p_destination_id, 'body', p_body, 'status', p_status,
    'expected_updated_at', p_expected_updated_at
  );
  v_result jsonb;
  v_body text;
  v_old_body text;
  v_package_base_caption text;
  v_package_updated_at timestamptz;
  v_effective_status public.caption_variant_status;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'upsert_post_package_caption_variant', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  if p_audience not in ('sfl_page', 'sfl_groups', 'personal_groups', 'instagram', 'custom')
    or p_status not in ('draft', 'approved') then raise exception 'Invalid caption variant value'; end if;
  select base_caption, updated_at into v_package_base_caption, v_package_updated_at
  from public.post_packages
  where id = p_package_id and workspace_id = p_workspace_id
    and status in ('draft', 'publishing')
  for update;
  if not found then raise exception 'Post package is unavailable'; end if;
  if p_destination_id is not null and not exists (
    select 1 from public.destinations
    where id = p_destination_id and workspace_id = p_workspace_id and is_active
  ) then raise exception 'Destination override is unavailable'; end if;

  if p_variant_id is null then
    if v_package_updated_at is distinct from p_expected_updated_at then
      raise exception 'Post package changed since it was last read';
    end if;
    v_body := coalesce(nullif(trim(p_body), ''), nullif(trim(v_package_base_caption), ''));
    if v_body is null then raise exception 'Caption variant body is required'; end if;
    v_effective_status := p_status::public.caption_variant_status;
    insert into public.post_package_caption_variants(
      workspace_id, package_id, audience, destination_id, body, status,
      approved_by, approved_at, created_by, updated_by, created_source, updated_source
    ) values (
      p_workspace_id, p_package_id, p_audience::public.caption_audience, p_destination_id,
      v_body, v_effective_status,
      case when v_effective_status = 'approved' then p_actor_user_id end,
      case when v_effective_status = 'approved' then now() end,
      p_actor_user_id, p_actor_user_id, p_source, p_source
    ) returning to_jsonb(post_package_caption_variants.*) into v_result;
  else
    select body into v_old_body from public.post_package_caption_variants
    where id = p_variant_id and package_id = p_package_id and workspace_id = p_workspace_id
      and updated_at = p_expected_updated_at
    for update;
    if not found then raise exception 'Caption variant changed since it was last read'; end if;
    v_body := nullif(trim(p_body), '');
    if v_body is null then raise exception 'Caption variant body is required'; end if;
    v_effective_status := case
      when v_body is distinct from v_old_body then 'draft'::public.caption_variant_status
      else p_status::public.caption_variant_status
    end;
    update public.post_package_caption_variants
    set audience = p_audience::public.caption_audience, destination_id = p_destination_id,
        body = v_body, status = v_effective_status,
        approved_by = case when v_effective_status = 'approved' then p_actor_user_id end,
        approved_at = case when v_effective_status = 'approved' then now() end,
        updated_by = p_actor_user_id, updated_source = p_source
    where id = p_variant_id
    returning to_jsonb(post_package_caption_variants.*) into v_result;
  end if;
  update public.post_packages set updated_by = p_actor_user_id, updated_source = p_source
  where id = p_package_id and workspace_id = p_workspace_id;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'upsert_post_package_caption_variant', p_actor_user_id, p_source,
    p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.set_post_package_assets(
  p_workspace_id uuid,
  p_package_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_assets jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'expected_updated_at', p_expected_updated_at, 'assets', p_assets
  );
  v_result jsonb;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'set_post_package_assets', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  if jsonb_typeof(coalesce(p_assets, '[]'::jsonb)) <> 'array' then raise exception 'Assets must be an array'; end if;
  perform 1 from public.post_packages
  where id = p_package_id and workspace_id = p_workspace_id
    and status in ('draft', 'publishing') and updated_at = p_expected_updated_at
  for update;
  if not found then raise exception 'Post package changed since it was last read'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) item
    left join public.assets a on a.id = (item->>'asset_id')::uuid and a.workspace_id = p_workspace_id
    where a.id is null
  ) then raise exception 'A selected asset does not belong to this workspace'; end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) item where item->>'role' = 'hero') > 1
    then raise exception 'Only one hero asset is allowed'; end if;
  if exists (
    select (item->>'position')::integer
    from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) item
    group by (item->>'position')::integer having count(*) > 1
  ) then raise exception 'Package asset positions must be unique'; end if;
  delete from public.post_package_assets where package_id = p_package_id;
  insert into public.post_package_assets(workspace_id, package_id, asset_id, role, position, note)
  select p_workspace_id, p_package_id, (item->>'asset_id')::uuid,
    (item->>'role')::public.package_asset_role, (item->>'position')::integer,
    nullif(trim(item->>'note'), '')
  from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) item;
  update public.post_packages set updated_by = p_actor_user_id, updated_source = p_source
  where id = p_package_id returning to_jsonb(post_packages.*) into v_result;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'set_post_package_assets', p_actor_user_id, p_source, p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.set_post_package_destinations(
  p_workspace_id uuid,
  p_package_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_destinations jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'expected_updated_at', p_expected_updated_at,
    'destinations', p_destinations
  );
  v_result jsonb;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'set_post_package_destinations', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  if jsonb_typeof(coalesce(p_destinations, '[]'::jsonb)) <> 'array' then raise exception 'Destinations must be an array'; end if;
  perform 1 from public.post_packages
  where id = p_package_id and workspace_id = p_workspace_id
    and status in ('draft', 'publishing') and updated_at = p_expected_updated_at
  for update;
  if not found then raise exception 'Post package changed since it was last read'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_destinations, '[]'::jsonb)) item
    left join public.destinations d
      on d.id = (item->>'destination_id')::uuid and d.workspace_id = p_workspace_id and d.is_active
    left join public.post_package_caption_variants v
      on v.id = (item->>'caption_variant_id')::uuid and v.package_id = p_package_id
        and v.workspace_id = p_workspace_id
    where d.id is null or v.id is null
      or (v.destination_id is not null and v.destination_id <> d.id)
  ) then raise exception 'Distribution destination or caption variant is unavailable'; end if;
  if exists (
    select (item->>'destination_id')::uuid
    from jsonb_array_elements(coalesce(p_destinations, '[]'::jsonb)) item
    group by (item->>'destination_id')::uuid having count(*) > 1
  ) then raise exception 'Distribution destinations must be unique'; end if;
  if exists (
    select 1
    from public.post_package_destinations existing
    where existing.package_id = p_package_id
      and existing.status <> 'planned'
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_destinations, '[]'::jsonb)) item
        where (item->>'destination_id')::uuid = existing.destination_id
          and (item->>'caption_variant_id')::uuid = existing.caption_variant_id
      )
  ) then raise exception 'Published or skipped destinations must be preserved unchanged'; end if;
  delete from public.post_package_destinations existing
  where existing.package_id = p_package_id
    and existing.status = 'planned'
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_destinations, '[]'::jsonb)) item
      where (item->>'destination_id')::uuid = existing.destination_id
    );
  insert into public.post_package_destinations(
    id, workspace_id, package_id, destination_id, caption_variant_id
  )
  select coalesce((item->>'id')::uuid, extensions.gen_random_uuid()),
    p_workspace_id, p_package_id, (item->>'destination_id')::uuid,
    (item->>'caption_variant_id')::uuid
  from jsonb_array_elements(coalesce(p_destinations, '[]'::jsonb)) item
  on conflict (package_id, destination_id) do update
    set caption_variant_id = excluded.caption_variant_id
    where post_package_destinations.status = 'planned';
  update public.post_packages set updated_by = p_actor_user_id, updated_source = p_source
  where id = p_package_id returning to_jsonb(post_packages.*) into v_result;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'set_post_package_destinations', p_actor_user_id, p_source,
    p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.skip_post_package_destination(
  p_workspace_id uuid,
  p_package_id uuid,
  p_distribution_item_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_skip_reason text
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'distribution_item_id', p_distribution_item_id,
    'expected_updated_at', p_expected_updated_at, 'skip_reason', nullif(trim(p_skip_reason), '')
  );
  v_result jsonb;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'skip_post_package_destination', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  perform 1 from public.post_packages
  where id = p_package_id and workspace_id = p_workspace_id
    and status in ('draft', 'publishing') and updated_at = p_expected_updated_at
  for update;
  if not found then raise exception 'Post package changed since it was last read'; end if;
  update public.post_package_destinations
  set status = 'skipped', skip_reason = nullif(trim(p_skip_reason), '')
  where id = p_distribution_item_id and package_id = p_package_id
    and workspace_id = p_workspace_id and status = 'planned';
  if not found then raise exception 'Planned destination is unavailable'; end if;
  update public.post_packages set updated_by = p_actor_user_id, updated_source = p_source
  where id = p_package_id returning to_jsonb(post_packages.*) into v_result;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'skip_post_package_destination', p_actor_user_id, p_source,
    p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.record_post_from_package(
  p_workspace_id uuid,
  p_package_id uuid,
  p_distribution_item_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_published_at timestamptz,
  p_notes text
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'distribution_item_id', p_distribution_item_id,
    'expected_updated_at', p_expected_updated_at, 'published_at', p_published_at,
    'notes', nullif(trim(p_notes), '')
  );
  v_result jsonb;
  v_opportunity_id uuid;
  v_destination_id uuid;
  v_variant_id uuid;
  v_caption text;
  v_override_destination uuid;
  v_post_id uuid;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'record_post_from_package', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  select opportunity_id into v_opportunity_id
  from public.post_packages
  where id = p_package_id and workspace_id = p_workspace_id
    and status in ('draft', 'publishing') and updated_at = p_expected_updated_at
  for update;
  if not found then raise exception 'Post package changed since it was last read'; end if;

  select pd.destination_id, pd.caption_variant_id, v.body, v.destination_id
    into v_destination_id, v_variant_id, v_caption, v_override_destination
  from public.post_package_destinations pd
  join public.post_package_caption_variants v
    on v.id = pd.caption_variant_id and v.package_id = pd.package_id and v.workspace_id = pd.workspace_id
  join public.destinations d on d.id = pd.destination_id and d.workspace_id = pd.workspace_id
  where pd.id = p_distribution_item_id and pd.package_id = p_package_id
    and pd.workspace_id = p_workspace_id and pd.status = 'planned'
    and v.status = 'approved' and d.is_active
  for update of pd;
  if not found then raise exception 'Approved planned package destination is unavailable'; end if;
  if v_override_destination is not null and v_override_destination <> v_destination_id then
    raise exception 'Destination override does not match the publication destination';
  end if;
  insert into public.posts(
    workspace_id, content_opportunity_id, destination_id, published_at, caption,
    angle, notes, post_package_id, caption_variant_id
  )
  select p_workspace_id, opportunity_id, v_destination_id, p_published_at, v_caption,
    working_angle, nullif(trim(p_notes), ''), id, v_variant_id
  from public.post_packages where id = p_package_id
  returning id into v_post_id;
  insert into public.post_products(post_id, product_id)
  select v_post_id, product_id from public.content_opportunity_products
  where opportunity_id = v_opportunity_id;
  insert into public.post_assets(post_id, asset_id, position)
  select v_post_id, asset_id, position from public.post_package_assets
  where package_id = p_package_id order by position;
  update public.post_package_destinations
  set status = 'published', post_id = v_post_id, skip_reason = null
  where id = p_distribution_item_id and package_id = p_package_id
    and workspace_id = p_workspace_id and status = 'planned';
  if not found then raise exception 'Distribution item was published concurrently'; end if;
  update public.post_packages
  set status = 'publishing', updated_by = p_actor_user_id, updated_source = p_source
  where id = p_package_id and status = 'draft';
  select to_jsonb(posts.*) || jsonb_build_object(
    'distribution_item_id', p_distribution_item_id,
    'package_updated_at', (select updated_at from public.post_packages where id = p_package_id)
  ) into v_result from public.posts where id = v_post_id;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'record_post_from_package', p_actor_user_id, p_source,
    p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

create function public.finish_post_package(
  p_workspace_id uuid,
  p_package_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_outcome text
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'package_id', p_package_id, 'expected_updated_at', p_expected_updated_at, 'outcome', p_outcome
  );
  v_result jsonb;
  v_status public.post_package_status;
begin
  v_result := public.begin_post_package_mutation(
    p_workspace_id, 'finish_post_package', p_actor_user_id, p_source, p_request_id, v_payload
  );
  if v_result is not null then return v_result; end if;
  select status into v_status from public.post_packages
  where id = p_package_id and workspace_id = p_workspace_id and updated_at = p_expected_updated_at
    and status in ('draft', 'publishing')
  for update;
  if not found then raise exception 'Post package changed since it was last read'; end if;
  if p_outcome = 'closed' then
    if v_status <> 'publishing' then raise exception 'Only a publishing package can be closed'; end if;
    if exists (
      select 1 from public.post_package_destinations
      where package_id = p_package_id and status = 'planned'
    ) then raise exception 'Resolve every planned destination before closing'; end if;
    update public.post_packages
    set status = 'closed', closed_at = now(), updated_by = p_actor_user_id, updated_source = p_source
    where id = p_package_id returning to_jsonb(post_packages.*) into v_result;
  elsif p_outcome = 'abandoned' then
    if v_status <> 'draft' or exists (
      select 1 from public.posts where post_package_id = p_package_id
    ) then raise exception 'A package with a publication cannot be abandoned'; end if;
    update public.post_packages
    set status = 'abandoned', abandoned_at = now(), updated_by = p_actor_user_id, updated_source = p_source
    where id = p_package_id returning to_jsonb(post_packages.*) into v_result;
  else
    raise exception 'Post package outcome must be closed or abandoned';
  end if;
  perform public.complete_post_package_mutation(
    p_workspace_id, 'finish_post_package', p_actor_user_id, p_source, p_request_id, v_payload, v_result
  );
  return v_result;
end;
$$;

revoke execute on function public.reject_terminal_post_package_update() from public, anon, authenticated;
revoke execute on function public.reject_terminal_post_package_child_mutation() from public, anon, authenticated;
revoke execute on function public.begin_post_package_mutation(uuid,text,uuid,text,uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.complete_post_package_mutation(uuid,text,uuid,text,uuid,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.create_post_package(uuid,uuid,uuid,text,uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.update_post_package(uuid,uuid,uuid,text,uuid,timestamptz,text,text,text) from public, anon, authenticated;
revoke execute on function public.upsert_post_package_caption_variant(uuid,uuid,uuid,text,uuid,uuid,text,uuid,text,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.set_post_package_assets(uuid,uuid,uuid,text,uuid,timestamptz,jsonb) from public, anon, authenticated;
revoke execute on function public.set_post_package_destinations(uuid,uuid,uuid,text,uuid,timestamptz,jsonb) from public, anon, authenticated;
revoke execute on function public.skip_post_package_destination(uuid,uuid,uuid,uuid,text,uuid,timestamptz,text) from public, anon, authenticated;
revoke execute on function public.record_post_from_package(uuid,uuid,uuid,uuid,text,uuid,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke execute on function public.finish_post_package(uuid,uuid,uuid,text,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.begin_post_package_mutation(uuid,text,uuid,text,uuid,jsonb) to service_role;
grant execute on function public.complete_post_package_mutation(uuid,text,uuid,text,uuid,jsonb,jsonb) to service_role;
grant execute on function public.create_post_package(uuid,uuid,uuid,text,uuid,text,text,text) to service_role;
grant execute on function public.update_post_package(uuid,uuid,uuid,text,uuid,timestamptz,text,text,text) to service_role;
grant execute on function public.upsert_post_package_caption_variant(uuid,uuid,uuid,text,uuid,uuid,text,uuid,text,text,timestamptz) to service_role;
grant execute on function public.set_post_package_assets(uuid,uuid,uuid,text,uuid,timestamptz,jsonb) to service_role;
grant execute on function public.set_post_package_destinations(uuid,uuid,uuid,text,uuid,timestamptz,jsonb) to service_role;
grant execute on function public.skip_post_package_destination(uuid,uuid,uuid,uuid,text,uuid,timestamptz,text) to service_role;
grant execute on function public.record_post_from_package(uuid,uuid,uuid,uuid,text,uuid,timestamptz,timestamptz,text) to service_role;
grant execute on function public.finish_post_package(uuid,uuid,uuid,text,uuid,timestamptz,text) to service_role;

create function public.backfill_legacy_post_packages()
returns void language plpgsql set search_path = '' as $$
begin
  insert into public.post_packages(
    workspace_id, opportunity_id, sequence, status, base_caption, working_angle, notes,
    created_by, updated_by, created_source, updated_source
  )
  select p.workspace_id, p.content_opportunity_id, 1, 'draft', null, null, null,
    null, null, 'migration', 'migration'
  from public.posts p
  where p.content_opportunity_id is not null
    and not exists (
      select 1 from public.post_packages existing
      where existing.opportunity_id = p.content_opportunity_id
    )
  group by p.workspace_id, p.content_opportunity_id;

  update public.posts p
  set post_package_id = pp.id
  from public.post_packages pp
  where pp.workspace_id = p.workspace_id
    and pp.opportunity_id = p.content_opportunity_id
    and pp.sequence = 1
    and pp.created_source = 'migration'
    and p.post_package_id is null;

  update public.post_packages
  set status = 'closed', closed_at = now(), updated_source = 'migration'
  where created_source = 'migration' and status = 'draft';
end;
$$;

revoke execute on function public.backfill_legacy_post_packages()
  from public, anon, authenticated, service_role;

select public.backfill_legacy_post_packages();

create function public.reject_terminal_post_package_publication_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.post_packages
    where id in (old.post_package_id, new.post_package_id)
      and status in ('closed', 'abandoned')
  ) then raise exception 'Publications in closed or abandoned post packages are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.reject_terminal_post_package_publication_asset_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1
    from public.posts p
    join public.post_packages pp on pp.id = p.post_package_id
    where (
      (tg_op <> 'INSERT' and p.id = old.post_id)
      or (tg_op <> 'DELETE' and p.id = new.post_id)
    ) and pp.status in ('closed', 'abandoned')
  ) then raise exception 'Publication assets in closed or abandoned post packages are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger posts_reject_terminal_package_mutation
  before update or delete on public.posts
  for each row execute function public.reject_terminal_post_package_publication_mutation();
create trigger post_assets_reject_terminal_package_mutation
  before insert or update or delete on public.post_assets
  for each row execute function public.reject_terminal_post_package_publication_asset_mutation();

revoke execute on function public.reject_terminal_post_package_publication_mutation()
  from public, anon, authenticated;
revoke execute on function public.reject_terminal_post_package_publication_asset_mutation()
  from public, anon, authenticated;
