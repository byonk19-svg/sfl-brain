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

export function POST(request: Request) {
  return handler.fetch(request);
}

export function GET(request: Request) {
  return handler.fetch(request);
}

export function DELETE(request: Request) {
  return handler.fetch(request);
}
