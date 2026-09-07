create type public.content_opportunity_status as enum (
  'idea',
  'needs_assets',
  'needs_links',
  'needs_caption',
  'ready',
  'posted',
  'revival_candidate'
);

create type public.content_opportunity_type as enum (
  'comparison',
  'in_store_find',
  'styled_at_home',
  'sale_restock',
  'collection_roundup',
  'standalone_product',
  'lifestyle_shop_the_look',
  'recommendation_response',
  'reel_video'
);

create type public.content_media_format as enum (
  'single_image',
  'carousel',
  'canva_graphic',
  'reel_video',
  'other'
);

create type public.content_opportunity_product_role as enum (
  'primary',
  'supporting',
  'comparison'
);

create type public.content_opportunity_asset_role as enum (
  'primary',
  'supporting',
  'comparison'
);

create table public.content_opportunities (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status public.content_opportunity_status not null default 'idea',
  content_type public.content_opportunity_type not null default 'standalone_product',
  media_format public.content_media_format,
  notes text,
  next_action text,
  estimated_minutes_remaining integer check (
    estimated_minutes_remaining is null or
    estimated_minutes_remaining between 0 and 480
  ),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create index content_opportunities_workspace_status_idx
  on public.content_opportunities(workspace_id, status, updated_at desc)
  where archived_at is null;
create index content_opportunities_workspace_type_idx
  on public.content_opportunities(workspace_id, content_type);

create table public.content_opportunity_products (
  opportunity_id uuid not null references public.content_opportunities(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  role public.content_opportunity_product_role not null default 'supporting',
  created_at timestamptz not null default now(),
  primary key (opportunity_id, product_id)
);

create unique index one_primary_product_per_opportunity
  on public.content_opportunity_products(opportunity_id)
  where role = 'primary';
create index content_opportunity_products_product_idx
  on public.content_opportunity_products(product_id);

create table public.content_opportunity_assets (
  opportunity_id uuid not null references public.content_opportunities(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.content_opportunity_asset_role not null default 'supporting',
  created_at timestamptz not null default now(),
  primary key (opportunity_id, asset_id)
);

create unique index one_primary_asset_per_opportunity
  on public.content_opportunity_assets(opportunity_id)
  where role = 'primary';
create index content_opportunity_assets_asset_idx
  on public.content_opportunity_assets(asset_id);

alter table public.posts
  add column content_opportunity_id uuid;

alter table public.posts
  add constraint posts_content_opportunity_workspace_fk
  foreign key (content_opportunity_id, workspace_id)
  references public.content_opportunities(id, workspace_id)
  on delete restrict;

create index posts_content_opportunity_published_idx
  on public.posts(content_opportunity_id, published_at desc)
  where content_opportunity_id is not null;

create trigger content_opportunities_set_updated_at
  before update on public.content_opportunities
  for each row execute function public.set_updated_at();

create function public.enforce_opportunity_product_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.content_opportunities o
    join public.products p on p.id = new.product_id
    where o.id = new.opportunity_id
      and o.workspace_id = p.workspace_id
  ) then
    raise exception 'Opportunity and product must belong to the same workspace';
  end if;
  return new;
end;
$$;

create function public.enforce_opportunity_asset_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.content_opportunities o
    join public.assets a on a.id = new.asset_id
    where o.id = new.opportunity_id
      and o.workspace_id = a.workspace_id
  ) then
    raise exception 'Opportunity and asset must belong to the same workspace';
  end if;
  return new;
end;
$$;

create trigger content_opportunity_products_enforce_workspace
  before insert or update on public.content_opportunity_products
  for each row execute function public.enforce_opportunity_product_workspace();

create trigger content_opportunity_assets_enforce_workspace
  before insert or update on public.content_opportunity_assets
  for each row execute function public.enforce_opportunity_asset_workspace();

create function public.enforce_published_opportunity_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('posted', 'revival_candidate') and not exists (
    select 1 from public.posts p where p.content_opportunity_id = new.id
  ) then
    raise exception 'Posted and revival stages require publication history';
  end if;
  if new.status not in ('posted', 'revival_candidate') and exists (
    select 1 from public.posts p where p.content_opportunity_id = new.id
  ) then
    raise exception 'Published content must remain posted or become a revival candidate';
  end if;
  return new;
end;
$$;

create trigger content_opportunities_enforce_published_status
  before insert or update of status on public.content_opportunities
  for each row execute function public.enforce_published_opportunity_status();

create function public.sync_opportunity_post_status()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_old_opportunity_id uuid;
  v_new_opportunity_id uuid;
begin
  if tg_op <> 'INSERT' then v_old_opportunity_id := old.content_opportunity_id; end if;
  if tg_op <> 'DELETE' then v_new_opportunity_id := new.content_opportunity_id; end if;

  if v_new_opportunity_id is not null then
    update public.content_opportunities
    set status = 'posted',
        next_action = null,
        estimated_minutes_remaining = 0
    where id = v_new_opportunity_id;
  end if;

  if v_old_opportunity_id is not null
     and v_old_opportunity_id is distinct from v_new_opportunity_id
     and not exists (
       select 1 from public.posts p
       where p.content_opportunity_id = v_old_opportunity_id
     ) then
    update public.content_opportunities
    set status = 'ready',
        next_action = 'Publish',
        estimated_minutes_remaining = 5
    where id = v_old_opportunity_id
      and status in ('posted', 'revival_candidate');
  end if;

  return coalesce(new, old);
end;
$$;

create trigger posts_sync_opportunity_status
  after insert or update of content_opportunity_id or delete on public.posts
  for each row execute function public.sync_opportunity_post_status();

create function public.create_content_opportunity(
  p_workspace_id uuid,
  p_title text,
  p_status public.content_opportunity_status,
  p_content_type public.content_opportunity_type,
  p_notes text default null,
  p_next_action text default null,
  p_estimated_minutes_remaining integer default null,
  p_media_format public.content_media_format default null,
  p_product_ids uuid[] default '{}',
  p_asset_ids uuid[] default '{}'
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_opportunity_id uuid;
begin
  if trim(p_title) = '' then raise exception 'Opportunity title is required'; end if;
  if p_status in ('posted', 'revival_candidate') then
    raise exception 'Use Record Post before choosing a published stage';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_product_ids, '{}'::uuid[])) requested(id)
    left join public.products p
      on p.id = requested.id and p.workspace_id = p_workspace_id
    where p.id is null
  ) then raise exception 'A selected product does not belong to this workspace'; end if;
  if exists (
    select 1 from unnest(coalesce(p_asset_ids, '{}'::uuid[])) requested(id)
    left join public.assets a
      on a.id = requested.id and a.workspace_id = p_workspace_id
    where a.id is null
  ) then raise exception 'A selected asset does not belong to this workspace'; end if;

  insert into public.content_opportunities (
    workspace_id, title, status, content_type, media_format, notes,
    next_action, estimated_minutes_remaining
  ) values (
    p_workspace_id, trim(p_title), p_status, p_content_type, p_media_format,
    nullif(trim(p_notes), ''), nullif(trim(p_next_action), ''),
    p_estimated_minutes_remaining
  ) returning id into v_opportunity_id;

  insert into public.content_opportunity_products (opportunity_id, product_id, role)
  select v_opportunity_id, requested.id,
    case when min(requested.ordinality) = 1
      then 'primary'::public.content_opportunity_product_role
      else 'supporting'::public.content_opportunity_product_role
    end
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) with ordinality requested(id, ordinality)
  group by requested.id;

  insert into public.content_opportunity_assets (opportunity_id, asset_id, role)
  select v_opportunity_id, requested.id,
    case when min(requested.ordinality) = 1
      then 'primary'::public.content_opportunity_asset_role
      else 'supporting'::public.content_opportunity_asset_role
    end
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) with ordinality requested(id, ordinality)
  group by requested.id;

  return v_opportunity_id;
