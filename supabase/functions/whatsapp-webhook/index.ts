import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRequestContext, logEvent } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "localizzou_verify_2026";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "";
const PARSE_RIDE_URL = `${SUPABASE_URL}/functions/v1/parse-ride`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Session state (in-memory, stateless per function invocation) ──
// For production, use a DB table. Here we handle within the request.

interface ConversationState {
  step: "idle" | "awaiting_confirmation" | "awaiting_correction";
  parsed?: { origem: string; destino: string; horario: string };
  userId?: string;
}

// ── WhatsApp API helpers ──

async function sendWhatsAppMessage(to: string, text: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log(`[WhatsApp MOCK] Para ${to}: ${text}`);
    return { mock: true, to, text };
  }

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  return res.json();
}

// ── Find or create user by phone ──

async function findOrCreateUser(phone: string) {
  // Normalize phone (remove +, spaces)
  const normalized = phone.replace(/[^0-9]/g, "");

  // Try existing user
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("telefone", normalized)
    .maybeSingle();

  if (existing) return existing;

  // Also try with common formats
  const formats = [normalized, `(${normalized.slice(0,2)}) ${normalized.slice(2,7)}-${normalized.slice(7)}`];

  for (const fmt of formats) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("telefone", fmt)
      .maybeSingle();
    if (data) return data;
  }

  // Auto-create client
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      nome: `WhatsApp ${normalized.slice(-4)}`,
      telefone: normalized,
      senha: Math.random().toString(36).slice(2, 10),
      tipo: "cliente",
      status: "ativo",
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating user:", error);
    return null;
  }

  return newUser;
}

// ── Parse text via parse-ride function ──

async function parseRideText(text: string) {
  try {
    const res = await fetch(PARSE_RIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  } catch (e) {
    console.error("Error calling parse-ride:", e);
    return { error: "Falha ao processar mensagem" };
  }
}

// ── Process conversational state from DB ──

async function getConversationState(phone: string): Promise<ConversationState> {
  const { data } = await supabase
    .from("corridas")
    .select("id, status, origem_texto, destino_texto")
    .eq("whatsapp_message_id", `pending_${phone}`)
    .eq("status", "em_analise")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      step: "awaiting_confirmation",
      parsed: {
        origem: data.origem_texto,
        destino: data.destino_texto,
        horario: "",
      },
      userId: undefined,
    };
  }

  return { step: "idle" };
}

// ── Main message handler ──

