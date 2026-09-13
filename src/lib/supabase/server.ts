import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function authEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Website authentication is not configured.");
  return { url, key };
}

export async function createAuthServerClient() {
  const store = await cookies();
  const { url, key } = authEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookies) => {
        try { cookies.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
      },
    },
  });
}
