import { handleMcpRequest } from "@/lib/mcp/request-handler";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleMcpRequest(request);
}

export function POST(request: Request) {
  return handleMcpRequest(request);
}

export function DELETE(request: Request) {
  return handleMcpRequest(request);
}
