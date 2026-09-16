import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

import { createBrainService } from "@/lib/brain";
import { getServerEnv } from "@/lib/env";

const integration = describe.runIf(process.env.SFL_INTEGRATION === "1");

integration("local Supabase integration", () => {
  it("authorizes destination management through workspace membership", async () => {
    const env = getServerEnv();
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const workspaceId = env.SFL_WORKSPACE_ID;
    const createdUser = await admin.auth.admin.createUser({
      email: `destination-${crypto.randomUUID()}@example.test`,
      email_confirm: true,
    });
    if (createdUser.error || !createdUser.data.user) throw new Error(createdUser.error?.message ?? "Destination actor was not created");
    const actorId = createdUser.data.user.id;
    const membership = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: actorId });
    if (membership.error) throw new Error(membership.error.message);
    const intruder = await admin.auth.admin.createUser({ email: `destination-nonmember-${crypto.randomUUID()}@example.test`, email_confirm: true });
    if (intruder.error || !intruder.data.user) throw new Error(intruder.error?.message ?? "Destination nonmember was not created");
    let destinationId: string | null = null;

    try {
      await expect(createBrainService(workspaceId, { userId: intruder.data.user.id, source: "website" }).createDestination({
        name: "Unauthorized destination",
        platform: "other",
        posting_identity: "Nonmember",
        notes: undefined,
        is_active: true,
      })).rejects.toThrow(/not a member/i);
      const brain = createBrainService(workspaceId, { userId: actorId, source: "website" });
      const created = await brain.createDestination({
        name: "Integration destination",
        platform: "other",
        posting_identity: "Integration actor",
        notes: "Created through membership-authorized service",
        is_active: true,
      });
      destinationId = created.id;
      await brain.updateDestination({
        id: destinationId,
        name: "Integration destination updated",
        platform: "other",
        posting_identity: "Integration actor",
        notes: undefined,
        is_active: false,
      });
      expect(await brain.getDestinations()).toContainEqual(expect.objectContaining({ id: destinationId, is_active: false }));
    } finally {
      if (destinationId) await admin.from("destinations").delete().eq("id", destinationId);
      await admin.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", actorId);
      await admin.auth.admin.deleteUser(actorId);
      await admin.auth.admin.deleteUser(intruder.data.user.id);
    }
  });

  it("creates and edits a typed post package through the real service boundary", async () => {
    const env = getServerEnv();
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const workspaceId = env.SFL_WORKSPACE_ID;
    const createdUser = await admin.auth.admin.createUser({
      email: `post-package-${crypto.randomUUID()}@example.test`,
      email_confirm: true,
    });
    if (createdUser.error || !createdUser.data.user) {
      throw new Error(createdUser.error?.message ?? "Integration actor was not created");
    }
    const actorId = createdUser.data.user.id;
    const membership = await admin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: actorId,
    });
    if (membership.error) throw new Error(membership.error.message);

    let opportunityId: string | null = null;
    try {
      const brain = createBrainService(workspaceId, {
        userId: actorId,
        source: "development_tunnel",
      });
      opportunityId = await brain.createContentOpportunity({
        title: `Package integration ${crypto.randomUUID()}`,
        status: "needs_caption",
        content_type: "comparison",
        media_format: "carousel",
        notes: undefined,
        next_action: "Prepare package",
        estimated_minutes_remaining: 10,
        product_ids: [],
        asset_ids: [],
      });

      const created = await brain.createPostPackage({
        opportunity_id: opportunityId,
        request_id: crypto.randomUUID(),
        base_caption: "Package base caption",
        working_angle: "Comparison",
      });
      expect(created).toMatchObject({ opportunity_id: opportunityId, sequence: 1, status: "draft" });

      let context = await brain.getPostPackageContext(opportunityId);
      const active = context.active_package;
      expect(active).toMatchObject({ id: created.id, base_caption: "Package base caption" });
      if (!active) throw new Error("Expected an active package");

      await brain.updatePostPackage({
        package_id: active.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: active.updated_at,
        base_caption: "Updated package base caption",
        working_angle: "Updated comparison",
        notes: "Working copy updated through the service",
      });

      context = await brain.getPostPackageContext(opportunityId);

      const variant = await brain.upsertPostPackageVariant({
        package_id: active.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: context.active_package!.updated_at,
        audience: "sfl_page",
        body: "Approved package caption",
        status: "approved",
      });
      expect(variant).toMatchObject({ audience: "sfl_page", status: "approved" });

      context = await brain.getPostPackageContext(opportunityId);
      const override = await brain.upsertPostPackageVariant({
        package_id: active.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: context.active_package!.updated_at,
        audience: "custom",
        destination_id: "20000000-0000-4000-8000-000000000001",
        body: "Exact Facebook Page caption",
        status: "approved",
      });
      expect(override).toMatchObject({
        destination_id: "20000000-0000-4000-8000-000000000001",
        status: "approved",
      });

      context = await brain.getPostPackageContext(opportunityId);
      await brain.setPostPackageAssets({
        package_id: active.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: context.active_package!.updated_at,
        assets: [{
          asset_id: "60000000-0000-4000-8000-000000000007",
          role: "hero",
          position: 0,
        }],
      });

      context = await brain.getPostPackageContext(opportunityId);
      await brain.setPostPackageDestinations({
        package_id: active.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: context.active_package!.updated_at,
        destinations: [{
          destination_id: "20000000-0000-4000-8000-000000000001",
          caption_variant_id: override.id,
        }],
      });

      context = await brain.getPostPackageContext(opportunityId);
      const distribution = context.active_package!.distribution_items[0]!;
      await brain.skipPostPackageDestination({
        package_id: active.id,
        distribution_item_id: distribution.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: context.active_package!.updated_at,
        skip_reason: "Integration verification",
      });

      expect((await brain.getPostPackageContext(opportunityId)).active_package).toMatchObject({
        base_caption: "Updated package base caption",
        assets: [expect.objectContaining({ role: "hero", position: 0 })],
        distribution_items: [expect.objectContaining({ status: "skipped" })],
      });

      context = await brain.getPostPackageContext(opportunityId);
      await brain.finishPostPackage({
        package_id: active.id,
        request_id: crypto.randomUUID(),
        expected_updated_at: context.active_package!.updated_at,
        outcome: "abandoned",
      });
      context = await brain.getPostPackageContext(opportunityId);
      expect(context.active_package).toBeNull();
      expect(context.prior_packages).toEqual([
        expect.objectContaining({ id: active.id, status: "abandoned" }),
      ]);
    } finally {
      if (opportunityId) {
        if (!/^[0-9a-f-]{36}$/i.test(opportunityId)) {
          throw new Error("Unsafe integration cleanup identifier");
        }
        execFileSync("docker", [
          "exec",
          "supabase_db_sfl-brain",
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `set session_replication_role = replica;
           delete from public.post_package_destinations where package_id in (select id from public.post_packages where opportunity_id = '${opportunityId}'::uuid);
           delete from public.post_package_assets where package_id in (select id from public.post_packages where opportunity_id = '${opportunityId}'::uuid);
           delete from public.post_package_caption_variants where package_id in (select id from public.post_packages where opportunity_id = '${opportunityId}'::uuid);
           delete from public.post_packages where opportunity_id = '${opportunityId}'::uuid;
           delete from public.content_opportunities where id = '${opportunityId}'::uuid;`,
        ], { stdio: "ignore" });
      }
      const deletedRequests = await admin
        .from("mcp_mutation_requests")
        .delete()
        .eq("actor_user_id", actorId);
      if (deletedRequests.error) throw new Error(deletedRequests.error.message);
      const deletedMembership = await admin
        .from("workspace_members")
        .delete()
        .eq("user_id", actorId);
      if (deletedMembership.error) throw new Error(deletedMembership.error.message);
      const deletedUser = await admin.auth.admin.deleteUser(actorId);
      if (deletedUser.error) throw new Error(deletedUser.error.message);
    }
  });

  it("loads the seeded ranking and Library through the real repository", async () => {
    const brain = createBrainService();

    const candidates = await brain.getTodayCandidates();
    const library = await brain.searchContentBacklog("Corinne", 10);

    expect(candidates[0]).toMatchObject({
      title: "Walmart swivel chair",
      candidate_type: "revival",
      estimated_effort_minutes: 10,
    });
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      title: "Corinne box dupes",
      status: "needs_caption",
    });
  });

  it("returns complete opportunity context with products, assets, and distributions", async () => {
    const context = await createBrainService().getOpportunityContext(
      "90000000-0000-4000-8000-000000000003",
    );

    expect(context).toMatchObject({
      title: "Corinne box dupes",
      content_opportunity_products: expect.arrayContaining([
        expect.objectContaining({ products: expect.objectContaining({ name: "McGee Corinne Boxes" }) }),
      ]),
      content_opportunity_assets: expect.arrayContaining([
        expect.objectContaining({ assets: expect.objectContaining({ title: "Corinne comparison image" }) }),
      ]),
    });
  });

  it("deduplicates cross-posts in the recent editorial mix", async () => {
    const inputs = await createBrainService().getContentOpportunityInputs();
    const antonia = inputs.find(
      (item) => item.title === "At Home Antonia comparison",
    );
    expect(antonia?.posts).toHaveLength(2);

    const mix = await createBrainService().getRecentContentMix(100);
    expect(
      mix.filter((item) => item.opportunity_id === antonia?.opportunityId),
    ).toHaveLength(1);
  });

  it("offers caption-ready work for a short no-photo session", async () => {
    const candidates = await createBrainService().getTodayCandidates({
      max_effort_minutes: 15,
      no_new_photos: true,
    });
    expect(candidates.some((item) => item.title === "Corinne box dupes")).toBe(true);
    expect(candidates.some((item) => item.title === "Home Depot hallway light")).toBe(false);
  });

  it("moves a captured opportunity to posted when its first distribution is recorded", async () => {
    const brain = createBrainService();
    const id = await brain.createContentOpportunity({
      title: `Integration ready ${crypto.randomUUID()}`,
      status: "ready",
      content_type: "standalone_product",
      media_format: undefined,
      notes: undefined,
      next_action: "Publish",
      estimated_minutes_remaining: 5,
      product_ids: [],
      asset_ids: [],
    });

    await brain.recordPost({
      content_opportunity_id: id,
      destination_id: "20000000-0000-4000-8000-000000000001",
      published_at: new Date().toISOString(),
      product_ids: [],
      asset_ids: [],
      performance_label: "unknown",
    });

    expect(await brain.getOpportunityContext(id)).toMatchObject({ status: "posted" });
    expect(
      (await brain.getTodayCandidates()).some((item) => item.opportunity_id === id),
    ).toBe(false);
  });

  it("supports reversible backlog archiving", async () => {
    const brain = createBrainService();
    const title = `Archive integration ${crypto.randomUUID()}`;
    const id = await brain.createContentOpportunity({
      title,
      status: "idea",
      content_type: "standalone_product",
      media_format: undefined,
      notes: undefined,
      next_action: "Decide the next step",
      estimated_minutes_remaining: undefined,
      product_ids: [],
      asset_ids: [],
    });

    await brain.setContentOpportunityArchived(id, true);
    expect(await brain.searchContentBacklog(title, 10)).toEqual([]);
    await brain.setContentOpportunityArchived(id, false);
    expect(await brain.searchContentBacklog(title, 10)).toHaveLength(1);
  });

  it("uploads and attaches an asset directly to a product-free opportunity", async () => {
    const brain = createBrainService();
    const id = await brain.createContentOpportunity({
      title: `Asset integration ${crypto.randomUUID()}`,
      status: "needs_assets",
      content_type: "lifestyle_shop_the_look",
      media_format: "single_image",
      notes: undefined,
      next_action: "Take pictures",
      estimated_minutes_remaining: 30,
      product_ids: [],
      asset_ids: [],
    });
    const assetId = await brain.uploadAsset({
      opportunityId: id,
      title: "Product-free content photo",
      source: "home",
      file: new File([new Uint8Array([137, 80, 78, 71])], "content.png", {
        type: "image/png",
      }),
    });

    expect(await brain.getOpportunityContext(id)).toMatchObject({
      content_opportunity_assets: expect.arrayContaining([
        expect.objectContaining({
          assets: expect.objectContaining({ id: assetId }),
        }),
      ]),
    });
  });

  it("idempotently creates one clearly labeled development test opportunity", async () => {
    const brain = createBrainService();
    const requestId = crypto.randomUUID();

    const first = await brain.createDevelopmentTestOpportunity(requestId);
    const retry = await brain.createDevelopmentTestOpportunity(requestId);

    expect(retry).toBe(first);
    expect(await brain.getOpportunityContext(first)).toMatchObject({
      title: `[Development MCP test] ${requestId}`,
      status: "idea",
      content_type: "unspecified",
    });
  });
});