async function handleMessage(phone: string, text: string, messageId: string) {
  const user = await findOrCreateUser(phone);
  if (!user) {
    await sendWhatsAppMessage(phone,
      "❌ Desculpe, houve um erro ao identificar sua conta. Tente novamente mais tarde."
    );
    return;
  }

  if (!user.ativo) {
    await sendWhatsAppMessage(phone,
      "⚠️ Sua conta está temporariamente suspensa. Entre em contato com o administrador."
    );
    return;
  }

  const lowerText = text.toLowerCase().trim();

  // Check for pending confirmation
  const { data: pendingRide } = await supabase
    .from("corridas")
    .select("*")
    .eq("cliente_id", user.id)
    .eq("status", "em_analise")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Handle confirmation responses
  if (pendingRide) {
    if (lowerText === "1" || lowerText === "confirmar" || lowerText === "sim" || lowerText === "ok") {
      // Confirm the ride
      await supabase
        .from("corridas")
        .update({ status: "aprovada" })
        .eq("id", pendingRide.id);

      await sendWhatsAppMessage(phone,
        `✅ *Viagem registrada!*\n\n` +
        `📍 De: ${pendingRide.origem_texto}\n` +
        `🏁 Para: ${pendingRide.destino_texto}\n\n` +
        `Sua corrida foi registrada com sucesso! 🚗`
      );
      return;
    }

    if (lowerText === "2" || lowerText === "corrigir" || lowerText === "editar") {
      // Cancel and ask for new input
      await supabase
        .from("corridas")
        .delete()
        .eq("id", pendingRide.id);

      await sendWhatsAppMessage(phone,
        "✏️ Ok! Me diga novamente para onde você quer ir.\n\n" +
        "Exemplo: _Me pega na Praça Barão de Muribeca e me leva pro Shopping Costa Dourada_"
      );
      return;
    }

    if (lowerText === "3" || lowerText === "cancelar") {
      await supabase
        .from("corridas")
        .delete()
        .eq("id", pendingRide.id);

      await sendWhatsAppMessage(phone,
        "❌ Corrida cancelada. Quando precisar, é só mandar uma mensagem! 😊"
      );
      return;
    }
  }

  // No active ride tracking - proceed to new ride request

  // ── New ride request - Parse the message ──
  const parsed = await parseRideText(text);

  if (parsed.error || (!parsed.origem && !parsed.destino)) {
    await sendWhatsAppMessage(phone,
      "🤔 Não consegui entender seu pedido.\n\n" +
      "Me diga de onde você quer sair e para onde quer ir.\n\n" +
      "Exemplos:\n" +
      "• _Me pega na Praça Barão de Muribeca e me leva pro Shopping Costa Dourada_\n" +
      "• _Estou no Hospital, preciso ir para casa na Rua Z_\n" +
      "• _Da Rodoviária do Cabo para a Praia de Suape_"
    );
    return;
  }

  if (!parsed.origem || !parsed.destino) {
    const missing = !parsed.origem ? "local de embarque" : "destino";
    await sendWhatsAppMessage(phone,
      `⚠️ Consegui entender parte do pedido, mas falta o *${missing}*.\n\n` +
      (parsed.origem ? `📍 Embarque: ${parsed.origem}\n` : "") +
      (parsed.destino ? `🏁 Destino: ${parsed.destino}\n` : "") +
      `\nPor favor, informe a mensagem completa com origem e destino.`
    );
    return;
  }

  // Create ride as "em_analise"
  const { data: newRide, error: insertError } = await supabase
    .from("corridas")
    .insert({
      cliente_id: user.id,
      origem_texto: parsed.origem,
      destino_texto: parsed.destino,
      horario_estimado: parsed.horario || null,
      status: "em_analise",
      whatsapp_message_id: messageId,
      confianca_ia: parsed.origem && parsed.destino ? 0.9 : 0.5,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error creating ride:", insertError);
    await sendWhatsAppMessage(phone,
      "❌ Houve um erro ao criar sua solicitação. Tente novamente."
    );
    return;
  }

  // Send confirmation request
  await sendWhatsAppMessage(phone,
    `🚗 *Confirme seu pedido:*\n\n` +
    `📍 Embarque: *${parsed.origem}*\n` +
    `🏁 Destino: *${parsed.destino}*\n` +
    (parsed.horario ? `🕐 Horário: *${parsed.horario}*\n` : "") +
    `\n` +
    `*1* ✅ Confirmar\n` +
    `*2* ✏️ Corrigir\n` +
    `*3* ❌ Cancelar`
  );
}

// ── Server ──

serve(async (req) => {
  const reqCtx = getRequestContext(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── WhatsApp Webhook Verification (GET) ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified!");
      await logEvent({
        type: 'activity',
        action: 'whatsapp_webhook_verified',
        entity: 'whatsapp_webhook',
        details: { mode },
        ip: reqCtx.ip,
        userAgent: reqCtx.userAgent,
      });
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Handle messages ──
  try {
    const body = await req.json();

    // WhatsApp webhook format
    if (body.object === "whatsapp_business_account") {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const messages = change.value?.messages || [];
          for (const msg of messages) {
            const phone = msg.from;
            const messageId = msg.id;

            await logEvent({
              type: 'activity',
              action: 'whatsapp_message_received',
              entity: 'whatsapp_message',
              entityId: messageId,
              details: {
                type: msg.type,
                from: phone,
              },
              ip: reqCtx.ip,
              userAgent: reqCtx.userAgent,
            });

            if (msg.type === "text") {
              await handleMessage(phone, msg.text.body, messageId);
            } else if (msg.type === "audio") {
              // Audio handling - would need to download and transcribe
              await sendWhatsAppMessage(phone,
                "🎤 Recebi seu áudio! No momento, envie uma mensagem de texto com sua solicitação.\n\n" +
                "Exemplo: _Me pega no Shopping Costa Dourada e me leva pro Centro do Cabo_"
              );
            } else {
              await sendWhatsAppMessage(phone,
                "📝 Por favor, envie uma mensagem de *texto* com seu pedido de corrida.\n\n" +
                "Exemplo: _Da Rodoviária do Cabo para a Praia de Suape_"
              );
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Simulator/Internal API format ──
    // { phone: string, text: string, messageId?: string }
    if (body.phone && body.text) {
      const messageId = body.messageId || `sim_${Date.now()}`;
      await handleMessage(body.phone, body.text, messageId);

      // Return the response for the simulator
      const { data: latestRide } = await supabase
        .from("corridas")
        .select("*")
        .not("whatsapp_message_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          status: "ok",
          latestRide,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Webhook error:", e);
    await logEvent({
      type: 'system',
      action: 'whatsapp_webhook_error',
      entity: 'whatsapp_webhook',
      details: {
        url: req.url,
        method: req.method,
      },
      ip: reqCtx.ip,
      userAgent: reqCtx.userAgent,
      level: 'error',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      stackTrace: e instanceof Error ? e.stack || null : null,
    });
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
