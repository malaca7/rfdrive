// ── LocaliZZou Route AI ──
// Engine local de inteligência para cálculo de rotas na região do Cabo de Santo Agostinho.
// Resolve endereços via fuzzy matching em base própria, calcula distância via OSRM
// com fallback Haversine, e calcula preço estimado.

// ── Pricing ──
const TAXA_BASE = 5.0;
const PRECO_POR_KM = 2.5;
const VALOR_MINIMO = 10.0;

// ── Location Database ──
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
  "mercado ponte dos carvalhos": { lat: -8.2370, lon: -34.9990, aliases: ["mercado publico", "mercado de ponte dos carvalhos", "mercado ponte"] },
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

// ── Normalize text for matching ──
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// ── Fuzzy match location from input text ──
function findLocation(input: string): { lat: number; lon: number; name: string } | null {
  const norm = normalize(input);
  if (!norm) return null;

  // Exact match
  for (const [key, loc] of Object.entries(LOCATIONS)) {
    if (norm === normalize(key)) return { lat: loc.lat, lon: loc.lon, name: key };
    for (const alias of loc.aliases) {
      if (norm === normalize(alias)) return { lat: loc.lat, lon: loc.lon, name: key };
    }
  }

  // Fuzzy / partial match
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
      // Word overlap
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

// ── Haversine distance (km) with 1.3x road factor ──
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3 * 100) / 100;
}

// ── OSRM routing (async, may fail) ──
async function osrmRoute(
  o: { lat: number; lon: number },
  d: { lat: number; lon: number }
): Promise<{ km: number; min: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length) {
      return {
        km: Math.round((data.routes[0].distance / 1000) * 100) / 100,
        min: Math.round(data.routes[0].duration / 60),
      };
    }
  } catch (_e) { /* silent */ }
  return null;
}

// ── Price calculation ──
function calcPrice(km: number): number {
  return Math.max(VALOR_MINIMO, Math.round((TAXA_BASE + km * PRECO_POR_KM) * 100) / 100);
}

// ── Public API ──
export interface RouteResult {
  distancia_km: number;
  duracao_min: number;
  valor_estimado: number;
  origem_resolved: string;
  destino_resolved: string;
}

export async function calculateRoute(origem: string, destino: string): Promise<RouteResult | null> {
  const o = findLocation(origem);
  const d = findLocation(destino);

  if (!o || !d) return null;

  // Try OSRM for accurate road distance
  const route = await osrmRoute(o, d);
  const km = route?.km ?? haversine(o.lat, o.lon, d.lat, d.lon);
  const min = route?.min ?? Math.round(km * 2.5);

  return {
    distancia_km: km,
    duracao_min: min,
    valor_estimado: calcPrice(km),
    origem_resolved: o.name,
    destino_resolved: d.name,
  };
}

export function resolveLocation(input: string): string | null {
  const loc = findLocation(input);
  return loc?.name ?? null;
}
