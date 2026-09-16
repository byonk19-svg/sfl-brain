// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PackageAssetEditor } from "@/components/package-asset-editor";
import type { PostPackageAsset } from "@/lib/post-package";

afterEach(cleanup);

const selections: PostPackageAsset[] = [
  {
    asset_id: "70000000-0000-4000-8000-000000000001",
    role: "hero",
    position: 0,
    note: null,
    asset: { id: "70000000-0000-4000-8000-000000000001", title: "Styled room", asset_type: "photo", source: "home", captured_at: null, signed_url: "https://example.test/room.jpg" },
  },
  {
    asset_id: "70000000-0000-4000-8000-000000000002",
    role: "supporting",
    position: 1,
    note: null,
    asset: { id: "70000000-0000-4000-8000-000000000002", title: "Room tour", asset_type: "video", source: "home", captured_at: null, signed_url: "https://example.test/tour.mp4" },
  },
];

describe("PackageAssetEditor", () => {
  it("renders image and video previews and gives new assets unique contiguous order defaults", () => {
    const { container } = render(<PackageAssetEditor
      packageId="40000000-0000-4000-8000-000000000001"
      opportunityId="30000000-0000-4000-8000-000000000001"
      expectedUpdatedAt="2026-09-15T12:00:00Z"
      selections={selections}
      assets={[
        { id: selections[0]!.asset_id, title: "Styled room", asset_type: "photo", signed_url: "https://example.test/room.jpg" },
        { id: selections[1]!.asset_id, title: "Room tour", asset_type: "video", signed_url: "https://example.test/tour.mp4" },
        { id: "70000000-0000-4000-8000-000000000003", title: "Detail one", asset_type: "photo" },
        { id: "70000000-0000-4000-8000-000000000004", title: "Detail two", asset_type: "photo" },
      ]}
    />);

    expect(screen.getByRole("img", { name: "Styled room" })).toHaveAttribute("src", "https://example.test/room.jpg");
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "https://example.test/tour.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(screen.getByLabelText("Order", { selector: `input[name="asset_position_70000000-0000-4000-8000-000000000003"]` })).toHaveValue(2);
    expect(screen.getByLabelText("Order", { selector: `input[name="asset_position_70000000-0000-4000-8000-000000000004"]` })).toHaveValue(3);
  });
});
