import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Parser NLP próprio para extrair corridas de texto em português ───

/** Normaliza texto removendo acentos e convertendo para minúsculas */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Extrai horário do texto */
function extractTime(text: string): string {
  const n = normalize(text);

  // "às 18h30", "as 14:30", "18h", "14h30min"
  const timePatterns = [
    /(?:as|às|pras?|para as)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?:\s*(?:min|m))?/,
    /(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:min|m|horas?)?/,
    /(\d{1,2})\s*horas?(?:\s*e\s*(\d{1,2})\s*(?:min|minutos?)?)?/,
  ];

  for (const pat of timePatterns) {
    const m = n.match(pat);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
        return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      }
    }
  }

  // "meio-dia", "meia-noite"
  if (/meio[\s-]?dia/.test(n)) return "12:00";
  if (/meia[\s-]?noite/.test(n)) return "00:00";

  // Relative: "daqui a 30 minutos", "em 1 hora"
  const relMin = n.match(/(?:daqui|em)\s*(?:a\s*)?(\d+)\s*min/);
  if (relMin) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + parseInt(relMin[1], 10));
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const relHour = n.match(/(?:daqui|em)\s*(?:a\s*)?(\d+)\s*hora/);
  if (relHour) {
    const d = new Date();
    d.setHours(d.getHours() + parseInt(relHour[1], 10));
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // "agora", "já"
  if (/\b(agora|ja|urgente|rapido|imediato)\b/.test(n)) return "agora";

  return "";
}

/**
 * Remove horário e palavras-chave de controle do texto para facilitar extração de locais
 */
function stripTimeAndNoise(text: string): string {
  let t = text;
  // remove time expressions
  t = t.replace(/(?:às|as|pras?|para as)\s*\d{1,2}\s*(?:h|:)\s*\d{0,2}\s*(?:min|m)?/gi, "");
  t = t.replace(/\d{1,2}\s*(?:h|:)\s*\d{0,2}\s*(?:min|m|horas?)?/gi, "");
  t = t.replace(/\b(?:agora|já|urgente|rápido|imediato|por favor|pfv|pf|obrigado|obg)\b/gi, "");
  t = t.replace(/(?:daqui|em)\s*(?:a\s*)?\d+\s*(?:min|hora)\w*/gi, "");
  t = t.replace(/meio[\s-]?dia|meia[\s-]?noite/gi, "");
  return t.replace(/\s+/g, " ").trim();
}

/** Palavras/frases que indicam ORIGEM */
const ORIGIN_MARKERS = [
  "saindo de", "saindo do", "saindo da",
  "partindo de", "partindo do", "partindo da",
  "de ", "do ", "da ",
  "me pega no", "me pega na", "me pega em",
  "me busca no", "me busca na", "me busca em",
  "pega eu no", "pega eu na", "pega eu em",
  "estou no", "estou na", "estou em",
  "tô no", "tô na", "tô em",
  "to no", "to na", "to em",
  "no ", "na ", "em ",
];

/** Palavras/frases que indicam DESTINO */
const DEST_MARKERS = [
  "leva pro", "leva pra", "leva para o", "leva para a", "leva para",
  "levando pro", "levando pra",
  "indo pro", "indo pra", "indo para o", "indo para a", "indo para",
  "vai pro", "vai pra", "vai para o", "vai para a", "vai para",
  "ir pro", "ir pra", "ir para o", "ir para a", "ir para",
  "até o", "até a", "até ",
  "ate o", "ate a", "ate ",
  "pro ", "pra ",
  "para o", "para a", "para ",
  "destino ", "com destino ao", "com destino a",
  "ao ", "à ",
];

interface RideResult {
  origem: string;
  destino: string;
  horario: string;
}

