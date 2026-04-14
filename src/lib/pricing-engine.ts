// ══════════════════════════════════════════════════════════
// Motor Inteligente de Precificação Dinâmica
// Resolve localidades hierarquicamente, busca preço mais específico,
// aplica regras de horário e garante fallback.
// ══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

// ── Types ──
export interface Localidade {
  id: string;
  nome: string;
  tipo: string;
  parent_id: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
}

export interface PrecoRota {
  id: string;
  origem_id: string;
  destino_id: string;
  preco_fixo: number | null;
  preco_minimo: number | null;
  prioridade: number;
  ativo: boolean;
}

export interface RegraHorario {
  id: string;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_ajuste: 'percentual' | 'fixo';
  valor_ajuste: number;
  ativo: boolean;
}

export interface PricingResult {
  preco_base: number;
  preco_final: number;
  origem_localidade: Localidade | null;
  destino_localidade: Localidade | null;
  rota_encontrada: PrecoRota | null;
  regra_horario: RegraHorario | null;
  origem_regra: string; // ex: "bairro → local"
  ajuste_aplicado: string; // ex: "+20% noturno"
  fallback_usado: boolean;
  detalhes: {
    origem_texto: string;
    destino_texto: string;
    horario: string;
    cadeia_origem: string[];
    cadeia_destino: string[];
  };
}

// ── Priority by type ──
const TIPO_PRIORIDADE: Record<string, number> = {
  'ponto': 5,
  'rua': 4,
  'local': 3,
  'bairro': 2,
  'zona': 1,
  'cidade': 0,
};

