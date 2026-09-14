// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpportunityHoldSummary } from "@/components/opportunity-hold-summary";

describe("OpportunityHoldSummary", () => {
  it("shows the current hold's date and source with its conditions", () => {
    render(
      <OpportunityHoldSummary
        holdReason="Affiliate access unavailable"
        releaseCondition="Affiliate access becomes available"
        reviewOn={null}
        heldAt="2026-09-13T22:15:00.000Z"
        heldSource="chatgpt_connector"
      />,
    );

    expect(screen.getByText("Affiliate access unavailable")).toBeInTheDocument();
    expect(screen.getByText("Affiliate access becomes available")).toBeInTheDocument();
    expect(screen.getByText("No review date")).toBeInTheDocument();
    expect(screen.getByText(/via ChatGPT connector/)).toBeInTheDocument();
  });
});
