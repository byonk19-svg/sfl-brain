// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentCaptureForm } from "@/components/content-capture-form";

describe("ContentCaptureForm", () => {
  it("asks only for the fast editorial capture fields", () => {
    render(<ContentCaptureForm action={() => undefined} />);

    expect(screen.getByLabelText("What are you working on?")).toBeRequired();
    expect(screen.getByLabelText("Where is it at?")).toHaveValue("idea");
    expect(screen.getByLabelText("What kind of content is it?")).toHaveValue(
      "standalone_product",
    );
    expect(screen.getByLabelText("Anything else?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Retailer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to backlog" })).toBeEnabled();
  });
});
