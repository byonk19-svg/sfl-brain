import { describe, expect, it } from "vitest";

import {
  filterOpportunitiesForScope,
  sortOnHoldRows,
} from "@/lib/opportunity-repository";

const active = { opportunityId: "active", currentHold: null };
const held = { opportunityId: "held", currentHold: { id: "hold" } };

describe("opportunity attention scope", () => {
  it("separates active, held, and all opportunities", () => {
    expect(filterOpportunitiesForScope([active, held], "active")).toEqual([active]);
    expect(filterOpportunitiesForScope([active, held], "on_hold")).toEqual([held]);
    expect(filterOpportunitiesForScope([active, held], "all")).toEqual([active, held]);
  });

  it("orders due, upcoming, and undated holds", () => {
    const rows = [
      { id: "undated", review_on: null, held_at: "2026-09-13T12:00:00Z" },
      { id: "future", review_on: "2026-10-01", held_at: "2026-09-12T12:00:00Z" },
      { id: "due-new", review_on: "2026-09-10", held_at: "2026-09-11T12:00:00Z" },
      { id: "due-old", review_on: "2026-09-01", held_at: "2026-09-10T12:00:00Z" },
    ];
    expect(sortOnHoldRows(rows, new Date("2026-09-13T12:00:00Z")).map((row) => row.id)).toEqual([
      "due-old",
      "due-new",
      "future",
      "undated",
    ]);
  });
});
