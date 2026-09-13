export const connectorScopes = ["openid", "email"] as const;

type ConnectorMetadataOptions = {
  siteUrl: string;
  supabaseUrl: string;
};

function normalizedHttpsUrl(value: string, label: string) {
  const url = new URL(value);
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !isLoopback) {
    throw new Error(`${label} must use HTTPS.`);
  }
  return url.origin;
}

export function buildConnectorResourceMetadata(options: ConnectorMetadataOptions) {
  const siteOrigin = normalizedHttpsUrl(options.siteUrl, "SFL Brain site URL");
  const supabaseOrigin = normalizedHttpsUrl(options.supabaseUrl, "Supabase URL");
  return {
    resource: `${siteOrigin}/mcp`,
    authorization_servers: [`${supabaseOrigin}/auth/v1`],
    scopes_supported: [...connectorScopes],
    resource_name: "SFL Brain",
  };
}

export function connectorMetadataFromEnvironment() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!siteUrl || !supabaseUrl) {
    throw new Error("Hosted connector metadata is not configured.");
  }
  return buildConnectorResourceMetadata({ siteUrl, supabaseUrl });
}