end;
$$;

create function public.attach_content_opportunity_product(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_product_id uuid,
  p_role public.content_opportunity_product_role default 'supporting'
)
returns uuid language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.content_opportunities
    where id = p_opportunity_id and workspace_id = p_workspace_id and archived_at is null
  ) then raise exception 'Content opportunity is unavailable'; end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and workspace_id = p_workspace_id
  ) then raise exception 'Product is unavailable'; end if;
  if p_role = 'primary' then
    update public.content_opportunity_products
    set role = 'supporting'
    where opportunity_id = p_opportunity_id and role = 'primary';
  end if;
  insert into public.content_opportunity_products (opportunity_id, product_id, role)
  values (p_opportunity_id, p_product_id, p_role)
  on conflict (opportunity_id, product_id) do update set role = excluded.role;
  return p_product_id;
end;
$$;

create function public.attach_content_opportunity_asset(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_asset_id uuid,
  p_role public.content_opportunity_asset_role default 'supporting'
)
returns uuid language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.content_opportunities
    where id = p_opportunity_id and workspace_id = p_workspace_id and archived_at is null
  ) then raise exception 'Content opportunity is unavailable'; end if;
  if not exists (
    select 1 from public.assets
    where id = p_asset_id and workspace_id = p_workspace_id
  ) then raise exception 'Asset is unavailable'; end if;
  if p_role = 'primary' then
    update public.content_opportunity_assets
    set role = 'supporting'
    where opportunity_id = p_opportunity_id and role = 'primary';
  end if;
  insert into public.content_opportunity_assets (opportunity_id, asset_id, role)
  values (p_opportunity_id, p_asset_id, p_role)
  on conflict (opportunity_id, asset_id) do update set role = excluded.role;
  return p_asset_id;
