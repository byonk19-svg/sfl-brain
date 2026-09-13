-- This grant was added to the original workspace-membership migration after
-- that migration had already run on the hosted project. Applied migrations
-- are immutable, so restore the intended RLS-limited read privilege here.
grant usage on schema public to authenticated;
grant select on public.workspace_members to authenticated;
