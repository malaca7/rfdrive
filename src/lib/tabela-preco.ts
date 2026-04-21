// ══════════════════════════════════════════════════════════
// Motor de Precificação - 100% via Supabase
// Sem dependência de JSON. Tudo vem do banco de dados.
// Cache em memória com sync automático.
// ══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface TabelaEntry {
  id?: string;
  origem: string;
  destino: string;
  valor: number;
  regiao: string;
}

export interface LookupResult {
  valor: number;
  origem_tabela: string;
  destino_tabela: string;
  regiao: string;
  origem_regiao?: string | null;
  destino_regiao?: string | null;
  match_exato: boolean;
  estimado?: boolean;
  mesmo_bairro?: boolean;
  estimado_por_ia?: boolean;
  alerta_ia?: string;
  regra_estimativa?: string;
}

// ── Normalize text for matching ──
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export { normalize as normalizeText };

// ══════════════════════════════════════════════════════════
// IN-MEMORY CACHE (populated from Supabase)
// ══════════════════════════════════════════════════════════

let tabela: TabelaEntry[] = [];

// Key: "normalizedOrigem|normalizedDestino" → entry
const exactMap = new Map<string, TabelaEntry>();
const origensMap = new Map<string, string>();
const destinosMap = new Map<string, Set<string>>();

let _version = 0;
export function getTabelaVersion() { return _version; }

function rebuildMaps() {
  exactMap.clear();
  origensMap.clear();
  destinosMap.clear();
  for (const entry of tabela) {
    const key = `${normalize(entry.origem)}|${normalize(entry.destino)}`;
    exactMap.set(key, entry);
    const on = normalize(entry.origem);
    if (!origensMap.has(on)) origensMap.set(on, entry.origem);
    if (!destinosMap.has(on)) destinosMap.set(on, new Set());
    destinosMap.get(on)!.add(entry.destino);
  }
  _version++;
}

// ══════════════════════════════════════════════════════════
// SYNC FROM SUPABASE (the single source of truth)
// ══════════════════════════════════════════════════════════

let _syncPromise: Promise<void> | null = null;

async function fetchAllRows(): Promise<{ id: string; origem: string; destino: string; valor: number; regiao: string }[]> {
  const PAGE = 1000;
  let all: { id: string; origem: string; destino: string; valor: number; regiao: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tabela_precos')
      .select('id, origem, destino, valor, regiao')
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data as any);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function syncCacheFromSupabase(): Promise<void> {
  if (_syncPromise) return _syncPromise;
  _syncPromise = (async () => {
    try {
      const allRows = await fetchAllRows();
      if (allRows.length === 0) return;
      tabela = [];
      const seen = new Set<string>();
      for (const r of allRows) {
        const key = `${r.origem.toLowerCase()}|${r.destino.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tabela.push({ id: r.id, origem: r.origem, destino: r.destino, valor: Number(r.valor), regiao: r.regiao });
      }
      rebuildMaps();
    } catch { /* keep whatever is cached */ }
    _syncPromise = null;
  })();
  return _syncPromise;
}

export async function fetchTabelaFromSupabase(): Promise<TabelaEntry[]> {
  try {
    const allRows = await fetchAllRows();
    if (allRows.length === 0) {
      console.warn('tabela_precos: nenhum dado retornado, usando cache');
      return tabela.map(e => ({ ...e }));
    }
    const seen = new Set<string>();
    const result: TabelaEntry[] = [];
    // Sort client-side since we paginate
    allRows.sort((a, b) => a.origem.localeCompare(b.origem, 'pt-BR') || a.destino.localeCompare(b.destino, 'pt-BR'));
    for (const r of allRows) {
      const key = `${r.origem.toLowerCase()}|${r.destino.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ id: r.id, origem: r.origem, destino: r.destino, valor: Number(r.valor), regiao: r.regiao });
      }
    }
    return result;
  } catch (err) {
    console.warn('tabela_precos fetch error, using cache:', err);
    return tabela.map(e => ({ ...e }));
  }
}

// Initial load on module import
syncCacheFromSupabase();

// ══════════════════════════════════════════════════════════
// FUZZY MATCHING (tolerant search)
// ══════════════════════════════════════════════════════════

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(w => w.length > 1);
}

