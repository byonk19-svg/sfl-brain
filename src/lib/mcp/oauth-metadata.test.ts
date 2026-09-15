import { describe, expect, it } from "vitest";

import { buildConnectorResourceMetadata } from "@/lib/mcp/oauth-metadata";

describe("hosted MCP OAuth metadata", () => {
  it("advertises the deployed resource and Supabase authorization server", () => {
    expect(buildConnectorResourceMetadata({
      siteUrl: "https://brain.example.com/",
      supabaseUrl: "https://project.supabase.co/",
    })).toEqual({
      resource: "https://brain.example.com/mcp",
      authorization_servers: ["https://project.supabase.co/auth/v1"],
      scopes_supported: ["openid", "email"],
      resource_name: "SFL Brain",
    });
  });

  it("rejects non-HTTPS production URLs", () => {
    expect(() => buildConnectorResourceMetadata({
      siteUrl: "http://brain.example.com",
      supabaseUrl: "https://project.supabase.co",
    })).toThrow("HTTPS");
  });
});
