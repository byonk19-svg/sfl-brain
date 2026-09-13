import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/server";

export default function LoginPage() {
  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const auth = await createAuthServerClient();
    const { error } = await auth.auth.signInWithPassword({ email, password });
    if (error) redirect("/login?error=credentials");
    redirect("/today");
  }
  return <div className="page-shell narrow-shell"><header className="page-header"><div><span className="eyebrow">Private workspace</span><h1>Sign in to SFL Brain</h1><p>Use the account approved for the shared workspace.</p></div></header><form action={signIn} className="compact-form"><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><button className="button" type="submit">Sign in</button></form></div>;
}
