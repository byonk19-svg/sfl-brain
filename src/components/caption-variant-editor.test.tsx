// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptionVariantEditor } from "@/components/caption-variant-editor";

const destinations = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Styled for Less" },
];

afterEach(cleanup);

describe("CaptionVariantEditor", () => {
  it("copies the current base caption once into a new independent audience variant", () => {
    const saveVariant = vi.fn();
    const { rerender } = render(
      <CaptionVariantEditor
        packageId="40000000-0000-4000-8000-000000000001"
        opportunityId="30000000-0000-4000-8000-000000000001"
        expectedUpdatedAt="2026-09-15T12:00:00Z"
        baseCaption="  First base caption  "
        variants={[]}
        destinations={destinations}
        saveVariant={saveVariant}
      />,
    );

    expect(screen.getByLabelText("Caption copy")).toHaveValue("First base caption");
    fireEvent.change(screen.getByLabelText("Caption copy"), { target: { value: "Independent variant" } });

    rerender(
      <CaptionVariantEditor
        packageId="40000000-0000-4000-8000-000000000001"
        opportunityId="30000000-0000-4000-8000-000000000001"
        expectedUpdatedAt="2026-09-15T12:00:00Z"
        baseCaption="Changed base caption"
        variants={[]}
        destinations={destinations}
        saveVariant={saveVariant}
      />,
    );

    expect(screen.getByLabelText("Caption copy")).toHaveValue("Independent variant");
    fireEvent.submit(screen.getByRole("button", { name: "Save draft variant" }).closest("form")!);
    expect(saveVariant).toHaveBeenCalledOnce();
  });

  it("supports an exact destination override and explicit approval", () => {
    render(
      <CaptionVariantEditor
        packageId="40000000-0000-4000-8000-000000000001"
        opportunityId="30000000-0000-4000-8000-000000000001"
        expectedUpdatedAt="2026-09-15T12:00:00Z"
        baseCaption="Base"
        variants={[]}
        destinations={destinations}
        saveVariant={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Variant kind"), { target: { value: "destination" } });
    expect(screen.getByLabelText("Exact destination")).toBeVisible();
    expect(screen.getByLabelText("Audience")).toHaveValue("custom");
    expect(screen.getByRole("button", { name: "Approve variant" })).toBeVisible();
  });
});
