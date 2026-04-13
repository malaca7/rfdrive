// ══════════════════════════════════════════════════════════
// Motor de Precificação - Tabela Oficial RF Driver
// Lookup de preço por origem/destino com fuzzy matching
// ══════════════════════════════════════════════════════════

import tabelaData from '@/data/TabelaRF.json';
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
  match_exato: boolean;
  estimado?: boolean;
}

// ── Persistence: load from localStorage if available, else from static JSON ──
const STORAGE_KEY = 'rf_drive_tabela_precos';

function loadTabela(): TabelaEntry[] {
  let raw: TabelaEntry[] = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) raw = parsed;
    }
  } catch { /* ignore parse errors */ }
  if (raw.length === 0) {
    raw = (tabelaData as unknown[]).filter(
      (e): e is TabelaEntry =>
        !!e && typeof e === 'object' &&
        'origem' in e && 'destino' in e && 'valor' in e &&
        typeof (e as TabelaEntry).origem === 'string' &&
        typeof (e as TabelaEntry).destino === 'string'
    ) as TabelaEntry[];
  }
  // Dedup: keep first occurrence per origem+destino
  const seen = new Set<string>();
  return raw.filter(e => {
    const key = `${e.origem.toLowerCase()}|${e.destino.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function persistTabela() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabela));
  } catch { /* quota exceeded, etc */ }
}

const tabela: TabelaEntry[] = loadTabela();

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

// ── Build lookup maps ──
// Key: "normalizedOrigem|normalizedDestino" → entry
const exactMap = new Map<string, TabelaEntry>();
for (const entry of tabela) {
  const key = `${normalize(entry.origem)}|${normalize(entry.destino)}`;
  exactMap.set(key, entry);
}

// Unique origins and destinations (normalized → original)
const origensMap = new Map<string, string>();
const destinosMap = new Map<string, Set<string>>();
for (const entry of tabela) {
  const on = normalize(entry.origem);
  if (!origensMap.has(on)) origensMap.set(on, entry.origem);
  if (!destinosMap.has(on)) destinosMap.set(on, new Set());
  destinosMap.get(on)!.add(entry.destino);
}

// ── Fuzzy score: how well does `input` match `candidate`? ──
function fuzzyScore(input: string, candidate: string): number {
  const ni = normalize(input);
  const nc = normalize(candidate);

  // Exact
  if (ni === nc) return 1000;

  // One contains the other
  if (nc.includes(ni)) return 800 + (ni.length / nc.length) * 100;
  if (ni.includes(nc)) return 700 + (nc.length / ni.length) * 100;

  // Word overlap
  const iWords = ni.split(' ').filter(w => w.length > 1);
  const cWords = nc.split(' ').filter(w => w.length > 1);
  if (iWords.length === 0 || cWords.length === 0) return 0;

  let matched = 0;
  for (const iw of iWords) {
    for (const cw of cWords) {
      if (cw.includes(iw) || iw.includes(cw)) {
        matched++;
        break;
      }
    }
  }

  const overlap = matched / Math.max(iWords.length, cWords.length);
  return overlap * 500;
}

// ── Find best matching origin from table ──
function findBestOrigin(input: string): { nome: string; normalized: string; score: number } | null {
  const ni = normalize(input);
  let best: { nome: string; normalized: string; score: number } | null = null;

  for (const [normalizedOrigem, originalOrigem] of origensMap) {
    const score = fuzzyScore(ni, normalizedOrigem);
    if (score > (best?.score || 0)) {
      best = { nome: originalOrigem, normalized: normalizedOrigem, score };
    }
  }

  return best && best.score >= 200 ? best : null;
}

// ── Find best matching destination for a given origin ──
function findBestDestino(input: string, origemNorm: string): { nome: string; score: number } | null {
  const destinos = destinosMap.get(origemNorm);
  if (!destinos) return null;

  const ni = normalize(input);
  let best: { nome: string; score: number } | null = null;

  for (const destino of destinos) {
    const score = fuzzyScore(ni, destino);
    if (score > (best?.score || 0)) {
      best = { nome: destino, score };
    }
  }

  return best && best.score >= 200 ? best : null;
}

// ══════════════════════════════════════════════════════════
// MAIN LOOKUP FUNCTION
// ══════════════════════════════════════════════════════════
function lookupDirect(origem: string, destino: string): LookupResult | null {
  // Try exact match first
  const exactKey = `${normalize(origem)}|${normalize(destino)}`;
  const exactEntry = exactMap.get(exactKey);
  if (exactEntry) {
    return {
      valor: exactEntry.valor,
      origem_tabela: exactEntry.origem,
      destino_tabela: exactEntry.destino,
      regiao: exactEntry.regiao,
      match_exato: true,
    };
  }

  // Fuzzy: find best origin
  const bestOrigem = findBestOrigin(origem);
  if (!bestOrigem) return null;

  // Fuzzy: find best destination for that origin
  const bestDestino = findBestDestino(destino, bestOrigem.normalized);
  if (!bestDestino) return null;

  // Lookup the entry
  const key = `${bestOrigem.normalized}|${normalize(bestDestino.nome)}`;
  const entry = exactMap.get(key);
  if (!entry) return null;

  return {
    valor: entry.valor,
    origem_tabela: entry.origem,
    destino_tabela: entry.destino,
    regiao: entry.regiao,
    match_exato: bestOrigem.score >= 1000 && bestDestino.score >= 1000,
  };
}

const HUB_CENTRAL = 'Centro do Cabo';

export function buscarPrecoTabela(origem: string, destino: string): LookupResult | null {
  if (!origem.trim() || !destino.trim()) return null;

  // Try origem → destino
  const direct = lookupDirect(origem, destino);
  if (direct) return direct;

  // Fallback: try destino → origem (bidirectional)
  const reverse = lookupDirect(destino, origem);
  if (reverse) return reverse;

  // Fallback: estimate via hub central (valor mais alto + 1/12 do mais baixo)
  const trecho1 = lookupDirect(origem, HUB_CENTRAL) || lookupDirect(HUB_CENTRAL, origem);
  const trecho2 = lookupDirect(HUB_CENTRAL, destino) || lookupDirect(destino, HUB_CENTRAL);
  if (trecho1 && trecho2) {
    const maior = Math.max(trecho1.valor, trecho2.valor);
    const menor = Math.min(trecho1.valor, trecho2.valor);
    const estimado = Math.round((maior + menor / 12) * 100) / 100;
    return {
      valor: estimado,
      origem_tabela: origem.trim(),
      destino_tabela: destino.trim(),
      regiao: trecho1.regiao || trecho2.regiao,
      match_exato: false,
      estimado: true,
    };
  }

  return null;
}

// ── Get all unique origins (for autocomplete) ──
export function getOrigens(): string[] {
  return Array.from(origensMap.values()).sort();
}

// ── Get ALL unique locations (origins + destinations merged, for bidirectional autocomplete) ──
export function getAllLocations(): string[] {
  const set = new Set<string>();
  for (const entry of tabela) {
    set.add(entry.origem);
    set.add(entry.destino);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Get destinations for a given origin (for autocomplete) ──
export function getDestinosPorOrigem(origem: string): string[] {
  const bestOrigem = findBestOrigin(origem);
  if (!bestOrigem) return [];
  const destinos = destinosMap.get(bestOrigem.normalized);
  if (!destinos) return [];
  return Array.from(destinos).sort();
}

// ── Get total stats ──
export function getTabelaStats() {
  return {
    totalRotas: tabela.length,
    totalOrigens: origensMap.size,
    totalDestinos: new Set(tabela.map(e => e.destino)).size,
    precoMin: Math.min(...tabela.map(e => e.valor)),
    precoMax: Math.max(...tabela.map(e => e.valor)),
  };
}

// ══════════════════════════════════════════════════════════
// MUTATIONS (for admin management)
// ══════════════════════════════════════════════════════════

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
  persistTabela();
}

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
// SUPABASE OPERATIONS (for admin CRUD + cross-user sync)
// ══════════════════════════════════════════════════════════

export { normalize as normalizeText };

export async function fetchTabelaFromSupabase(): Promise<TabelaEntry[]> {
  const { data, error } = await supabase
    .from('tabela_precos')
    .select('*')
    .order('origem')
    .order('destino');
  if (error) {
    console.warn('tabela_precos fetch error, using local cache:', error.message);
    return tabela.map(e => ({ ...e }));
  }
  // Dedup: keep first occurrence per origem+destino (ordered by origem,destino)
  const seen = new Set<string>();
  return (data || []).reduce<TabelaEntry[]>((acc, r) => {
    const key = `${r.origem.toLowerCase()}|${r.destino.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      acc.push({ id: r.id, origem: r.origem, destino: r.destino, valor: Number(r.valor), regiao: r.regiao });
    }
    return acc;
  }, []);
}

