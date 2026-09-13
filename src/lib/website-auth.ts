import "server-only";

import { redirect } from "next/navigation";

import { createBrainService } from "@/lib/brain";
import { createAuthServerClient } from "@/lib/supabase/server";

export class WorkspaceAuthorizationError extends Error {}
export class WebsiteAuthenticationError extends Error {}

export function resolveWorkspaceFromMembership(
  userId: string | null,
  membership: { workspace_id: string; user_id: string } | null,
) {
  if (!userId) throw new WebsiteAuthenticationError("Sign in to continue.");
  if (!membership || membership.user_id !== userId) throw new WorkspaceAuthorizationError("You are signed in but not authorized for an SFL workspace.");
  return membership.workspace_id;
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
    .maybeSingle();
  if (result.error) throw new WorkspaceAuthorizationError("Unable to verify workspace access.");
  return resolveWorkspaceFromMembership(userId, result.data);
}

export async function createWebsiteBrainService() {
  return createBrainService(await resolveWebsiteWorkspace());
}
