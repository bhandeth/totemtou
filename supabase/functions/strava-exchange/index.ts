// Supabase Edge Function: strava-exchange
//
// Handles the Strava OAuth code -> access token exchange (which needs the
// Strava client secret, so cannot happen in the browser), then upserts a
// Supabase user for that Strava athlete and returns a Supabase session
// the front-end can adopt with sb.auth.setSession(...).
//
// Deploy:
//   supabase functions deploy strava-exchange --no-verify-jwt
//
// Required secrets (set once with `supabase secrets set …`):
//   STRAVA_CLIENT_ID
//   STRAVA_CLIENT_SECRET
//   SUPABASE_URL           (project url)
//   SUPABASE_SERVICE_ROLE_KEY   (service role — kept server-side only)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  try {
    const { code } = await req.json();
    if (!code) return json({ error: "missing code" }, 400);

    const stravaResp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("STRAVA_CLIENT_ID"),
        client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
      }),
    });
    if (!stravaResp.ok) return json({ error: "strava token exchange failed", detail: await stravaResp.text() }, 502);
    const tok = await stravaResp.json();
    const athlete = tok.athlete || {};

    // Use a stable synthetic email so the same Strava athlete resolves to
    // the same Supabase user on repeat sign-ins.
    const email = `strava-${athlete.id}@users.totemtou.local`;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Upsert user (create if missing)
    const { data: existing } = await admin.auth.admin.listUsers();
    let user = existing?.users?.find((u) => u.email === email) ?? null;
    if (!user) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          provider: "strava",
          strava_id: athlete.id,
          full_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(" ").trim(),
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          avatar_url: athlete.profile,
        },
        app_metadata: { provider: "strava" },
      });
      if (cErr) return json({ error: "createUser failed", detail: cErr.message }, 500);
      user = created.user;
    }

    // Mint a session for the front-end. generateLink('magiclink') returns
    // action_link tokens we can convert into an access/refresh pair via
    // verifyOtp(token_hash) — but the cleanest path is to sign a short-lived
    // session directly via admin.createSession (available on newer SDKs).
    // Fallback: send back the magic-link's hashed_token so the browser can
    // call sb.auth.verifyOtp({token_hash,type:'magiclink'}).
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr) return json({ error: "generateLink failed", detail: lErr.message }, 500);

    return json({
      user: { id: user!.id, email: user!.email },
      // Front-end should verify this to get a live session.
      // (See journey.html — swap sb.auth.setSession for sb.auth.verifyOtp
      //  once you deploy this function.)
      magiclink: {
        token_hash: link?.properties?.hashed_token,
        type: "magiclink",
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
