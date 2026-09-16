// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  localDateTimeAndOffsetToIso,
  PublishedAtInput,
} from "@/components/published-at-input";

afterEach(cleanup);

describe("PublishedAtInput", () => {
  it("normalizes a Chicago wall time to the correct UTC instant", () => {
    expect(localDateTimeAndOffsetToIso("2026-09-15T12:30", 300))
      .toBe("2026-09-15T17:30:00.000Z");
  });

  it("submits a normalized instant separately from the browser-local control", () => {
    const { container } = render(<PublishedAtInput defaultNow={false} />);
    fireEvent.change(screen.getByLabelText("Published at"), {
      target: { value: "2026-09-15T12:30" },
    });

    expect(screen.getByLabelText("Published at")).toHaveAttribute("name", "published_at_local");
    const submitted = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="published_at"]',
    );
    expect(submitted?.value).toMatch(/^2026-09-15T\d{2}:30:00\.000Z$/);
  });

  it("initializes the visible control in the browser and submits an instant", () => {
    const { container } = render(<PublishedAtInput />);
    const local = screen.getByLabelText<HTMLInputElement>("Published at");
    const submitted = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="published_at"]',
    );

    expect(local.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(submitted?.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });
});