function fuzzyScore(input: string, candidate: string): number {
  const ni = normalize(input);
  const nc = normalize(candidate);

  if (ni === nc) return 1000;

  // One contains the other
  if (nc.includes(ni)) return 800 + (ni.length / nc.length) * 100;
  if (ni.includes(nc)) return 700 + (nc.length / ni.length) * 100;

  // Token overlap
  const iTokens = tokenize(input);
  const cTokens = tokenize(candidate);
  if (iTokens.length === 0 || cTokens.length === 0) return 0;

  let matched = 0;
  for (const it of iTokens) {
    for (const ct of cTokens) {
      // Exact token match always counts
      if (it === ct) { matched++; break; }
      // Substring match only for tokens with 3+ chars (avoids "pe" matching "suape")
      if (Math.min(it.length, ct.length) >= 3 && (ct.includes(it) || it.includes(ct))) { matched++; break; }
      // Levenshtein-lite: allow 1-char diff for words >3
      if (it.length > 3 && ct.length > 3 && levenshteinLite(it, ct) <= 1) { matched += 0.8; break; }
    }
  }

  return (matched / Math.max(iTokens.length, cTokens.length)) * 600;
}

/** Simple 1-distance check (fast) */
function levenshteinLite(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  if (a === b) return 0;
  let diffs = 0;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0, j = 0; i < maxLen && j < maxLen;) {
    if (a[i] !== b[j]) {
      diffs++;
      if (diffs > 1) return 2;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    } else { i++; j++; }
  }
  return diffs;
}

function findBestOrigin(input: string): { nome: string; normalized: string; score: number } | null {
  let best: { nome: string; normalized: string; score: number } | null = null;
  for (const [normalizedOrigem, originalOrigem] of origensMap) {
    const score = fuzzyScore(input, normalizedOrigem);
    if (score > (best?.score || 0)) {
      best = { nome: originalOrigem, normalized: normalizedOrigem, score };
    }
  }
  return best && best.score >= 400 ? best : null;
}

function findBestDestino(input: string, origemNorm: string): { nome: string; score: number } | null {
  const destinos = destinosMap.get(origemNorm);
  if (!destinos) return null;
  let best: { nome: string; score: number } | null = null;
  for (const destino of destinos) {
    const score = fuzzyScore(input, destino);
    if (score > (best?.score || 0)) {
      best = { nome: destino, score };
    }
  }
  return best && best.score >= 400 ? best : null;
}

// Also search destination across ALL origins (not just the best)
function findBestDestinoGlobal(input: string): { nome: string; origemNorm: string; score: number } | null {
  let best: { nome: string; origemNorm: string; score: number } | null = null;
  for (const [origemNorm, destinos] of destinosMap) {
    for (const destino of destinos) {
      const score = fuzzyScore(input, destino);
      if (score > (best?.score || 0)) {
        best = { nome: destino, origemNorm, score };
      }
    }
  }
  return best && best.score >= 150 ? best : null;
}