end;
$$;

create function public.detach_content_opportunity_product(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_product_id uuid
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_product_id uuid;
begin
  delete from public.content_opportunity_products relation
  using public.content_opportunities opportunity
  where relation.opportunity_id = p_opportunity_id
    and relation.product_id = p_product_id
    and opportunity.id = relation.opportunity_id
    and opportunity.workspace_id = p_workspace_id
  returning relation.product_id into v_product_id;
  if v_product_id is null then raise exception 'Attached product was not found'; end if;
  return v_product_id;
end;
$$;

create function public.detach_content_opportunity_asset(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_asset_id uuid
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_asset_id uuid;
begin
  delete from public.content_opportunity_assets relation
  using public.content_opportunities opportunity
  where relation.opportunity_id = p_opportunity_id
    and relation.asset_id = p_asset_id
    and opportunity.id = relation.opportunity_id
    and opportunity.workspace_id = p_workspace_id
  returning relation.asset_id into v_asset_id;
  if v_asset_id is null then raise exception 'Attached asset was not found'; end if;
  return v_asset_id;
end;
$$;

drop function public.record_post(
  uuid, uuid, timestamptz, uuid[], uuid[], text, text,
  public.performance_label, text
);

create function public.record_post(
  p_workspace_id uuid,
  p_content_opportunity_id uuid,
  p_destination_id uuid,
  p_published_at timestamptz,
  p_product_ids uuid[] default '{}',
  p_asset_ids uuid[] default '{}',
  p_caption text default null,
  p_angle text default null,
  p_performance_label public.performance_label default 'unknown',
  p_notes text default null
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_post_id uuid;
begin
  if not exists (
    select 1 from public.content_opportunities o
    where o.id = p_content_opportunity_id
      and o.workspace_id = p_workspace_id
      and o.archived_at is null
  ) then raise exception 'Content opportunity is unavailable'; end if;
  if not exists (
    select 1 from public.destinations d
    where d.id = p_destination_id
      and d.workspace_id = p_workspace_id
      and d.is_active
  ) then raise exception 'Destination is unavailable'; end if;
  if exists (
    select 1 from unnest(coalesce(p_product_ids, '{}'::uuid[])) requested(id)
    left join public.products p
      on p.id = requested.id and p.workspace_id = p_workspace_id
    where p.id is null
  ) then raise exception 'A selected product does not belong to this workspace'; end if;
  if exists (
    select 1 from unnest(coalesce(p_asset_ids, '{}'::uuid[])) requested(id)
    left join public.content_opportunity_assets oa
      on oa.asset_id = requested.id
      and oa.opportunity_id = p_content_opportunity_id
    where oa.asset_id is null
  ) then raise exception 'A selected asset is not attached to this opportunity'; end if;

  insert into public.posts (
    workspace_id, content_opportunity_id, destination_id, published_at,
    caption, angle, performance_label, notes
  ) values (
    p_workspace_id, p_content_opportunity_id, p_destination_id, p_published_at,
    nullif(trim(p_caption), ''), nullif(trim(p_angle), ''),
    p_performance_label, nullif(trim(p_notes), '')
  ) returning id into v_post_id;

  insert into public.post_products (post_id, product_id)
  select v_post_id, product_id
  from (
    select product_id
    from public.content_opportunity_products
    where opportunity_id = p_content_opportunity_id
    union
    select id from unnest(coalesce(p_product_ids, '{}'::uuid[])) requested(id)
  ) products;

  insert into public.post_assets (post_id, asset_id, position)
  select v_post_id, id, row_number() over (order by ordinality) - 1
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) with ordinality requested(id, ordinality)
  on conflict do nothing;

  return v_post_id;
end;
$$;

revoke all on public.content_opportunities from anon, authenticated;
revoke all on public.content_opportunity_products from anon, authenticated;
revoke all on public.content_opportunity_assets from anon, authenticated;
grant all on public.content_opportunities to service_role;
grant all on public.content_opportunity_products to service_role;
grant all on public.content_opportunity_assets to service_role;

alter table public.content_opportunities enable row level security;
alter table public.content_opportunity_products enable row level security;
alter table public.content_opportunity_assets enable row level security;

revoke execute on function public.enforce_opportunity_product_workspace() from public, anon, authenticated;
revoke execute on function public.enforce_opportunity_asset_workspace() from public, anon, authenticated;
revoke execute on function public.enforce_published_opportunity_status() from public, anon, authenticated;
revoke execute on function public.sync_opportunity_post_status() from public, anon, authenticated;
revoke execute on function public.create_content_opportunity(
  uuid, text, public.content_opportunity_status,
  public.content_opportunity_type, text, text, integer,
  public.content_media_format, uuid[], uuid[]
) from public, anon, authenticated;
revoke execute on function public.attach_content_opportunity_product(
  uuid, uuid, uuid, public.content_opportunity_product_role
) from public, anon, authenticated;
revoke execute on function public.attach_content_opportunity_asset(
  uuid, uuid, uuid, public.content_opportunity_asset_role
) from public, anon, authenticated;
revoke execute on function public.detach_content_opportunity_product(
  uuid, uuid, uuid
) from public, anon, authenticated;
revoke execute on function public.detach_content_opportunity_asset(
  uuid, uuid, uuid
) from public, anon, authenticated;
revoke execute on function public.record_post(
  uuid, uuid, uuid, timestamptz, uuid[], uuid[], text, text,
  public.performance_label, text
) from public, anon, authenticated;

grant execute on function public.create_content_opportunity(
  uuid, text, public.content_opportunity_status,
  public.content_opportunity_type, text, text, integer,
  public.content_media_format, uuid[], uuid[]
) to service_role;
grant execute on function public.attach_content_opportunity_product(
  uuid, uuid, uuid, public.content_opportunity_product_role
) to service_role;
grant execute on function public.attach_content_opportunity_asset(
  uuid, uuid, uuid, public.content_opportunity_asset_role
) to service_role;
grant execute on function public.detach_content_opportunity_product(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.detach_content_opportunity_asset(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.record_post(
  uuid, uuid, uuid, timestamptz, uuid[], uuid[], text, text,
  public.performance_label, text
) to service_role;
