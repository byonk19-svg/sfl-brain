/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  verifyOtp: vi.fn(),
}));
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createAuthBrowserClient: () => ({ auth }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import ConfirmPage from "./page";

describe("invitation callback", () => {
  beforeEach(() => {
    auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    auth.onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    auth.verifyOtp.mockReset();
    replace.mockReset();
  });

  it("waits for Supabase initialization before declaring an invitation invalid", async () => {
    render(<ConfirmPage />);

    await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalledOnce());

    expect(screen.getByText("Finishing your invitation…")).toBeInTheDocument();
    expect(screen.queryByText("Request a new invitation")).not.toBeInTheDocument();
  });
});
