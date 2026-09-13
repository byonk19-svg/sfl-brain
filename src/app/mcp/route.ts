import { createMcpHandler } from "@modelcontextprotocol/server";

import { createBrainService } from "@/lib/brain";
import { createSflMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  () =>
    createSflMcpServer(createBrainService(), {
      enablePilotWrites:
        process.env.NODE_ENV === "development" &&
        process.env.SFL_ENABLE_PILOT_WRITES === "1",
    }),
  {
    legacy: "stateless",
  },
);

export function servesMcpHttp(environment?: { VERCEL?: string }) {
  const runtimeEnvironment = process.env as Record<string, string | undefined>;
  return (environment?.VERCEL ?? runtimeEnvironment.VERCEL) !== "1";
}

function fetchMcp(request: Request) {
  if (!servesMcpHttp()) return new Response(null, { status: 404 });
  return handler.fetch(request);
}

export function POST(request: Request) {
  return fetchMcp(request);
}

export function GET(request: Request) {
  return fetchMcp(request);
}

export function DELETE(request: Request) {
  return fetchMcp(request);
}
