import "server-only";

import { redirect } from "next/navigation";

import { createBrainService } from "@/lib/brain";
import { createAuthServerClient } from "@/lib/supabase/server";

export class WorkspaceAuthorizationError extends Error {}
export class WebsiteAuthenticationError extends Error {}

type WorkspaceMembership = { workspace_id: string; user_id: string };

export function resolveSingleWorkspaceMembership(
  userId: string | null,
  memberships: WorkspaceMembership[],
) {
  if (!userId) throw new WebsiteAuthenticationError("Sign in to continue.");
  if (
    memberships.length !== 1 ||
    memberships[0]?.user_id !== userId
  ) {
    throw new WorkspaceAuthorizationError(
      "You are signed in but not authorized for exactly one SFL workspace.",
    );
  }
  return memberships[0].workspace_id;
}

export function resolveWorkspaceFromMembership(
  userId: string | null,
  membership: { workspace_id: string; user_id: string } | null,
) {
  return resolveSingleWorkspaceMembership(userId, membership ? [membership] : []);
}

export async function resolveWebsiteWorkspace() {
  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const userId = data.claims.sub;
  const result = await auth
    .from("workspace_members")
    .select("workspace_id,user_id")
    .eq("user_id", userId)
    .limit(2);
  if (result.error) throw new WorkspaceAuthorizationError("Unable to verify workspace access.");
  return resolveSingleWorkspaceMembership(userId, result.data ?? []);
}

export async function createWebsiteBrainService() {
  return createBrainService(await resolveWebsiteWorkspace());
}
