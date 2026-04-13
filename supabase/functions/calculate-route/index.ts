import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Pricing ──
const TAXA_BASE = 5.0;
const PRECO_POR_KM = 2.5;
const VALOR_MINIMO = 10.0;

// ── Known locations database for Cabo de Santo Agostinho and surroundings ──
const LOCATIONS: Record<string, { lat: number; lon: number; aliases: string[] }> = {
  "centro": { lat: -8.2889, lon: -35.0365, aliases: ["centro do cabo", "centro cabo", "cabo centro"] },
  "ponte dos carvalhos": { lat: -8.2369, lon: -34.9987, aliases: ["ponte carvalhos", "pte carvalhos", "pte dos carvalhos"] },
  "shopping costa dourada": { lat: -8.3058, lon: -35.0224, aliases: ["costa dourada", "shopping", "shopping do cabo"] },
  "suape": { lat: -8.3539, lon: -34.9567, aliases: ["porto de suape", "complexo de suape", "distrito suape", "porto suape"] },
  "praia de gaibu": { lat: -8.3300, lon: -34.9525, aliases: ["gaibu", "gaibú", "praia gaibu", "praia de gaibú"] },
  "praia do paiva": { lat: -8.2684, lon: -34.9491, aliases: ["paiva", "reserva do paiva", "praia paiva"] },
  "praia de itapuama": { lat: -8.3451, lon: -34.9507, aliases: ["itapuama", "praia itapuama"] },
  "praia de calhetas": { lat: -8.3358, lon: -34.9466, aliases: ["calhetas", "praia calhetas"] },
  "terminal integrado cabo": { lat: -8.2880, lon: -35.0350, aliases: ["terminal integrado", "terminal do cabo", "terminal", "ti cabo"] },
  "prefeitura do cabo": { lat: -8.2850, lon: -35.0350, aliases: ["prefeitura", "prefeitura municipal", "prefeitura cabo"] },
  "mercado ponte dos carvalhos": { lat: -8.2370, lon: -34.9990, aliases: ["mercado publico", "mercado de ponte dos carvalhos", "mercado ponte", "mercado publico ponte dos carvalhos"] },
  "hospital metropolitano sul": { lat: -8.2785, lon: -35.0100, aliases: ["hospital metropolitano", "hospital dom helder", "hms", "hospital"] },
  "upa cabo": { lat: -8.2870, lon: -35.0300, aliases: ["upa", "upa do cabo"] },
  "charneca": { lat: -8.2700, lon: -35.0200, aliases: ["charnequinha"] },
  "garapu": { lat: -8.3100, lon: -35.0100, aliases: ["engenho garapu"] },
  "santo inacio": { lat: -8.2600, lon: -35.0400, aliases: ["sto inacio", "santo inácio"] },
  "cohab": { lat: -8.2800, lon: -35.0420, aliases: ["cohab cabo"] },
  "jardim santo inacio": { lat: -8.2620, lon: -35.0380, aliases: ["jd santo inacio", "jardim sto inacio"] },
  "vila claudete": { lat: -8.2780, lon: -35.0380, aliases: ["claudete"] },
  "barra de jangada": { lat: -8.2350, lon: -34.9770, aliases: ["barra jangada", "jangada"] },
  "pontezinha": { lat: -8.2496, lon: -35.0186, aliases: ["pte zinha"] },
  "distrito industrial": { lat: -8.3200, lon: -35.0000, aliases: ["distrito", "industrial"] },
  "rodoviaria do cabo": { lat: -8.2885, lon: -35.0345, aliases: ["rodoviaria", "rodoviária", "rodoviária do cabo"] },
  "ipojuca": { lat: -8.3967, lon: -35.0587, aliases: ["centro ipojuca"] },
  "porto de galinhas": { lat: -8.5005, lon: -35.0060, aliases: ["porto galinhas", "porto de galinha"] },
  "recife": { lat: -8.0476, lon: -34.8770, aliases: ["recife centro", "centro do recife", "centro recife"] },
  "boa viagem": { lat: -8.1196, lon: -34.9005, aliases: ["praia de boa viagem", "praia boa viagem"] },
  "jaboatao": { lat: -8.1804, lon: -35.0071, aliases: ["jaboatão", "jaboatao dos guararapes", "jaboatão dos guararapes", "centro jaboatao"] },
  "piedade": { lat: -8.1688, lon: -34.9182, aliases: ["praia de piedade", "praia piedade"] },
  "candeias": { lat: -8.2000, lon: -34.9400, aliases: ["praia de candeias", "praia candeias"] },
  "aeroporto recife": { lat: -8.1264, lon: -34.9236, aliases: ["aeroporto", "aeroporto do recife", "aeroporto guararapes", "guararapes"] },
  "shopping recife": { lat: -8.1185, lon: -34.9054, aliases: ["shopping boa viagem"] },
  "shopping guararapes": { lat: -8.1781, lon: -34.9350, aliases: ["guararapes shopping"] },
  "camela": { lat: -8.3450, lon: -35.0650, aliases: ["camelá"] },
  "escada": { lat: -8.3590, lon: -35.2270, aliases: ["centro escada"] },
  "vila formosa": { lat: -8.2750, lon: -35.0280, aliases: ["formosa"] },
  "massangana": { lat: -8.3400, lon: -35.0300, aliases: ["engenho massangana"] },
  "jucaral": { lat: -8.3050, lon: -35.0350, aliases: ["juçaral"] },
  "nossa senhora do livramento": { lat: -8.2869, lon: -35.0374, aliases: ["livramento", "n s livramento"] },
  "alto da areia": { lat: -8.2830, lon: -35.0310, aliases: ["alto areia"] },
  "sapucaia": { lat: -8.2750, lon: -35.0500, aliases: [] },
  "nova descoberta": { lat: -8.2650, lon: -35.0300, aliases: ["nova descoberta cabo"] },
  "alto do sol nascente": { lat: -8.2800, lon: -35.0250, aliases: ["sol nascente"] },
};