function inferRegionForLocation(local: string): string | null {
  const normalizedLocal = normalize(local);
  const regionCount = new Map<string, number>();

  for (const entry of tabela) {
    if (normalize(entry.origem) === normalizedLocal || normalize(entry.destino) === normalizedLocal) {
      const regiao = String(entry.regiao || '').trim();
      if (!regiao) continue;
      regionCount.set(regiao, (regionCount.get(regiao) || 0) + 1);
    }
  }

  if (regionCount.size > 0) {
    return Array.from(regionCount.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  const bestOrigem = findBestOrigin(local);
  if (bestOrigem) {
    for (const entry of tabela) {
      if (normalize(entry.origem) === bestOrigem.normalized && entry.regiao) {
        return entry.regiao;
      }
    }
  }

  const bestDestino = findBestDestinoGlobal(local);
  if (bestDestino) {
    for (const entry of tabela) {
      if (normalize(entry.destino) === normalize(bestDestino.nome) && entry.regiao) {
        return entry.regiao;
      }
    }
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// MAIN LOOKUP
// ══════════════════════════════════════════════════════════

function lookupDirect(origem: string, destino: string): LookupResult | null {
  const exactKey = `${normalize(origem)}|${normalize(destino)}`;
  const exactEntry = exactMap.get(exactKey);
  if (exactEntry) {
    return {
      valor: exactEntry.valor,
      origem_tabela: exactEntry.origem,
      destino_tabela: exactEntry.destino,
      regiao: exactEntry.regiao,
      origem_regiao: inferRegionForLocation(exactEntry.origem),
      destino_regiao: inferRegionForLocation(exactEntry.destino),
      match_exato: true,
    };
  }

  const bestOrigem = findBestOrigin(origem);
  if (!bestOrigem) return null;

  const bestDestino = findBestDestino(destino, bestOrigem.normalized);
  if (!bestDestino) return null;

  const key = `${bestOrigem.normalized}|${normalize(bestDestino.nome)}`;
  const entry = exactMap.get(key);
  if (!entry) return null;

  return {
    valor: entry.valor,
    origem_tabela: entry.origem,
    destino_tabela: entry.destino,
    regiao: entry.regiao,
    origem_regiao: inferRegionForLocation(entry.origem),
    destino_regiao: inferRegionForLocation(entry.destino),
    match_exato: bestOrigem.score >= 1000 && bestDestino.score >= 1000,
  };
}

// ══════════════════════════════════════════════════════════
// HUB CENTRAL — Variantes do Centro do Cabo
// Usado para estimar preço quando rota direta não existe
// ══════════════════════════════════════════════════════════

const HUB_ALIASES = [
  'Centro do Cabo',
  'T.I Centro do Cabo',
  'Praça Theo Silva Centro do Cabo',
];

/** Busca o preço de ORIGIN→Centro (testa múltiplas variantes do centro) */
function lookupOrigemToCentro(origem: string): LookupResult | null {
  for (const hub of HUB_ALIASES) {
    const r = lookupDirect(origem, hub);
    if (r) return r;
  }
  return null;
}

/** Busca o preço de Centro→DESTINO */
function lookupCentroToDestino(destino: string): LookupResult | null {
  // Sempre busca a partir de "Centro do Cabo" (a origem principal)
  const r = lookupDirect('Centro do Cabo', destino);
  if (r) return r;
  // Se o destino é uma variante do centro, preço mínimo
  const nd = normalize(destino);
  for (const hub of HUB_ALIASES) {
    if (normalize(hub) === nd) {
      return {
        valor: 9.99,
        origem_tabela: 'Centro do Cabo',
        destino_tabela: hub,
        regiao: 'Cabo',
        origem_regiao: inferRegionForLocation('Centro do Cabo'),
        destino_regiao: inferRegionForLocation(hub),
        match_exato: true,
      };
    }
  }
  return null;
}

/** Busca o preço base de um local ao Centro (de qualquer direção) */
function getBaseToCentro(local: string): { valor: number; regiao: string } | null {
  const direto = lookupOrigemToCentro(local);
  if (direto) return { valor: direto.valor, regiao: direto.regiao };
  const reverso = lookupCentroToDestino(local);
  if (reverso) return { valor: reverso.valor, regiao: reverso.regiao };
  return null;
}

function isRegiao1Cabo(regiao: string | null | undefined): boolean {
  const norm = normalize(String(regiao || ''));
  return norm === 'cabo' || norm.includes('1 cabo') || norm.includes('1 - cabo') || norm.includes('1- cabo') || norm.includes('1-cabo');
}

export function buscarPrecoTabela(origem: string, destino: string): LookupResult | null {
  if (!origem.trim() || !destino.trim()) return null;

  // ── 0. Mesmo bairro: origem === destino → R$ 10,00 ──
  if (normalize(origem.trim()) === normalize(destino.trim())) {
    return {
      valor: 10,
      origem_tabela: origem.trim(),
      destino_tabela: destino.trim(),
      regiao: 'Cabo',
      origem_regiao: inferRegionForLocation(origem.trim()),
      destino_regiao: inferRegionForLocation(destino.trim()),
      match_exato: true,
      mesmo_bairro: true,
    };
  }

  // ── 1. Busca direta na tabela ──
  const direct = lookupDirect(origem, destino);
  if (direct) return direct;

  // ── 2. Sem correspondência exata: estimar via Centro (IA) ──
  // Regra solicitada:
  // X=origem, Y=destino, considerar X↔Centro e Y↔Centro;
  // valor = maior + percentual(menor), onde:
  // - menor da regiao "1 - CABO" => 18%
  // - menor de qualquer outra regiao => 88%
  const trechoOrigemCentro = getBaseToCentro(origem);
  const trechoDestinoCentro = getBaseToCentro(destino);

  if (trechoOrigemCentro != null && trechoDestinoCentro != null) {
    const origemMenor = trechoOrigemCentro.valor <= trechoDestinoCentro.valor;
    const menorTrecho = origemMenor ? trechoOrigemCentro : trechoDestinoCentro;
    const maiorTrecho = origemMenor ? trechoDestinoCentro : trechoOrigemCentro;
    const menorEhCabo = isRegiao1Cabo(menorTrecho.regiao);
    const maiorEhCabo = isRegiao1Cabo(maiorTrecho.regiao);

    let estimado = 0;
    let regraEstimativa = '';

    if (!menorEhCabo && !maiorEhCabo) {
      estimado = maiorTrecho.valor + menorTrecho.valor;
      regraEstimativa = 'maior + 100% do menor (ambos fora de 1 - CABO)';
    } else {
      const percentual = menorEhCabo ? 0.18 : 0.88;
      estimado = maiorTrecho.valor + (menorTrecho.valor * percentual);
      regraEstimativa = `maior + ${(percentual * 100).toFixed(0)}% do menor (${menorEhCabo ? '1 - CABO' : 'outra regiao'})`;
    }

    const valorFinal = Math.round(estimado * 100) / 100;
    const alertaIa = 'Valor calculado pela IA do sistema; se nao condizer com a realidade, verifique com um administrador.';

    return {
      valor: valorFinal,
      origem_tabela: origem.trim(),
      destino_tabela: destino.trim(),
      regiao: 'Cabo',
      origem_regiao: inferRegionForLocation(origem.trim()),
      destino_regiao: inferRegionForLocation(destino.trim()),
      match_exato: false,
      estimado: true,
      estimado_por_ia: true,
      alerta_ia: alertaIa,
      regra_estimativa: regraEstimativa,
    };
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// AUTOCOMPLETE HELPERS
// ══════════════════════════════════════════════════════════

export function getOrigens(): string[] {
  return Array.from(origensMap.values()).sort();
}

export function getAllLocations(): string[] {
  const set = new Set<string>();
  for (const entry of tabela) {
    set.add(entry.origem);
    set.add(entry.destino);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function getDestinosPorOrigem(origem: string): string[] {
  const bestOrigem = findBestOrigin(origem);
  if (!bestOrigem) return [];
  const destinos = destinosMap.get(bestOrigem.normalized);
  if (!destinos) return [];
  return Array.from(destinos).sort();
}

export function getTabelaStats() {
  return {
    totalRotas: tabela.length,
    totalOrigens: origensMap.size,
    totalDestinos: new Set(tabela.map(e => e.destino)).size,
    precoMin: tabela.length ? Math.min(...tabela.map(e => e.valor)) : 0,
    precoMax: tabela.length ? Math.max(...tabela.map(e => e.valor)) : 0,
  };
}

// ══════════════════════════════════════════════════════════
// IN-MEMORY MUTATIONS (for local reactivity)
// ══════════════════════════════════════════════════════════

export function getTabela(): TabelaEntry[] {
  return tabela;
}

export function addEntry(entry: TabelaEntry): boolean {
  const key = `${normalize(entry.origem)}|${normalize(entry.destino)}`;
  if (exactMap.has(key)) return false;
  tabela.push(entry);
  rebuildMaps();
  return true;
}

export function updateEntry(origOrigem: string, origDestino: string, updated: Partial<TabelaEntry>): boolean {
  const key = `${normalize(origOrigem)}|${normalize(origDestino)}`;
  const existing = exactMap.get(key);
  if (!existing) return false;
  if (updated.origem !== undefined) existing.origem = updated.origem;
  if (updated.destino !== undefined) existing.destino = updated.destino;
  if (updated.valor !== undefined) existing.valor = updated.valor;
  if (updated.regiao !== undefined) existing.regiao = updated.regiao;
  rebuildMaps();
  return true;
}

export function deleteEntry(origem: string, destino: string): boolean {
  const key = `${normalize(origem)}|${normalize(destino)}`;
  if (!exactMap.has(key)) return false;
  const idx = tabela.findIndex(e => `${normalize(e.origem)}|${normalize(e.destino)}` === key);
  if (idx === -1) return false;
  tabela.splice(idx, 1);
  rebuildMaps();
  return true;
}

export function deleteBulk(entries: { origem: string; destino: string }[]): number {
  let removed = 0;
  for (const { origem, destino } of entries) {
    const key = `${normalize(origem)}|${normalize(destino)}`;
    const idx = tabela.findIndex(e => `${normalize(e.origem)}|${normalize(e.destino)}` === key);
    if (idx !== -1) { tabela.splice(idx, 1); removed++; }
  }
  if (removed > 0) rebuildMaps();
  return removed;
}

export function importTabela(entries: TabelaEntry[], replace = false): { added: number; skipped: number } {
  let added = 0, skipped = 0;
  if (replace) {
    tabela.length = 0;
    for (const e of entries) {
      if (e.origem && e.destino && e.valor != null) { tabela.push(e); added++; }
      else skipped++;
    }
  } else {
    for (const e of entries) {
      if (!e.origem || !e.destino || e.valor == null) { skipped++; continue; }
      const key = `${normalize(e.origem)}|${normalize(e.destino)}`;
      if (exactMap.has(key)) { skipped++; continue; }
      tabela.push(e); added++;
    }
  }
  rebuildMaps();
  return { added, skipped };
}

export function exportTabela(): string {
  return JSON.stringify(tabela, null, 2);
}

// ══════════════════════════════════════════════════════════
// SUPABASE CRUD OPERATIONS
// ══════════════════════════════════════════════════════════

export async function cleanupDuplicatesSupabase(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_tabela_precos_duplicates');
    if (!error && typeof data === 'number') return data;
  } catch { /* fallback below */ }
  const { data: all } = await supabase.from('tabela_precos').select('id, origem, destino, updated_at').order('updated_at', { ascending: false });
  if (!all || all.length === 0) return 0;
  const seen = new Map<string, string>();
  const toDelete: string[] = [];
  for (const row of all) {
    const key = `${row.origem.toLowerCase()}|${row.destino.toLowerCase()}`;
    if (seen.has(key)) toDelete.push(row.id);
    else seen.set(key, row.id);
  }
  if (toDelete.length > 0) {
    await supabase.from('tabela_precos').delete().in('id', toDelete);
  }
  return toDelete.length;
}

export async function addEntrySupabase(entry: { origem: string; destino: string; valor: number; regiao: string }): Promise<void> {
  const { error } = await supabase.from('tabela_precos').insert(entry);
  if (error) throw error;
}

export async function updateEntrySupabase(id: string, updates: Partial<TabelaEntry>): Promise<void> {
  const { origem, destino, valor, regiao } = updates;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (origem !== undefined) payload.origem = origem;
  if (destino !== undefined) payload.destino = destino;
  if (valor !== undefined) payload.valor = valor;
  if (regiao !== undefined) payload.regiao = regiao;
  const { error } = await supabase.from('tabela_precos').update(payload).eq('id', id);
  if (error) throw error;
}

export async function findEntryId(origem: string, destino: string): Promise<string | null> {
  const { data } = await supabase
    .from('tabela_precos')
    .select('id')
    .ilike('origem', origem)
    .ilike('destino', destino)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function deleteEntrySupabase(id: string): Promise<void> {
  const { error } = await supabase.from('tabela_precos').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteBulkSupabase(ids: string[]): Promise<number> {
  const { error } = await supabase.from('tabela_precos').delete().in('id', ids);
  if (error) throw error;
  return ids.length;
}

export async function importTabelaSupabase(entries: TabelaEntry[], replace: boolean): Promise<{ added: number; skipped: number }> {
  if (replace) {
    await supabase.from('tabela_precos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
  const valid = entries.filter(e => e.origem && e.destino && e.valor != null);
  const BATCH = 500;
  let added = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH).map(e => ({
      origem: e.origem, destino: e.destino, valor: e.valor, regiao: e.regiao || 'Cabo',
    }));
    const { data, error } = await supabase
      .from('tabela_precos')
      .upsert(batch, { onConflict: 'origem,destino' })
      .select('id');
    if (!error && data) added += data.length;
  }
  return { added, skipped: entries.length - added };
}
