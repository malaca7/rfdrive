import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVICE_ACCOUNT = Deno.env.get("FCM_SERVICE_ACCOUNT"); // JSON string of Firebase service account
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID"); // Firebase project ID

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── JWT helper for Google OAuth2 ──
async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signInput)
  );

  const jwt = `${signInput}.${base64url(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ── Send FCM v1 push ──
async function sendFCM(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: data || {},
            android: {
              priority: "high",
              notification: {
                channel_id: "ride_notifications",
                sound: "default",
                default_vibrate_timings: true,
                default_light_settings: true,
              },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[FCM] Failed for token ${deviceToken.slice(0, 20)}...: ${err}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[FCM] Send error:", err);
    return false;
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate service account config
    if (!FCM_SERVICE_ACCOUNT || !FCM_PROJECT_ID) {
      console.warn("[send-push] FCM_SERVICE_ACCOUNT or FCM_PROJECT_ID not configured");
      return new Response(
        JSON.stringify({ error: "FCM not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { notification_id, titulo, mensagem, tipo, destinatario, user_id } = body;

    if (!titulo || !mensagem) {
      return new Response(
        JSON.stringify({ error: "Missing titulo/mensagem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Find target push tokens ──
    let tokenQuery = supabase.from("push_tokens").select("token, user_id");

    if (destinatario === "usuario" && user_id) {
      // Individual user
      tokenQuery = tokenQuery.eq("user_id", user_id);
    } else if (destinatario === "motoristas") {
      // All motoristas — join with users table
      const { data: motoristas } = await supabase
        .from("users")
        .select("id")
        .eq("tipo", "motorista")
        .eq("ativo", true);
      const motoristIds = (motoristas || []).map((m: { id: string }) => m.id);
      if (motoristIds.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, message: "No motoristas found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      tokenQuery = tokenQuery.in("user_id", motoristIds);
    } else if (destinatario === "admins") {
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .in("tipo", ["admin", "ceo"]);
      const adminIds = (admins || []).map((a: { id: string }) => a.id);
      if (adminIds.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, message: "No admins found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      tokenQuery = tokenQuery.in("user_id", adminIds);
    }
    // destinatario === 'todos' → send to all tokens (no filter)

    const { data: tokens, error: tokenError } = await tokenQuery;
    if (tokenError) throw tokenError;
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push tokens found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get FCM access token ──
    const serviceAccount = JSON.parse(FCM_SERVICE_ACCOUNT);
    const accessToken = await getAccessToken(serviceAccount);

    // ── Send push to all tokens ──
    const results = await Promise.allSettled(
      tokens.map((t: { token: string }) =>
        sendFCM(accessToken, FCM_PROJECT_ID, t.token, titulo, mensagem, {
          notification_id: notification_id || "",
          tipo: tipo || "info",
        })
      )
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;

    // Clean up invalid tokens (FCM returns 404 for expired tokens)
    const failedTokens = tokens.filter(
      (_: unknown, i: number) =>
        results[i].status === "fulfilled" && (results[i] as PromiseFulfilledResult<boolean>).value === false
    );
    if (failedTokens.length > 0) {
      const failedTokenValues = failedTokens.map((t: { token: string }) => t.token);
      await supabase
        .from("push_tokens")
        .delete()
        .in("token", failedTokenValues);
      console.log(`[send-push] Cleaned ${failedTokenValues.length} invalid tokens`);
    }

    console.log(`[send-push] Sent ${sent}/${tokens.length} pushes for "${titulo}"`);

    return new Response(
      JSON.stringify({ sent, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-push] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
