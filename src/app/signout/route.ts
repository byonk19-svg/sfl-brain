import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";
export async function POST(request: NextRequest) { const auth = await createAuthServerClient(); await auth.auth.signOut(); return NextResponse.redirect(new URL("/login", request.url)); }
