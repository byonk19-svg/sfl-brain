create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (user_id, workspace_id)
);

create index workspace_members_user_workspace_idx on public.workspace_members(user_id, workspace_id);
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from public, anon, authenticated;
grant all on public.workspace_members to service_role;
grant usage on schema public to authenticated;
grant select on public.workspace_members to authenticated;
create policy "Members can read their own memberships"
  on public.workspace_members for select to authenticated
  using ((select auth.uid()) = user_id);
