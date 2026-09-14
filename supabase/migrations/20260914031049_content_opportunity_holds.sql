create table public.content_opportunity_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null,
  hold_reason text not null check (length(trim(hold_reason)) > 0),
  release_condition text not null check (length(trim(release_condition)) > 0),
  review_on date,
  held_at timestamptz not null default now(),
  held_by uuid not null,
  held_source text not null check (held_source in ('website', 'chatgpt_connector', 'migration')),
  released_at timestamptz,
  released_by uuid,
  released_source text check (released_source in ('website', 'chatgpt_connector', 'migration')),
  release_note text,
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (opportunity_id, workspace_id)
    references public.content_opportunities(id, workspace_id) on delete cascade,
  check (
    (released_at is null and released_by is null and released_source is null) or
    (released_at is not null and released_by is not null and released_source is not null)
  )
);

create unique index one_active_hold_per_opportunity
  on public.content_opportunity_holds(opportunity_id)
  where released_at is null;
create index content_opportunity_holds_workspace_review_idx
  on public.content_opportunity_holds(workspace_id, review_on, held_at desc)
  where released_at is null;
create index content_opportunity_holds_opportunity_history_idx
  on public.content_opportunity_holds(opportunity_id, held_at desc);

create trigger content_opportunity_holds_set_updated_at
  before update on public.content_opportunity_holds
  for each row execute function public.set_updated_at();

alter table public.content_opportunity_holds enable row level security;
revoke all on public.content_opportunity_holds from public, anon, authenticated;
grant all on public.content_opportunity_holds to service_role;

alter table public.mcp_mutation_requests
  drop constraint mcp_mutation_requests_action_check,
  add constraint mcp_mutation_requests_action_check check (
    action in (
      'create_content_opportunity',
      'update_content_opportunity',
      'record_post',
      'place_content_opportunity_on_hold',
      'update_content_opportunity_hold',
      'release_content_opportunity_hold'
    )
  );

create function public.place_content_opportunity_on_hold(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_hold_reason text,
  p_release_condition text,
  p_review_on date
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'hold_reason', trim(p_hold_reason),
    'release_condition', trim(p_release_condition),
    'review_on', p_review_on
  );
  v_result jsonb;
  v_stored_hash text;
  v_stored_actor uuid;
  v_stored_source text;
begin
  if p_source not in ('website', 'chatgpt_connector', 'migration') then
    raise exception 'Unsupported hold source';
  end if;
  if p_source = 'chatgpt_connector' and p_request_id is null then
    raise exception 'Connector hold request ID is required';
  end if;
  if trim(coalesce(p_hold_reason, '')) = '' then raise exception 'Hold reason is required'; end if;
  if trim(coalesce(p_release_condition, '')) = '' then raise exception 'Release condition is required'; end if;
  if p_actor_user_id is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_actor_user_id
  ) then raise exception 'Member is not authorized for this workspace'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hold:' || p_workspace_id::text || ':' || p_opportunity_id::text, 0)
  );
  if p_request_id is not null then
    select payload_hash, result, actor_user_id, source
      into v_stored_hash, v_result, v_stored_actor, v_stored_source
    from public.mcp_mutation_requests
    where workspace_id = p_workspace_id
      and action = 'place_content_opportunity_on_hold'
      and request_id = p_request_id;
    if found then
      if v_stored_hash <> pg_catalog.md5(v_payload::text)
        or v_stored_actor is distinct from p_actor_user_id
        or v_stored_source <> p_source
      then raise exception 'Request ID context conflict'; end if;
      return v_result;
    end if;
  end if;
  if not exists (
    select 1 from public.content_opportunities
    where id = p_opportunity_id and workspace_id = p_workspace_id and archived_at is null
    for update
  ) then raise exception 'Content opportunity is unavailable'; end if;
  if exists (
    select 1 from public.content_opportunity_holds
    where opportunity_id = p_opportunity_id and released_at is null
  ) then raise exception 'Content opportunity is already on hold'; end if;

  insert into public.content_opportunity_holds(
    workspace_id, opportunity_id, hold_reason, release_condition, review_on,
    held_by, held_source
  ) values (
    p_workspace_id, p_opportunity_id, trim(p_hold_reason),
    trim(p_release_condition), p_review_on, p_actor_user_id, p_source
  ) returning to_jsonb(content_opportunity_holds.*) into v_result;

  if p_request_id is not null then
    insert into public.mcp_mutation_requests(
      workspace_id, action, request_id, payload_hash, result, actor_user_id, source
    ) values (
      p_workspace_id, 'place_content_opportunity_on_hold', p_request_id,
      pg_catalog.md5(v_payload::text), v_result, p_actor_user_id, p_source
    );
  end if;
  return v_result;
end;
$$;

create function public.update_content_opportunity_hold(
  p_workspace_id uuid,
  p_hold_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_hold_reason text,
  p_release_condition text,
  p_review_on date
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'hold_id', p_hold_id,
    'expected_updated_at', p_expected_updated_at,
    'hold_reason', trim(p_hold_reason),
    'release_condition', trim(p_release_condition),
    'review_on', p_review_on
  );
  v_result jsonb;
  v_stored_hash text;
  v_stored_actor uuid;
  v_stored_source text;