// ── Fuzzy match location ──
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function findLocation(input: string): { lat: number; lon: number; name: string } | null {
  const norm = normalize(input);
  if (!norm) return null;

  // Exact match on key or alias
  for (const [key, loc] of Object.entries(LOCATIONS)) {
    if (norm === normalize(key)) return { lat: loc.lat, lon: loc.lon, name: key };
    for (const alias of loc.aliases) {
      if (norm === normalize(alias)) return { lat: loc.lat, lon: loc.lon, name: key };
    }
  }

  // Partial / contains match with scoring
  let bestMatch: { lat: number; lon: number; name: string } | null = null;
  let bestScore = 0;

  for (const [key, loc] of Object.entries(LOCATIONS)) {
    const candidates = [key, ...loc.aliases].map(normalize);
    for (const c of candidates) {
      if (norm.includes(c) || c.includes(norm)) {
        const score = Math.min(norm.length, c.length) / Math.max(norm.length, c.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { lat: loc.lat, lon: loc.lon, name: key };
        }
      }
      // Word-level overlap
      const inputWords = norm.split(/\s+/);
      const candWords = c.split(/\s+/);
      const overlap = inputWords.filter(w => candWords.some(cw => cw.includes(w) || w.includes(cw))).length;
      const wordScore = overlap / Math.max(inputWords.length, candWords.length);
      if (wordScore > bestScore && wordScore >= 0.5) {
        bestScore = wordScore;
        bestMatch = { lat: loc.lat, lon: loc.lon, name: key };
      }
    }
  }

  if (bestMatch && bestScore >= 0.3) return bestMatch;
  return null;
}

// ── Nominatim geocoding (fallback) ──
async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const queries = [
    `${address}, Cabo de Santo Agostinho, Pernambuco, Brasil`,
    `${address}, Pernambuco, Brasil`,
    `${address}, Brasil`,
  ];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "br" });
      const res = await fetch(url, {
        headers: { "User-Agent": "LocaliZZou/1.0 (ride-app)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    } catch (_e) { /* try next query */ }
  }
  return null;
}

// ── Resolve address: local DB first, then Nominatim ──
async function resolveAddress(input: string): Promise<{ lat: number; lon: number; resolved: string } | null> {
  const local = findLocation(input);
  if (local) return { lat: local.lat, lon: local.lon, resolved: local.name };

  const geo = await geocode(input);
  if (geo) return { lat: geo.lat, lon: geo.lon, resolved: input };

  return null;
}

// ── OSRM routing ──
async function calcRoute(o: { lat: number; lon: number }, d: { lat: number; lon: number }) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.length) {
        return {
          km: Math.round((data.routes[0].distance / 1000) * 100) / 100,
          min: Math.round(data.routes[0].duration / 60),
        };
      }
    }
  } catch (_e) { /* fallback */ }
  return null;
}

// ── Haversine ──
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3 * 100) / 100;
}

function calcPrice(km: number): number {
  return Math.max(VALOR_MINIMO, Math.round((TAXA_BASE + km * PRECO_POR_KM) * 100) / 100);
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origem, destino } = await req.json();

    if (!origem?.trim() || !destino?.trim()) {
      return new Response(
        JSON.stringify({ error: "Informe a origem e o destino." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-route] "${origem}" → "${destino}"`);

    // Resolve both addresses (local DB + Nominatim fallback)
    const [o, d] = await Promise.all([
      resolveAddress(origem.trim()),
      resolveAddress(destino.trim()),
    ]);

    if (!o) {
      return new Response(
        JSON.stringify({ error: `Não encontrei "${origem}". Tente usar um nome mais conhecido (ex: Centro, Shopping Costa Dourada, Ponte dos Carvalhos).` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!d) {
      return new Response(
        JSON.stringify({ error: `Não encontrei "${destino}". Tente usar um nome mais conhecido (ex: Suape, Praia de Gaibu, Recife).` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate route
    const route = await calcRoute(o, d);
    const km = route?.km ?? haversine(o.lat, o.lon, d.lat, d.lon);
    const min = route?.min ?? Math.round(km * 2.5);
    const valor = calcPrice(km);

    const response = {
      origem: { endereco: o.resolved, lat: o.lat, lon: o.lon },
      destino: { endereco: d.resolved, lat: d.lat, lon: d.lon },
      distancia_km: km,
      duracao_min: min,
      valor_estimado: valor,
    };

    console.log(`[calculate-route] OK: ${km}km, ${min}min, R$${valor}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[calculate-route] Error:", e);
    return new Response(
      JSON.stringify({ error: "Erro ao calcular rota. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
