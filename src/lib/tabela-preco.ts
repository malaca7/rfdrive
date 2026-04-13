// ══════════════════════════════════════════════════════════
// Motor de Precificação - Tabela Oficial RF Driver
// Lookup de preço por origem/destino com fuzzy matching
// ══════════════════════════════════════════════════════════

import tabelaData from '@/data/TabelaRF.json';

export interface TabelaEntry {
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
}

const tabela: TabelaEntry[] = (tabelaData as unknown[]).filter(
  (e): e is TabelaEntry =>
    !!e && typeof e === 'object' &&
    'origem' in e && 'destino' in e && 'valor' in e &&
    typeof (e as TabelaEntry).origem === 'string' &&
    typeof (e as TabelaEntry).destino === 'string'
) as TabelaEntry[];

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
export function buscarPrecoTabela(origem: string, destino: string): LookupResult | null {
  if (!origem.trim() || !destino.trim()) return null;

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

// ── Get all unique origins (for autocomplete) ──
export function getOrigens(): string[] {
  return Array.from(origensMap.values()).sort();
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
