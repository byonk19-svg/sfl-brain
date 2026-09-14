// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpportunityHoldReview } from "@/components/opportunity-hold-review";

describe("OpportunityHoldReview", () => {
  it("gives due reviews a visible status treatment", () => {
    render(<OpportunityHoldReview reviewDue reviewOn="2026-09-13" />);

    expect(screen.getByText("Due for review")).toHaveClass("review-due");
  });

  it("keeps undated holds neutral", () => {
    render(<OpportunityHoldReview reviewDue={false} reviewOn={null} />);

    expect(screen.getByText("No review date")).not.toHaveClass("review-due");
  });

  it("shows a future review on its recorded calendar date", () => {
    render(<OpportunityHoldReview reviewDue={false} reviewOn="2026-09-13" />);

    expect(screen.getByText("Sep 13, 2026")).toBeInTheDocument();
  });
});