begin
  if p_source not in ('website', 'chatgpt_connector') then raise exception 'Unsupported hold source'; end if;
  if p_source = 'chatgpt_connector' and p_request_id is null then raise exception 'Connector hold request ID is required'; end if;
  if trim(coalesce(p_hold_reason, '')) = '' then raise exception 'Hold reason is required'; end if;
  if trim(coalesce(p_release_condition, '')) = '' then raise exception 'Release condition is required'; end if;
  if p_actor_user_id is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_actor_user_id
  ) then raise exception 'Member is not authorized for this workspace'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hold-update:' || p_workspace_id::text || ':' || p_hold_id::text, 0)
  );
  if p_request_id is not null then
    select payload_hash, result, actor_user_id, source
      into v_stored_hash, v_result, v_stored_actor, v_stored_source
    from public.mcp_mutation_requests
    where workspace_id = p_workspace_id and action = 'update_content_opportunity_hold' and request_id = p_request_id;
    if found then
      if v_stored_hash <> pg_catalog.md5(v_payload::text)
        or v_stored_actor is distinct from p_actor_user_id
        or v_stored_source <> p_source
      then raise exception 'Request ID context conflict'; end if;
      return v_result;
    end if;
  end if;

  update public.content_opportunity_holds
  set hold_reason = trim(p_hold_reason),
      release_condition = trim(p_release_condition),
      review_on = p_review_on
  where id = p_hold_id
    and workspace_id = p_workspace_id
    and released_at is null
    and updated_at = p_expected_updated_at
  returning to_jsonb(content_opportunity_holds.*) into v_result;
  if v_result is null then raise exception 'Hold changed since it was last read'; end if;

  if p_request_id is not null then
    insert into public.mcp_mutation_requests(
      workspace_id, action, request_id, payload_hash, result, actor_user_id, source
    ) values (
      p_workspace_id, 'update_content_opportunity_hold', p_request_id,
      pg_catalog.md5(v_payload::text), v_result, p_actor_user_id, p_source
    );
  end if;
  return v_result;
end;
$$;

create function public.release_content_opportunity_hold(
  p_workspace_id uuid,
  p_hold_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_release_note text
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'hold_id', p_hold_id,
    'expected_updated_at', p_expected_updated_at,
    'release_note', nullif(trim(p_release_note), '')
  );
  v_result jsonb;
  v_stored_hash text;
  v_stored_actor uuid;
  v_stored_source text;
begin
  if p_source not in ('website', 'chatgpt_connector') then raise exception 'Unsupported hold source'; end if;
  if p_source = 'chatgpt_connector' and p_request_id is null then raise exception 'Connector hold request ID is required'; end if;
  if p_actor_user_id is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_actor_user_id
  ) then raise exception 'Member is not authorized for this workspace'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hold-release:' || p_workspace_id::text || ':' || p_hold_id::text, 0)
  );
  if p_request_id is not null then
    select payload_hash, result, actor_user_id, source
      into v_stored_hash, v_result, v_stored_actor, v_stored_source
    from public.mcp_mutation_requests
    where workspace_id = p_workspace_id and action = 'release_content_opportunity_hold' and request_id = p_request_id;
    if found then
      if v_stored_hash <> pg_catalog.md5(v_payload::text)
        or v_stored_actor is distinct from p_actor_user_id
        or v_stored_source <> p_source
      then raise exception 'Request ID context conflict'; end if;
      return v_result;
    end if;
  end if;

  update public.content_opportunity_holds
  set released_at = now(),
      released_by = p_actor_user_id,
      released_source = p_source,
      release_note = nullif(trim(p_release_note), '')
  where id = p_hold_id
    and workspace_id = p_workspace_id
    and released_at is null
    and updated_at = p_expected_updated_at
  returning to_jsonb(content_opportunity_holds.*) into v_result;
  if v_result is null then raise exception 'Hold changed since it was last read'; end if;

  if p_request_id is not null then
    insert into public.mcp_mutation_requests(
      workspace_id, action, request_id, payload_hash, result, actor_user_id, source
    ) values (
      p_workspace_id, 'release_content_opportunity_hold', p_request_id,
      pg_catalog.md5(v_payload::text), v_result, p_actor_user_id, p_source
    );
  end if;
  return v_result;
end;
$$;

revoke execute on function public.place_content_opportunity_on_hold(uuid, uuid, uuid, text, uuid, text, text, date) from public, anon, authenticated;
revoke execute on function public.update_content_opportunity_hold(uuid, uuid, uuid, text, uuid, timestamptz, text, text, date) from public, anon, authenticated;
revoke execute on function public.release_content_opportunity_hold(uuid, uuid, uuid, text, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.place_content_opportunity_on_hold(uuid, uuid, uuid, text, uuid, text, text, date) to service_role;
grant execute on function public.update_content_opportunity_hold(uuid, uuid, uuid, text, uuid, timestamptz, text, text, date) to service_role;
grant execute on function public.release_content_opportunity_hold(uuid, uuid, uuid, text, uuid, timestamptz, text) to service_role;

with arhaus as (
  select o.id, o.workspace_id, min(wm.user_id::text)::uuid as user_id
  from public.content_opportunities o
  join public.workspace_members wm on wm.workspace_id = o.workspace_id
  where o.title = 'Arhaus vases under $50'
    and o.archived_at is null
  group by o.id, o.workspace_id
  having count(*) = 1
)
insert into public.content_opportunity_holds(
  workspace_id, opportunity_id, hold_reason, release_condition,
  review_on, held_by, held_source
)
select
  workspace_id,
  id,
  'Arhaus is not currently commissionable through Elaine''s available affiliate channels.',
  'Arhaus becomes available through Mavely, or Elaine is approved for ShopMy and Arhaus is available there.',
  null,
  user_id,
  'migration'
from arhaus
on conflict (opportunity_id) where released_at is null do nothing;

update public.content_opportunities o
set next_action = null
where o.title = 'Arhaus vases under $50'
  and o.archived_at is null
  and exists (
    select 1 from public.content_opportunity_holds h
    where h.opportunity_id = o.id and h.released_at is null
  );