export async function syncCacheFromSupabase(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('tabela_precos')
      .select('origem, destino, valor, regiao');
    if (error || !data || data.length === 0) return;
    tabela.length = 0;
    const seen = new Set<string>();
    for (const r of data) {
      const key = `${r.origem.toLowerCase()}|${r.destino.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tabela.push({ origem: r.origem, destino: r.destino, valor: Number(r.valor), regiao: r.regiao });
    }
    rebuildMaps();
  } catch { /* keep local cache */ }
}

export async function seedSupabase(): Promise<{ added: number }> {
  const { count, error: countErr } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;
  if (count && count > 0) return { added: 0 };

  const source = (tabelaData as unknown[]).filter(
    (e): e is TabelaEntry =>
      !!e && typeof e === 'object' && 'origem' in e && 'destino' in e && 'valor' in e &&
      typeof (e as any).origem === 'string' && typeof (e as any).destino === 'string'
  ) as TabelaEntry[];

  // Dedup: keep first occurrence per origem+destino
  const seen = new Set<string>();
  const deduped = source.filter(e => {
    const key = `${e.origem.trim().toLowerCase()}|${e.destino.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const BATCH = 500;
  let added = 0;
  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH).map(e => ({
      origem: e.origem, destino: e.destino, valor: e.valor, regiao: e.regiao || 'Cabo',
    }));
    const { data, error } = await supabase.from('tabela_precos')
      .upsert(batch, { onConflict: 'origem,destino' })
      .select('id');
    if (!error && data) added += data.length;
  }
  return { added };
}

/**
 * Remove entries duplicadas na tabela Supabase (mant\u00e9m o mais recente de cada origem+destino).
 * Chamado automaticamente ao sincronizar.
 */
export async function cleanupDuplicatesSupabase(): Promise<number> {
  const { data, error } = await supabase.rpc('cleanup_tabela_precos_duplicates');
  if (error) {
    // Fallback: do it client-side
    const { data: all } = await supabase.from('tabela_precos').select('id, origem, destino, updated_at').order('updated_at', { ascending: false });
    if (!all || all.length === 0) return 0;
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const row of all) {
      const key = `${row.origem.toLowerCase()}|${row.destino.toLowerCase()}`;
      if (seen.has(key)) {
        toDelete.push(row.id);
      } else {
        seen.set(key, row.id);
      }
    }
    if (toDelete.length > 0) {
      await supabase.from('tabela_precos').delete().in('id', toDelete);
    }
    return toDelete.length;
  }
  return typeof data === 'number' ? data : 0;
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
