// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ids = {
  opportunity: "90000000-0000-4000-8000-000000000001",
  package: "90000000-0000-4000-8000-000000000002",
  distribution: "90000000-0000-4000-8000-000000000003",
  destination: "90000000-0000-4000-8000-000000000004",
  variant: "90000000-0000-4000-8000-000000000005",
  asset: "90000000-0000-4000-8000-000000000006",
};

const brain = vi.hoisted(() => ({
  getFormOptions: vi.fn(),
  getPostPackageContext: vi.fn(),
}));

vi.mock("@/lib/website-auth", () => ({ createWebsiteBrainService: vi.fn(async () => brain) }));
vi.mock("@/app/actions", () => ({ recordPostAction: vi.fn() }));

import RecordPostPage from "@/app/record-post/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecordPostPage package publication", () => {
  it("shows the approved snapshot without editable caption, destination, product, or asset overrides", async () => {
    brain.getFormOptions.mockResolvedValue({
      opportunities: [{
        id: ids.opportunity,
        title: "Package opportunity",
        status: "ready",
        content_opportunity_assets: [],
      }],
      destinations: [],
      assets: [],
    });
    brain.getPostPackageContext.mockResolvedValue({
      opportunity_id: ids.opportunity,
      active_package: {
        id: ids.package,
        opportunity_id: ids.opportunity,
        sequence: 1,
        status: "draft",
        base_caption: "Base",
        working_angle: "Angle",
        notes: null,
        created_source: "website",
        updated_source: "website",
        created_at: "2026-09-15T12:00:00.000Z",
        updated_at: "2026-09-15T12:00:00.000Z",
        closed_at: null,
        abandoned_at: null,
        caption_variants: [{
          id: ids.variant,
          audience: "sfl_page",
          destination_id: null,
          body: "Exact approved caption",
          status: "approved",
          approved_by: "90000000-0000-4000-8000-000000000009",
          approved_at: "2026-09-15T12:00:00.000Z",
          created_at: "2026-09-15T12:00:00.000Z",
          updated_at: "2026-09-15T12:00:00.000Z",
        }],
        assets: [{
          asset_id: ids.asset,
          role: "hero",
          position: 0,
          note: null,
          asset: { id: ids.asset, title: "Exact hero", asset_type: "photo", source: "home", captured_at: null, signed_url: null },
        }],
        distribution_items: [{
          id: ids.distribution,
          destination_id: ids.destination,
          caption_variant_id: ids.variant,
          status: "planned",
          post_id: null,
          skip_reason: null,
          created_at: "2026-09-15T12:00:00.000Z",
          updated_at: "2026-09-15T12:00:00.000Z",
          destination: { id: ids.destination, name: "SFL Page", platform: "facebook_page", posting_identity: "Elaine", is_active: true },
        }],
      },
      prior_packages: [],
    });

    const view = render(await RecordPostPage({
      searchParams: Promise.resolve({ opportunity: ids.opportunity, distribution: ids.distribution }),
    }));

    expect(screen.getByText("Exact approved caption")).toBeVisible();
    expect(screen.getByText(/Exact hero · Hero/)).toBeVisible();
    expect(screen.getByText("SFL Page")).toBeVisible();
    expect(screen.getByRole("button", { name: "Record package publication" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Caption" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Destination" })).not.toBeInTheDocument();
    expect(view.container.querySelector('input[name="asset_ids"], input[name="product_ids"]')).toBeNull();
    expect(view.container.querySelector(`input[name="distribution_item_id"]`)).toHaveValue(ids.distribution);
    expect(view.container.querySelector('input[type="datetime-local"]')).toHaveAttribute("name", "published_at_local");
    expect(view.container.querySelector('input[type="hidden"][name="published_at"]')).toBeInTheDocument();
    expect(view.container.textContent).not.toContain("storage_path");
  });
});
