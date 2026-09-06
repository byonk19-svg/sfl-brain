create extension if not exists pgcrypto with schema extensions;

create type public.product_lifecycle_status as enum ('active', 'discontinued', 'archived');
create type public.product_experience_level as enum ('online_only', 'seen_in_store', 'handled_in_store', 'owned', 'used_at_home');
create type public.stock_status as enum ('unknown', 'in_stock', 'out_of_stock', 'limited');
create type public.asset_type as enum ('photo', 'canva_graphic', 'video', 'screenshot');
create type public.asset_source as enum ('home', 'in_store', 'canva', 'web', 'other');
create type public.asset_product_role as enum ('primary', 'visible', 'comparison');
create type public.destination_platform as enum ('facebook_page', 'facebook_group', 'facebook_personal', 'instagram_feed', 'instagram_reel', 'instagram_story', 'other');
create type public.performance_label as enum ('unknown', 'weak', 'normal', 'winner');
create type public.radar_event_type as enum ('restock', 'price_drop', 'sale', 'seasonal', 'manual_trend', 'commission_boost');

create table public.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'America/Chicago' check (length(trim(timezone)) > 0),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  brand text,
  category text,
  lifecycle_status public.product_lifecycle_status not null default 'active',
  experience_level public.product_experience_level not null default 'online_only',
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.listings (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  retailer text not null check (length(trim(retailer)) > 0),
  retailer_product_id text,
  canonical_url text not null check (canonical_url ~ '^https?://'),
  variant_label text,
  current_price numeric(12,2) check (current_price is null or current_price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  stock_status public.stock_status not null default 'unknown',
  is_primary boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, canonical_url),
  unique (id, workspace_id),
  unique (id, product_id, workspace_id),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade
);

create unique index one_primary_listing_per_product on public.listings(product_id) where is_primary;
create index listings_product_id_idx on public.listings(product_id);
create index listings_workspace_retailer_idx on public.listings(workspace_id, lower(retailer));

create table public.affiliate_links (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  listing_id uuid not null,
  network text not null check (length(trim(network)) > 0),
  url text not null check (url ~ '^https?://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (listing_id, workspace_id) references public.listings(id, workspace_id) on delete cascade
);

create index affiliate_links_listing_id_idx on public.affiliate_links(listing_id);

create table public.assets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text,
  asset_type public.asset_type not null,
  source public.asset_source not null,
  storage_path text,
  original_filename text,
  notes text,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((storage_path is null) = (original_filename is null)),
  unique (id, workspace_id)
);

create table public.asset_products (
  asset_id uuid not null references public.assets(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  role public.asset_product_role not null default 'visible',
  primary key (asset_id, product_id)
);
create index asset_products_product_id_idx on public.asset_products(product_id);

create table public.destinations (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  platform public.destination_platform not null,
  posting_identity text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, name),
  unique (id, workspace_id)
);

create table public.posts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  destination_id uuid not null,
  published_at timestamptz not null,
  caption text,
  angle text,
  performance_label public.performance_label not null default 'unknown',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (destination_id, workspace_id) references public.destinations(id, workspace_id) on delete restrict
);
create index posts_workspace_published_idx on public.posts(workspace_id, published_at desc);
create index posts_destination_id_idx on public.posts(destination_id);

create table public.post_products (
  post_id uuid not null references public.posts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  role text,
  primary key (post_id, product_id)
);
create index post_products_product_id_idx on public.post_products(product_id);

create table public.post_assets (
  post_id uuid not null references public.posts(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  position integer check (position is null or position >= 0),
  primary key (post_id, asset_id)
);
create index post_assets_asset_id_idx on public.post_assets(asset_id);

create table public.post_metrics (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  captured_at timestamptz not null,
  reach bigint check (reach is null or reach >= 0),
  views bigint check (views is null or views >= 0),
  clicks bigint check (clicks is null or clicks >= 0),
  sales integer check (sales is null or sales >= 0),
  commission numeric(12,2) check (commission is null or commission >= 0),
  created_at timestamptz not null default now()
);
create index post_metrics_post_captured_idx on public.post_metrics(post_id, captured_at desc);

create table public.radar_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  listing_id uuid references public.listings(id) on delete set null,
  event_type public.radar_event_type not null,
  source text,
  happened_at timestamptz not null,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at >= happened_at),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade
);
create index radar_events_product_active_idx on public.radar_events(product_id, happened_at desc) where dismissed_at is null;
create index products_workspace_name_idx on public.products(workspace_id, lower(name));

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger listings_set_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger affiliate_links_set_updated_at before update on public.affiliate_links for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();

