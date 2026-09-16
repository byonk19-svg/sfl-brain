// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostPackageContext } from "@/lib/post-package";
import { PostPackageWorkspace } from "@/components/post-package-workspace";

const destination = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Styled for Less",
  platform: "facebook_page",
  posting_identity: "Elaine",
  notes: "Main page",
  is_active: true,
};

const emptyContext: PostPackageContext = {
  opportunity_id: "30000000-0000-4000-8000-000000000001",
  active_package: null,
  prior_packages: [],
};

afterEach(cleanup);

describe("PostPackageWorkspace", () => {
  it("starts a package with base caption and working context", () => {
    const startPackage = vi.fn();
    render(
      <PostPackageWorkspace
        context={emptyContext}
        destinations={[destination]}
        opportunityAssets={[]}
        actions={{ startPackage }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Base caption"), {
      target: { value: "A warm room starts here." },
    });
    fireEvent.change(screen.getByLabelText("Working angle"), {
      target: { value: "Warm neutrals" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Start package" }).closest("form")!);

    expect(startPackage).toHaveBeenCalledOnce();
  });

  it("keeps active package controls visible and prior packages read-only", () => {
    render(
      <PostPackageWorkspace
        context={{
          opportunity_id: emptyContext.opportunity_id,
          active_package: {
            id: "40000000-0000-4000-8000-000000000001",
            opportunity_id: emptyContext.opportunity_id,
            sequence: 2,
            status: "publishing",
            base_caption: "Base copy",
            working_angle: "Seasonal room",
            notes: "Keep it useful",
            created_source: "website",
            updated_source: "website",
            created_at: "2026-09-15T12:00:00Z",
            updated_at: "2026-09-15T12:00:00Z",
            closed_at: null,
            abandoned_at: null,
            caption_variants: [{
              id: "50000000-0000-4000-8000-000000000001",
              audience: "sfl_page",
              destination_id: null,
              body: "Approved copy",
              status: "approved",
              approved_by: "10000000-0000-4000-8000-000000000001",
              approved_at: "2026-09-15T12:00:00Z",
              created_at: "2026-09-15T12:00:00Z",
              updated_at: "2026-09-15T12:00:00Z",
            }],
            assets: [{
              asset_id: "70000000-0000-4000-8000-000000000001",
              role: "hero",
              position: 0,
              note: "Lead image",
              asset: { id: "70000000-0000-4000-8000-000000000001", title: "Room preview", asset_type: "photo", source: "home", captured_at: null, signed_url: "https://example.test/signed-preview" },
            }],
            distribution_items: [{
              id: "60000000-0000-4000-8000-000000000001",
              destination_id: destination.id,
              caption_variant_id: "50000000-0000-4000-8000-000000000001",
              status: "planned",
              post_id: null,
              skip_reason: null,
              created_at: "2026-09-15T12:00:00Z",
              updated_at: "2026-09-15T12:00:00Z",
              destination,
            }, {
              id: "60000000-0000-4000-8000-000000000002",
              destination_id: "20000000-0000-4000-8000-000000000002",
              caption_variant_id: "50000000-0000-4000-8000-000000000001",
              status: "published",
              post_id: "80000000-0000-4000-8000-000000000001",
              skip_reason: null,
              created_at: "2026-09-15T12:00:00Z",
              updated_at: "2026-09-15T12:00:00Z",
              destination: { ...destination, id: "20000000-0000-4000-8000-000000000002", name: "SFL Group" },
            }, {
              id: "60000000-0000-4000-8000-000000000003",
              destination_id: "20000000-0000-4000-8000-000000000003",
              caption_variant_id: "50000000-0000-4000-8000-000000000001",
              status: "skipped",
              post_id: null,
              skip_reason: "Not a fit today",
              created_at: "2026-09-15T12:00:00Z",
              updated_at: "2026-09-15T12:00:00Z",
              destination: { ...destination, id: "20000000-0000-4000-8000-000000000003", name: "Instagram" },
            }],
          },
          prior_packages: [{
            id: "40000000-0000-4000-8000-000000000000",
            opportunity_id: emptyContext.opportunity_id,
            sequence: 1,
            status: "closed",
            base_caption: "Previous exact copy",
            working_angle: null,
            notes: null,
            created_source: "website",
            updated_source: "website",
            created_at: "2026-08-01T12:00:00Z",
            updated_at: "2026-08-02T12:00:00Z",
            closed_at: "2026-08-02T12:00:00Z",
            abandoned_at: null,
            caption_variants: [],
            assets: [],
            distribution_items: [],
          }],
        }}
        destinations={[destination, { ...destination, id: "20000000-0000-4000-8000-000000000002", name: "SFL Group" }, { ...destination, id: "20000000-0000-4000-8000-000000000003", name: "Instagram" }]}
        opportunityAssets={[{ id: "70000000-0000-4000-8000-000000000001", title: "Room preview", asset_type: "photo", signed_url: "https://example.test/signed-preview" }]}
        actions={{}}
      />,
    );

    expect(screen.getByLabelText("Base caption")).toHaveValue("Base copy");
    expect(screen.getByRole("button", { name: "Close package" })).toBeDisabled();
    expect(screen.getByText("Planned")).toBeVisible();
    expect(screen.getByText("Published")).toBeVisible();
    expect(screen.getByText("Skipped")).toBeVisible();
    expect(screen.getByRole("img", { name: "Room preview" })).toHaveAttribute("src", "https://example.test/signed-preview");
    expect(screen.getByLabelText("Role")).toHaveValue("hero");
    expect(screen.getByLabelText("Order")).toHaveValue(0);
    expect(screen.getByText("Previous exact copy")).toBeInTheDocument();
    expect(screen.getByText("Package 1 · Closed").closest("details")).toHaveAttribute("data-read-only", "true");
  });
});
