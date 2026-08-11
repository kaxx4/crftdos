import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Server client that respects the caller's session cookies (RLS applies, anon-level). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component render — safe to ignore, middleware refreshes session
          }
        },
      },
    }
  );
}

/** Service-role client. Bypasses RLS. NEVER import into client components. Server routes only. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.startsWith("REPLACE_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Set it in .env.local (server-only, never exposed to the client)."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