create function public.enforce_asset_product_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.assets a join public.products p on p.id = new.product_id
    where a.id = new.asset_id and a.workspace_id = p.workspace_id
  ) then raise exception 'Asset and product must belong to the same workspace'; end if;
  return new;
end;
$$;

create function public.enforce_post_product_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.posts po join public.products pr on pr.id = new.product_id
    where po.id = new.post_id and po.workspace_id = pr.workspace_id
  ) then raise exception 'Post and product must belong to the same workspace'; end if;
  return new;
end;
$$;

create function public.enforce_post_asset_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.posts p join public.assets a on a.id = new.asset_id
    where p.id = new.post_id and p.workspace_id = a.workspace_id
  ) then raise exception 'Post and asset must belong to the same workspace'; end if;
  return new;
end;
$$;

create function public.enforce_radar_listing_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.listing_id is not null and not exists (
    select 1 from public.listings l
    where l.id = new.listing_id and l.product_id = new.product_id and l.workspace_id = new.workspace_id
  ) then raise exception 'Radar listing must belong to the selected product and workspace'; end if;
  return new;
end;
$$;

create trigger asset_products_enforce_workspace before insert or update on public.asset_products for each row execute function public.enforce_asset_product_workspace();
create trigger post_products_enforce_workspace before insert or update on public.post_products for each row execute function public.enforce_post_product_workspace();
create trigger post_assets_enforce_workspace before insert or update on public.post_assets for each row execute function public.enforce_post_asset_workspace();
create trigger radar_events_enforce_workspace before insert or update on public.radar_events for each row execute function public.enforce_radar_listing_workspace();

create function public.record_post(
  p_workspace_id uuid,
  p_destination_id uuid,
  p_published_at timestamptz,
  p_product_ids uuid[],
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
  if coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception 'At least one product is required';
  end if;
  if not exists (select 1 from public.destinations d where d.id = p_destination_id and d.workspace_id = p_workspace_id and d.is_active) then
    raise exception 'Destination is unavailable';
  end if;
  if exists (
    select 1 from unnest(p_product_ids) as requested(id)
    left join public.products p on p.id = requested.id and p.workspace_id = p_workspace_id
    where p.id is null
  ) then
    raise exception 'A selected product does not belong to this workspace';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as requested(id)
    left join public.assets a on a.id = requested.id and a.workspace_id = p_workspace_id
    where a.id is null
  ) then
    raise exception 'A selected asset does not belong to this workspace';
  end if;

  insert into public.posts (workspace_id, destination_id, published_at, caption, angle, performance_label, notes)
  values (p_workspace_id, p_destination_id, p_published_at, nullif(trim(p_caption), ''), nullif(trim(p_angle), ''), p_performance_label, nullif(trim(p_notes), ''))
  returning id into v_post_id;

  insert into public.post_products (post_id, product_id)
  select v_post_id, id from unnest(p_product_ids) as requested(id) on conflict do nothing;
  insert into public.post_assets (post_id, asset_id, position)
  select v_post_id, id, row_number() over () - 1 from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as requested(id) on conflict do nothing;
  return v_post_id;
end;
$$;

