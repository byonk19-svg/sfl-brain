import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SFL_WORKSPACE_ID: z.uuid(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`SFL Brain is not configured. Check these server-only environment values: ${fields}`);
  }
  return parsed.data;
}

export function isServerConfigured() {
  return serverEnvSchema.safeParse(process.env).success;
}
