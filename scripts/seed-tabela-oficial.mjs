/**
 * Seed: Carrega TODOS os JSONs da Tabela-oficial-RFDriver na tabela_precos do Supabase.
 * Execução: node scripts/seed-tabela-oficial.mjs
 * 
 * Suporta dois formatos:
 *   - Array: [{ origem, destino, valor, regiao }]
 *   - Object (longas.json): { "destino": { origens: [...], valor } }
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const url = process.env.VITE_SUPABASE_URL || 'https://kjdfjbwhwbrepakatovz.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGZqYndod2JyZXBha2F0b3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTk2NTMsImV4cCI6MjA5MTU5NTY1M30.Wq_xbbKoGLyKtwHhcXaiQK9LMZYTQnbJ6sj5OrXal2I';

const supabase = createClient(url, key);

const DATA_DIR = 'd:/dev/web/Tabela-oficial-RFDriver-main/data';

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

async function main() {
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'TabelaRF.json');
  console.log(`Encontrados ${files.length} arquivos JSON para processar.\n`);

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

  // Dedup by normalized key (last value wins)
  const map = new Map();
  for (const e of allEntries) {
    const key = `${e.origem.toLowerCase()}|${e.destino.toLowerCase()}`;
    map.set(key, e);
  }
  const unique = [...map.values()];

  console.log(`\nTotal bruto: ${allEntries.length}`);
  console.log(`Total deduplicado: ${unique.length}`);

  // Check current count
  const { count } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  console.log(`Registros atuais no Supabase: ${count || 0}\n`);

  // Upsert in batches
  const BATCH = 300;
  let total = 0;
  let errors = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('tabela_precos')
      .upsert(batch, { onConflict: 'origem,destino' })
      .select('id');
    if (error) {
      console.error(`\n❌ Batch ${i}–${i + BATCH} falhou:`, error.message);
      errors++;
    } else {
      total += data.length;
      process.stdout.write(`\r  ✅ ${total}/${unique.length} inseridos/atualizados...`);
    }
  }

  console.log(`\n\n🏁 Seed completo: ${total} registros inseridos/atualizados.`);
  if (errors > 0) console.log(`⚠️  ${errors} batches com erro.`);

  // Verify final count
  const { count: finalCount } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  console.log(`Total no Supabase agora: ${finalCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });
