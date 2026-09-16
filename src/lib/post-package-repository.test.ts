import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { PostPackageRepository } from "@/lib/post-package-repository";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "90000000-0000-4000-8000-000000000003";
const packageId = "91000000-0000-4000-8000-000000000001";
const actorId = "10000000-0000-4000-8000-000000000001";
const requestId = "92000000-0000-4000-8000-000000000001";
const updatedAt = "2026-09-15T12:00:00.000Z";

function packageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: packageId,
    workspace_id: workspaceId,
    opportunity_id: opportunityId,
    sequence: 2,
    status: "draft",
    base_caption: "Base caption",
    working_angle: "Angle",
    notes: null,
    created_source: "website",
    updated_source: "website",
    created_at: updatedAt,
    updated_at: updatedAt,
    closed_at: null,
    abandoned_at: null,
    post_package_caption_variants: [],
    post_package_assets: [{
      asset_id: "60000000-0000-4000-8000-000000000007",
      role: "hero",
      position: 0,
      note: null,
      assets: {
        id: "60000000-0000-4000-8000-000000000007",
        title: "Comparison image",
        asset_type: "photo",
        source: "home",
        captured_at: updatedAt,
        storage_path: "private/path.jpg",
      },
    }],
    post_package_destinations: [],
    ...overrides,
  };
}

function queryClient(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = order;
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "http://127.0.0.1:54321/storage/v1/object/sign/sfl-assets/private/path.jpg" },
    error: null,
  });
  const client = {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as unknown as SupabaseClient;
  return { client, createSignedUrl };
}

describe("PostPackageRepository", () => {
  it("loads one active package and terminal package summaries", async () => {
    const closed = packageRow({
      id: "91000000-0000-4000-8000-000000000002",
      sequence: 1,
      status: "closed",
      closed_at: updatedAt,
      post_package_assets: [],
    });
    const { client } = queryClient([packageRow(), closed]);

    const result = await new PostPackageRepository(client, workspaceId, {
      userId: actorId,
      source: "website",
    }).context(opportunityId);

    expect(result.active_package).toMatchObject({ id: packageId, status: "draft" });
    expect(result.prior_packages).toHaveLength(1);
    expect(result.prior_packages[0]).toMatchObject({ sequence: 1, status: "closed" });
  });

  it("returns ten-minute signed asset URLs without exposing storage paths", async () => {
    const { client, createSignedUrl } = queryClient([packageRow()]);

    const result = await new PostPackageRepository(client, workspaceId, {
      userId: actorId,
      source: "website",
    }).context(opportunityId);

    expect(createSignedUrl).toHaveBeenCalledWith("private/path.jpg", 600);
    const asset = result.active_package?.assets[0]?.asset;
    expect(asset?.signed_url).toMatch(/^http:\/\/127\.0\.0\.1/);
    expect(asset).not.toHaveProperty("storage_path");
  });

  it("calls create_post_package with the exact website actor context", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: packageRow(), error: null });
    const client = { rpc } as unknown as SupabaseClient;
    const repository = new PostPackageRepository(client, workspaceId, {
      userId: actorId,
      source: "website",
    });

    const saved = await repository.create({
      opportunity_id: opportunityId,
      base_caption: "Caption",
    });

    expect(rpc).toHaveBeenCalledWith("create_post_package", {
      p_workspace_id: workspaceId,
      p_opportunity_id: opportunityId,
      p_actor_user_id: actorId,
      p_source: "website",
      p_request_id: null,
      p_base_caption: "Caption",
      p_working_angle: null,
      p_notes: null,
    });
    expect(saved).toMatchObject({ id: packageId, status: "draft", sequence: 2 });
  });

  it("passes connector request IDs and exact optimistic mutation arguments", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: packageRow(), error: null });
    const client = { rpc } as unknown as SupabaseClient;
    const repository = new PostPackageRepository(client, workspaceId, {
      userId: actorId,
      source: "chatgpt_connector",
    });

    await repository.skipDestination({
      package_id: packageId,
      distribution_item_id: "93000000-0000-4000-8000-000000000001",
      expected_updated_at: updatedAt,
      request_id: requestId,
      skip_reason: "Audience mismatch",
    });

    expect(rpc).toHaveBeenCalledWith("skip_post_package_destination", {
      p_workspace_id: workspaceId,
      p_package_id: packageId,
      p_distribution_item_id: "93000000-0000-4000-8000-000000000001",
      p_actor_user_id: actorId,
      p_source: "chatgpt_connector",
      p_request_id: requestId,
      p_expected_updated_at: updatedAt,
      p_skip_reason: "Audience mismatch",
    });
  });

  it("rejects missing connector request IDs before an RPC call", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient;
    const repository = new PostPackageRepository(client, workspaceId, {
      userId: actorId,
      source: "chatgpt_connector",
    });

    await expect(repository.finish({
      package_id: packageId,
      expected_updated_at: updatedAt,
      outcome: "abandoned",
    })).rejects.toThrow(/request ID/i);
    expect(rpc).not.toHaveBeenCalled();
  });
});
