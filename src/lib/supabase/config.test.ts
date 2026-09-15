import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const config = readFileSync("supabase/config.toml", "utf8");

function section(name: string) {
  const match = new RegExp(`\\[${name.replaceAll(".", "\\.")}\\]([\\s\\S]*?)(?=\\n\\[|$)`).exec(config);
  if (!match) throw new Error(`Missing [${name}] in local Supabase config`);
  return match[1];
}

describe("local Supabase Auth configuration", () => {
  it("keeps public signup disabled while allowing provisioned email users to sign in", () => {
    expect(section("auth")).toMatch(/enable_signup\s*=\s*false/);
    expect(section("auth.email")).toMatch(/enable_signup\s*=\s*true/);
  });
});
