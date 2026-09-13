/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
}));
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createAuthBrowserClient: () => ({ auth }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import SetPasswordPage from "./page";

describe("password setup", () => {
  beforeEach(() => {
    auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    auth.updateUser.mockReset();
    replace.mockReset();
  });

  it("explains when the recovery session is unavailable after form submission", async () => {
    const user = userEvent.setup();
    render(<SetPasswordPage />);

    await user.type(screen.getByLabelText("Password"), "correct-horse-battery-staple");
    await user.type(screen.getByLabelText("Confirm password"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Open the newest password email in this browser");
    expect(auth.getSession).toHaveBeenCalledOnce();
  });
});