create function public.create_product(
  p_workspace_id uuid,
  p_name text,
  p_experience_level public.product_experience_level,
  p_brand text default null,
  p_category text default null,
  p_tags text[] default '{}',
  p_notes text default null,
  p_retailer text default null,
  p_canonical_url text default null,
  p_current_price numeric default null,
  p_stock_status public.stock_status default 'unknown',
  p_affiliate_network text default null,
  p_affiliate_url text default null
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_product_id uuid;
  v_listing_id uuid;
begin
  if trim(p_name) = '' then raise exception 'Product name is required'; end if;
  if (p_retailer is null) <> (p_canonical_url is null) then raise exception 'Retailer and canonical URL must be supplied together'; end if;
  if (p_affiliate_network is null) <> (p_affiliate_url is null) then raise exception 'Affiliate network and URL must be supplied together'; end if;
  if p_affiliate_url is not null and p_canonical_url is null then raise exception 'Affiliate link requires a listing'; end if;

  insert into public.products (workspace_id, name, brand, category, experience_level, tags, notes)
  values (p_workspace_id, trim(p_name), nullif(trim(p_brand), ''), nullif(trim(p_category), ''), p_experience_level, coalesce(p_tags, '{}'), nullif(trim(p_notes), ''))
  returning id into v_product_id;

  if p_canonical_url is not null then
    insert into public.listings (workspace_id, product_id, retailer, canonical_url, current_price, stock_status, is_primary)
    values (p_workspace_id, v_product_id, trim(p_retailer), p_canonical_url, p_current_price, p_stock_status, true)
    returning id into v_listing_id;
  end if;

  if p_affiliate_url is not null then
    insert into public.affiliate_links (workspace_id, listing_id, network, url)
    values (p_workspace_id, v_listing_id, trim(p_affiliate_network), p_affiliate_url);
  end if;
  return v_product_id;
end;
$$;

create function public.add_listing(
  p_workspace_id uuid,
  p_product_id uuid,
  p_retailer text,
  p_canonical_url text,
  p_variant_label text default null,
  p_current_price numeric default null,
  p_stock_status public.stock_status default 'unknown',
  p_is_primary boolean default false
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_listing_id uuid;
begin
  if not exists (select 1 from public.products where id = p_product_id and workspace_id = p_workspace_id) then
    raise exception 'Product not found in workspace';
  end if;
  if p_is_primary then update public.listings set is_primary = false where product_id = p_product_id and is_primary; end if;
  insert into public.listings (workspace_id, product_id, retailer, canonical_url, variant_label, current_price, stock_status, is_primary)
  values (p_workspace_id, p_product_id, trim(p_retailer), p_canonical_url, nullif(trim(p_variant_label), ''), p_current_price, p_stock_status, p_is_primary)
  returning id into v_listing_id;
  return v_listing_id;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_asset_product_workspace() from public, anon, authenticated;
revoke execute on function public.enforce_post_product_workspace() from public, anon, authenticated;
revoke execute on function public.enforce_post_asset_workspace() from public, anon, authenticated;
revoke execute on function public.enforce_radar_listing_workspace() from public, anon, authenticated;
revoke execute on function public.record_post(uuid, uuid, timestamptz, uuid[], uuid[], text, text, public.performance_label, text) from public, anon, authenticated;
revoke execute on function public.create_product(uuid, text, public.product_experience_level, text, text, text[], text, text, text, numeric, public.stock_status, text, text) from public, anon, authenticated;
revoke execute on function public.add_listing(uuid, uuid, text, text, text, numeric, public.stock_status, boolean) from public, anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant execute on function public.record_post(uuid, uuid, timestamptz, uuid[], uuid[], text, text, public.performance_label, text) to service_role;
grant execute on function public.create_product(uuid, text, public.product_experience_level, text, text, text[], text, text, text, numeric, public.stock_status, text, text) to service_role;
grant execute on function public.add_listing(uuid, uuid, text, text, text, numeric, public.stock_status, boolean) to service_role;

alter table public.workspaces enable row level security;
alter table public.products enable row level security;
alter table public.listings enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.assets enable row level security;
alter table public.asset_products enable row level security;
alter table public.destinations enable row level security;
alter table public.posts enable row level security;
alter table public.post_products enable row level security;
alter table public.post_assets enable row level security;
alter table public.post_metrics enable row level security;
alter table public.radar_events enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sfl-assets', 'sfl-assets', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
