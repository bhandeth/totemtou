// Supabase Edge Function: admin-list
//
// Returns every signup row for the Totemtou admin screen (admin.html).
// The admin password is checked HERE, on the server, so customer PII is never
// exposed to the public anon key. The browser only ever sends the password;
// the rows come back over the service-role connection which bypasses RLS.
//
// Deploy:
//   supabase functions deploy admin-list --no-verify-jwt
//
// Secrets (set once):
//   ADMIN_PASSWORD              — the admin passphrase (defaults to "totemtouon"
//                                 if unset, but set it explicitly in production:
//                                 supabase secrets set ADMIN_PASSWORD=…)
//   SUPABASE_URL                — auto-populated
//   SUPABASE_SERVICE_ROLE_KEY   — auto-populated

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { password } = await req.json();
    const expected = Deno.env.get("ADMIN_PASSWORD") ?? "totemtouon";

    // Constant-time-ish comparison to avoid trivial timing leaks.
    if (!password || !timingSafeEqual(String(password), expected)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await admin
      .from("signups")
      .select(
        "id,name,email,phone,journey,journey_code,provider,departure,travellers,status,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return json({ ok: false, error: error.message }, 500);

    return json({ ok: true, count: data?.length ?? 0, rows: data ?? [] });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) {
    // Still run a comparison to keep timing roughly constant.
    let diff = 1;
    for (let i = 0; i < Math.max(ba.length, bb.length); i++) {
      diff |= (ba[i] ?? 0) ^ (bb[i % bb.length] ?? 0);
    }
    return diff === 0 && false;
  }
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