/** Capitaliza primeira letra de cada palavra significativa */
function capitalize(str: string): string {
  const small = new Set(["de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "ao", "à", "o", "a", "os", "as"]);
  return str
    .split(" ")
    .map((w, i) => {
      if (i === 0 || !small.has(w.toLowerCase())) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return w.toLowerCase();
    })
    .join(" ");
}

/** Limpa texto de local extraído */
function cleanLocation(loc: string): string {
  let l = loc.trim();
  // remove trailing conjunctions/prepositions
  l = l.replace(/\s+(?:e|até|ate|para|pro|pra|leva|vai|ir|,)\s*$/i, "");
  l = l.replace(/^[,.\s]+|[,.\s]+$/g, "");
  return l ? capitalize(l) : "";
}

/** Extrai origem e destino do texto */
function extractLocations(rawText: string): { origem: string; destino: string } {
  const text = stripTimeAndNoise(rawText);
  const lower = normalize(text);

  let origem = "";
  let destino = "";

  // Strategy 1: Find explicit markers
  let bestOriginIdx = Infinity;
  let bestDestIdx = Infinity;

  for (const marker of DEST_MARKERS) {
    const idx = lower.indexOf(normalize(marker));
    if (idx !== -1 && idx < bestDestIdx) {
      bestDestIdx = idx;
      const afterMarker = text.slice(idx + marker.length).trim();
      // Take until end or next clause
      const end = afterMarker.search(/\s+(saindo|partindo|me pega|me busca|estou|tô|to)\s/i);
      destino = end === -1 ? afterMarker : afterMarker.slice(0, end);
    }
  }

  for (const marker of ORIGIN_MARKERS) {
    const idx = lower.indexOf(normalize(marker));
    if (idx !== -1 && idx < bestOriginIdx) {
      // Make sure this origin marker comes before the destination in the text
      if (bestDestIdx !== Infinity && idx >= bestDestIdx) continue;
      bestOriginIdx = idx;
      const afterMarker = text.slice(idx + marker.length).trim();
      // Take until destination marker or end
      let end = -1;
      for (const dm of DEST_MARKERS) {
        const di = normalize(afterMarker).indexOf(normalize(dm));
        if (di !== -1 && (end === -1 || di < end)) end = di;
      }
      origem = end === -1 ? afterMarker : afterMarker.slice(0, end);
    }
  }

  // Strategy 2: Split by "e" or "," if no markers found
  if (!origem && !destino) {
    // "Shopping Iguatemi, Aeroporto"  or  "Shopping Iguatemi e Aeroporto"
    const parts = text.split(/\s*(?:,|→|->|–|-)\s*|\s+(?:e|para|pra|pro)\s+/i).filter(Boolean);
    if (parts.length >= 2) {
      origem = parts[0];
      destino = parts[parts.length - 1];
    } else if (parts.length === 1) {
      destino = parts[0];
    }
  }

  // If only destination found and it contains something like "de X para Y", split it
  if (!origem && destino) {
    const splitMatch = destino.match(/^(.+?)\s+(?:para|pra|pro|até|ate)\s+(.+)$/i);
    if (splitMatch) {
      origem = splitMatch[1];
      destino = splitMatch[2];
    }
  }

  return {
    origem: cleanLocation(origem),
    destino: cleanLocation(destino),
  };
}

/** Main parse function */
function parseRideText(text: string): RideResult {
  const horario = extractTime(text);
  const { origem, destino } = extractLocations(text);
  return { origem, destino, horario };
}

// ─── Server ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let textInput = body.text || "";

    // ── Audio fallback: transcribe via OpenAI Whisper if audio is provided ──
    if (body.audio && !textInput) {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Transcrição de áudio indisponível. Use o Google Chrome ou digite o texto." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let binaryAudio: Uint8Array;
      try {
        const rawBinary = atob(body.audio);
        binaryAudio = new Uint8Array(rawBinary.length);
        for (let i = 0; i < rawBinary.length; i++) {
          binaryAudio[i] = rawBinary.charCodeAt(i);
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Falha ao decodificar o áudio. Tente gravar novamente." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formData = new FormData();
      formData.append("file", new Blob([binaryAudio], { type: "audio/webm" }), "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "pt");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });

      if (!whisperRes.ok) {
        console.error("Whisper error:", whisperRes.status);
        const msg = whisperRes.status === 429
          ? "Muitas requisições de áudio. Aguarde um momento e tente novamente."
          : "Falha na transcrição do áudio. Tente digitar o texto.";
        return new Response(
          JSON.stringify({ error: msg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whisperData = await whisperRes.json();
      textInput = whisperData.text || "";
    }

    if (!textInput) {
      return new Response(
        JSON.stringify({ error: "Nenhum texto fornecido." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("parse-ride input:", textInput);
    const result = parseRideText(textInput);
    console.log("parse-ride result:", JSON.stringify(result));

    // Include transcription if audio was used
    const response: any = { ...result };
    if (body.audio) {
      response.transcription = textInput;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-ride error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido ao processar" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
