/**
 * Seed Inteligente: carrega TODOS os JSONs e aplica regra MAX(A→B, B→A).
 * Para cada par de locais, o MAIOR valor entre as duas direções prevalece.
 * Ambas direções são inseridas no Supabase com o valor máximo.
 *
 * Execução: node scripts/seed-tabela-max.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const url = process.env.VITE_SUPABASE_URL || 'https://kjdfjbwhwbrepakatovz.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGZqYndod2JyZXBha2F0b3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTk2NTMsImV4cCI6MjA5MTU5NTY1M30.Wq_xbbKoGLyKtwHhcXaiQK9LMZYTQnbJ6sj5OrXal2I';

const supabase = createClient(url, key);
const DATA_DIR = 'd:/dev/web/Tabela-oficial-RFDriver-main/data';

// ── Parse JSON files ──
function parseArrayFile(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  return raw.filter(e => e.origem && e.destino && e.valor != null).map(e => ({
    origem: e.origem.trim(),
    destino: e.destino.trim(),
    valor: e.valor,
    regiao: e.regiao || 'Cabo',
  }));
}

function parseLongasFile(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const entries = [];
  for (const [destino, info] of Object.entries(raw)) {
    if (!info.origens || !info.valor) continue;
    for (const origem of info.origens) {
      entries.push({
        origem: origem.trim(),
        destino: destino.trim(),
        valor: info.valor,
        regiao: 'Cabo',
      });
    }
  }
  return entries;
}

// ── Normalize for matching pairs ──
function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function pairKey(a, b) {
  const na = norm(a);
  const nb = norm(b);
  return na < nb ? `${na}|||${nb}` : `${nb}|||${na}`;
}

async function main() {
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'TabelaRF.json');
  console.log(`📁 ${files.length} arquivos JSON encontrados.\n`);

  // ── 1. Collect all entries from JSONs ──
  const allEntries = [];
  for (const file of files) {
    const filePath = join(DATA_DIR, file);
    let entries;
    if (file === 'longas.json') {
      entries = parseLongasFile(filePath);
    } else {
      entries = parseArrayFile(filePath);
    }
    console.log(`  📄 ${file}: ${entries.length} registros`);
    allEntries.push(...entries);
  }
  console.log(`\n  Total bruto: ${allEntries.length} registros`);

  // ── 2. Dedup: keep last value per direction ──
  const dirMap = new Map(); // "origem|destino" → entry
  for (const e of allEntries) {
    const key = `${norm(e.origem)}|${norm(e.destino)}`;
    dirMap.set(key, e);
  }
  console.log(`  Direções únicas: ${dirMap.size}`);

  // ── 3. Apply MAX rule: for each pair (A,B), find max(A→B, B→A) ──
  // Collect per-pair max values
  const pairMax = new Map(); // pairKey → { max, entries: [{entry, dirKey}] }
  for (const [dirKey, entry] of dirMap) {
    const pk = pairKey(entry.origem, entry.destino);
    if (!pairMax.has(pk)) {
      pairMax.set(pk, { max: entry.valor, entries: [{ entry, dirKey }] });
    } else {
      const p = pairMax.get(pk);
      p.max = Math.max(p.max, entry.valor);
      p.entries.push({ entry, dirKey });
    }
  }

  // Count how many pairs got upgraded
  let upgradedPairs = 0;
  let upgradedDirections = 0;

  // ── 4. Build final entries with MAX applied ──
  const finalEntries = [];
  const seen = new Set();

  for (const [pk, pairData] of pairMax) {
    const maxVal = pairData.max;
    let hadUpgrade = false;

    for (const { entry } of pairData.entries) {
      const key = `${norm(entry.origem)}|${norm(entry.destino)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (entry.valor < maxVal) {
        hadUpgrade = true;
        upgradedDirections++;
      }

      finalEntries.push({
        origem: entry.origem,
        destino: entry.destino,
        valor: maxVal,
        regiao: entry.regiao,
      });
    }

    // If only one direction exists, also create the reverse with same price
    if (pairData.entries.length === 1) {
      const { entry } = pairData.entries[0];
      const reverseKey = `${norm(entry.destino)}|${norm(entry.origem)}`;
      if (!seen.has(reverseKey)) {
        seen.add(reverseKey);
        finalEntries.push({
          origem: entry.destino,
          destino: entry.origem,
          valor: maxVal,
          regiao: entry.regiao,
        });
      }
    }

    if (hadUpgrade) upgradedPairs++;
  }

  console.log(`\n🔄 Regra MAX(A→B, B→A) aplicada:`);
  console.log(`  Pares com upgrade: ${upgradedPairs}`);
  console.log(`  Direções com valor ajustado: ${upgradedDirections}`);
  console.log(`  Total final (com reversos): ${finalEntries.length}\n`);

  // ── Show some examples ──
  let examples = 0;
  for (const [pk, pairData] of pairMax) {
    if (pairData.entries.length === 2 && examples < 5) {
      const vals = pairData.entries.map(e => e.entry.valor);
      if (vals[0] !== vals[1]) {
        const e0 = pairData.entries[0].entry;
        const e1 = pairData.entries[1].entry;
        console.log(`  📊 ${e0.origem} ↔ ${e0.destino}: R$${vals[0]} vs R$${vals[1]} → MAX R$${pairData.max}`);
        examples++;
      }
    }
  }
  if (examples > 0) console.log();

  // ── 5. Clear existing and insert fresh ──
  console.log('🗑️  Limpando tabela_precos existente...');

  // Delete in pages (Supabase limits)
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tabela_precos')
      .select('id')
      .limit(1000);
    if (error) { console.error('Erro ao buscar para deletar:', error.message); break; }
    if (!data || data.length === 0) break;

    const ids = data.map(r => r.id);
    const { error: delErr } = await supabase
      .from('tabela_precos')
      .delete()
      .in('id', ids);
    if (delErr) { console.error('Erro ao deletar:', delErr.message); break; }
    deleted += ids.length;
    process.stdout.write(`\r  Deletados: ${deleted}...`);
  }
  console.log(`\n  ✅ ${deleted} registros antigos removidos.\n`);

  // ── 6. Insert in batches ──
  console.log('📤 Inserindo registros com valores MAX...');
  const BATCH = 300;
  let total = 0;
  let errors = 0;
  for (let i = 0; i < finalEntries.length; i += BATCH) {
    const batch = finalEntries.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('tabela_precos')
      .upsert(batch, { onConflict: 'origem,destino' })
      .select('id');
    if (error) {
      console.error(`\n  ❌ Batch ${i}–${i + BATCH} falhou:`, error.message);
      errors++;
    } else {
      total += data.length;
      process.stdout.write(`\r  ✅ ${total}/${finalEntries.length} inseridos...`);
    }
  }

  console.log(`\n\n🏁 Seed completo!`);
  console.log(`  Total inseridos: ${total}`);
  if (errors > 0) console.log(`  ⚠️  ${errors} batches com erro.`);

  // Verify
  const { count } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  console.log(`  Total no Supabase: ${count}`);
}

main().catch(err => { console.error(err); process.exit(1); });
