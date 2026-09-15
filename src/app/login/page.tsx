import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/safe-return-path";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const destination = safeReturnPath((await searchParams).next, "/today");

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const auth = await createAuthServerClient();
    const { error } = await auth.auth.signInWithPassword({ email, password });
    if (error) redirect("/login?error=credentials");
    redirect(safeReturnPath(formData.get("next"), "/today"));
  }
  return <div className="page-shell narrow-shell"><header className="page-header"><div><span className="eyebrow">Private workspace</span><h1>Sign in to SFL Brain</h1><p>Use the account approved for the shared workspace.</p></div></header><form action={signIn} className="compact-form"><input name="next" type="hidden" value={destination} /><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><button className="button" type="submit">Sign in</button></form></div>;
}
