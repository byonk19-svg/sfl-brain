// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("copies approved copy, defers publication recording, and renders complete prior packages read-only", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
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
            working_angle: "Archived angle",
            notes: "Archived package note",
            created_source: "website",
            updated_source: "website",
            created_at: "2026-08-01T12:00:00Z",
            updated_at: "2026-08-02T12:00:00Z",
            closed_at: "2026-08-02T12:00:00Z",
            abandoned_at: null,
            caption_variants: [{
              id: "50000000-0000-4000-8000-000000000009",
              audience: "custom",
              destination_id: "20000000-0000-4000-8000-000000000003",
              body: "Archived approved override",
              status: "approved",
              approved_by: "10000000-0000-4000-8000-000000000001",
              approved_at: "2026-08-01T13:00:00Z",
              created_at: "2026-08-01T12:00:00Z",
              updated_at: "2026-08-01T13:00:00Z",
            }],
            assets: [{
              asset_id: "70000000-0000-4000-8000-000000000009",
              role: "hero",
              position: 0,
              note: "Archived hero note",
              asset: { id: "70000000-0000-4000-8000-000000000009", title: "Archived room", asset_type: "photo", source: "home", captured_at: "2026-07-31T12:00:00Z", signed_url: "https://example.test/archive-preview" },
            }, {
              asset_id: "70000000-0000-4000-8000-000000000010",
              role: "supporting",
              position: 1,
              note: "Archived motion",
              asset: { id: "70000000-0000-4000-8000-000000000010", title: "Archived room tour", asset_type: "video", source: "home", captured_at: "2026-07-31T12:00:00Z", signed_url: "https://example.test/archive-video.mp4" },
            }],
            distribution_items: [{
              id: "60000000-0000-4000-8000-000000000009",
              destination_id: "20000000-0000-4000-8000-000000000003",
              caption_variant_id: "50000000-0000-4000-8000-000000000009",
              status: "skipped",
              post_id: null,
              skip_reason: "Archived skip reason",
              created_at: "2026-08-01T12:00:00Z",
              updated_at: "2026-08-02T12:00:00Z",
              destination: { ...destination, id: "20000000-0000-4000-8000-000000000003", name: "Instagram" },
            }],
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
    expect(screen.getAllByText("Skipped")[0]).toBeVisible();
    expect(screen.getByRole("img", { name: "Room preview" })).toHaveAttribute("src", "https://example.test/signed-preview");
    expect(screen.getByLabelText("Role")).toHaveValue("hero");
    expect(screen.getByLabelText("Order")).toHaveValue(0);
    expect(screen.queryByRole("link", { name: "Record publication" })).not.toBeInTheDocument();
    expect(screen.getByText(/Publication recording will be available here once package publishing is connected/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Copy SFL Page caption" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Approved copy"));
    expect(screen.getByText("Previous exact copy")).toBeInTheDocument();
    const archive = screen.getByText("Package 1 · Closed").closest("details")!;
    expect(archive).toHaveAttribute("data-read-only", "true");
    fireEvent.click(screen.getByText("Package 1 · Closed"));
    expect(screen.getByText("Archived angle")).toBeVisible();
    expect(screen.getByText("Archived package note")).toBeVisible();
    expect(screen.getByText("Archived approved override")).toBeVisible();
    expect(screen.getByText("Custom audience · Instagram")).toBeVisible();
    expect(screen.getByRole("img", { name: "Archived room" })).toHaveAttribute("src", "https://example.test/archive-preview");
    expect(archive.querySelector("video")).toHaveAttribute("src", "https://example.test/archive-video.mp4");
    expect(archive.querySelector("video")).toHaveAttribute("controls");
    expect(archive.querySelector("video")).toHaveAttribute("preload", "metadata");
    expect(screen.getByText("Hero · position 1 · Archived hero note")).toBeVisible();
    expect(screen.getByText("Archived skip reason")).toBeVisible();
    expect(screen.getByText("No publication recorded")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy archived Custom audience · Instagram caption" })).toBeVisible();
    expect(archive.querySelector("form")).toBeNull();
    expect(archive.querySelector("input, textarea, select")).toBeNull();
  });
});