// ── Normalize text for fuzzy matching ──
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// ── Cache ──
let localidadesCache: Localidade[] | null = null;
let precosRotasCache: PrecoRota[] | null = null;
let regrasHorarioCache: RegraHorario[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 min

export async function invalidatePricingCache() {
  localidadesCache = null;
  precosRotasCache = null;
  regrasHorarioCache = null;
  cacheTimestamp = 0;
}

async function loadData() {
  if (localidadesCache && precosRotasCache && regrasHorarioCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { localidades: localidadesCache, precos: precosRotasCache, regras: regrasHorarioCache };
  }

  const [locRes, precRes, regRes] = await Promise.allSettled([
    supabase.from('localidades').select('*').eq('ativo', true),
    supabase.from('precos_rotas').select('*').eq('ativo', true),
    supabase.from('regras_horario').select('*').eq('ativo', true),
  ]);

  localidadesCache = (locRes.status === 'fulfilled' && locRes.value.data ? locRes.value.data : []) as Localidade[];
  precosRotasCache = (precRes.status === 'fulfilled' && precRes.value.data ? precRes.value.data : []) as PrecoRota[];
  regrasHorarioCache = (regRes.status === 'fulfilled' && regRes.value.data ? regRes.value.data : []) as RegraHorario[];
  cacheTimestamp = Date.now();

  return { localidades: localidadesCache, precos: precosRotasCache, regras: regrasHorarioCache };
}

// ── Resolve text input to best matching localidade ──
export function resolveLocalidade(texto: string, localidades: Localidade[]): Localidade | null {
  const norm = normalize(texto);
  if (!norm) return null;

  // Exact match
  for (const loc of localidades) {
    if (normalize(loc.nome) === norm) return loc;
  }

  // Contains match - score by specificity
  let best: Localidade | null = null;
  let bestScore = 0;

  for (const loc of localidades) {
    const locNorm = normalize(loc.nome);

    // Check if input contains location name or vice versa
    if (norm.includes(locNorm) || locNorm.includes(norm)) {
      const similarity = Math.min(norm.length, locNorm.length) / Math.max(norm.length, locNorm.length);
      const typePrio = TIPO_PRIORIDADE[loc.tipo] || 0;
      const score = similarity * 10 + typePrio;

      if (score > bestScore) {
        bestScore = score;
        best = loc;
      }
    }

    // Word overlap
    const inputWords = norm.split(/\s+/);
    const locWords = locNorm.split(/\s+/);
    const overlap = inputWords.filter(w => locWords.some(lw => lw.includes(w) || w.includes(lw))).length;
    const wordScore = overlap / Math.max(inputWords.length, locWords.length);
    if (wordScore >= 0.5) {
      const typePrio = TIPO_PRIORIDADE[loc.tipo] || 0;
      const score = wordScore * 10 + typePrio;
      if (score > bestScore) {
        bestScore = score;
        best = loc;
      }
    }
  }

  return bestScore >= 3 ? best : null;
}

// ── Get ancestry chain (child → parent → grandparent...) ──
function getAncestryChain(localidade: Localidade, allLocalidades: Localidade[]): Localidade[] {
  const chain: Localidade[] = [localidade];
  let current = localidade;
  const visited = new Set<string>([current.id]);

  while (current.parent_id) {
    const parent = allLocalidades.find(l => l.id === current.parent_id);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    chain.push(parent);
    current = parent;
  }

  return chain;
}

// ── Find best price route with fallback ──
function findBestRoute(
  origemChain: Localidade[],
  destinoChain: Localidade[],
  precos: PrecoRota[],
): { rota: PrecoRota | null; origemLoc: Localidade; destinoLoc: Localidade; fallback: boolean } {
  let bestRota: PrecoRota | null = null;
  let bestPriority = -1;
  let bestOrigemLoc = origemChain[0];
  let bestDestinoLoc = destinoChain[0];
  let fallback = false;

  // Try all combinations from most specific to least
  for (let oi = 0; oi < origemChain.length; oi++) {
    for (let di = 0; di < destinoChain.length; di++) {
      const o = origemChain[oi];
      const d = destinoChain[di];

      const rota = precos.find(p => p.origem_id === o.id && p.destino_id === d.id);
      if (rota) {
        // Calculate effective priority: explicit priority + type specificity - fallback level
        const typePrio = (TIPO_PRIORIDADE[o.tipo] || 0) + (TIPO_PRIORIDADE[d.tipo] || 0);
        const effectivePriority = rota.prioridade * 100 + typePrio * 10 - (oi + di);

        if (effectivePriority > bestPriority) {
          bestPriority = effectivePriority;
          bestRota = rota;
          bestOrigemLoc = o;
          bestDestinoLoc = d;
          fallback = oi > 0 || di > 0;
        }
      }
    }
  }

  return { rota: bestRota, origemLoc: bestOrigemLoc, destinoLoc: bestDestinoLoc, fallback };
}

// ── Find active time rules ──
export function findActiveTimeRules(regras: RegraHorario[], horario: string): RegraHorario | null {
  // horario format: "HH:MM" or "HH:MM:SS"
  const time = horario.substring(0, 5); // "HH:MM"

  for (const regra of regras) {
    const inicio = regra.hora_inicio.substring(0, 5);
    const fim = regra.hora_fim.substring(0, 5);

    // Handle overnight ranges (e.g., 22:00-06:00)
    if (inicio <= fim) {
      if (time >= inicio && time < fim) return regra;
    } else {
      if (time >= inicio || time < fim) return regra;
    }
  }

  return null;
}

// ── Apply time adjustment ──
export function applyTimeAdjustment(precoBase: number, regra: RegraHorario): number {
  if (regra.tipo_ajuste === 'percentual') {
    return precoBase * (1 + regra.valor_ajuste / 100);
  }
  return precoBase + regra.valor_ajuste;
}

// ── Get current active time rule (loads data from cache/DB) ──
export async function getActiveTimeRule(): Promise<RegraHorario | null> {
  const { regras } = await loadData();
  if (!regras.length) return null;
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return findActiveTimeRules(regras, now);
}

// ══════════════════════════════════════════════════════════
// MAIN PRICING ENGINE
// ══════════════════════════════════════════════════════════
export async function calcularPreco(
  origemTexto: string,
  destinoTexto: string,
  horario?: string, // "HH:MM" or auto-detect
): Promise<PricingResult | null> {
  const { localidades, precos, regras } = await loadData();

  if (localidades.length === 0 || precos.length === 0) {
    return null; // No pricing data configured
  }

  // Resolve localidades
  const origemLoc = resolveLocalidade(origemTexto, localidades);
  const destinoLoc = resolveLocalidade(destinoTexto, localidades);

  if (!origemLoc || !destinoLoc) {
    return null; // Can't resolve locations
  }

  // Build ancestry chains
  const origemChain = getAncestryChain(origemLoc, localidades);
  const destinoChain = getAncestryChain(destinoLoc, localidades);

  // Find best route
  const { rota, origemLoc: matchedOrigem, destinoLoc: matchedDestino, fallback } = findBestRoute(origemChain, destinoChain, precos);

  if (!rota) {
    return null; // No pricing rule found
  }

  // Determine base price
  const precoBase = rota.preco_fixo ?? rota.preco_minimo ?? 0;

  // Determine current time
  const now = horario || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Find active time rule
  const regraHorario = findActiveTimeRules(regras, now);

  // Calculate final price
  let precoFinal = precoBase;
  let ajusteAplicado = 'nenhum';

  if (regraHorario) {
    precoFinal = applyTimeAdjustment(precoBase, regraHorario);
    if (regraHorario.tipo_ajuste === 'percentual') {
      ajusteAplicado = `+${regraHorario.valor_ajuste}% ${regraHorario.nome}`;
    } else {
      ajusteAplicado = `+R$${regraHorario.valor_ajuste.toFixed(2)} ${regraHorario.nome}`;
    }
  }

  // Ensure minimum price
  if (rota.preco_minimo != null && precoFinal < rota.preco_minimo) {
    precoFinal = rota.preco_minimo;
  }

  precoFinal = Math.round(precoFinal * 100) / 100;

  const origemRegra = `${matchedOrigem.tipo} → ${matchedDestino.tipo}`;

  return {
    preco_base: precoBase,
    preco_final: precoFinal,
    origem_localidade: origemLoc,
    destino_localidade: destinoLoc,
    rota_encontrada: rota,
    regra_horario: regraHorario,
    origem_regra: origemRegra,
    ajuste_aplicado: ajusteAplicado,
    fallback_usado: fallback,
    detalhes: {
      origem_texto: origemTexto,
      destino_texto: destinoTexto,
      horario: now,
      cadeia_origem: origemChain.map(l => `${l.nome} (${l.tipo})`),
      cadeia_destino: destinoChain.map(l => `${l.nome} (${l.tipo})`),
    },
  };
}

// ── Save pricing history ──
export async function salvarHistoricoPreco(corridaId: string, result: PricingResult) {
  await supabase.from('historico_precos').insert({
    corrida_id: corridaId,
    origem_localidade_id: result.origem_localidade?.id || null,
    destino_localidade_id: result.destino_localidade?.id || null,
    preco_rota_id: result.rota_encontrada?.id || null,
    regra_horario_id: result.regra_horario?.id || null,
    preco_base: result.preco_base,
    ajuste_aplicado: result.ajuste_aplicado,
    preco_final: result.preco_final,
    origem_regra: result.origem_regra,
    detalhes: result.detalhes as any,
  });
}
