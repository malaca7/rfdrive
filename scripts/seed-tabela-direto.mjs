/**
 * Seed Direto: carrega TODOS os JSONs e insere exatamente como estão,
 * sem aplicar regra MAX nem criar entradas reversas.
 *
 * Execução: node scripts/seed-tabela-direto.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const url = 'https://kjdfjbwhwbrepakatovz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGZqYndod2JyZXBha2F0b3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTk2NTMsImV4cCI6MjA5MTU5NTY1M30.Wq_xbbKoGLyKtwHhcXaiQK9LMZYTQnbJ6sj5OrXal2I';

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
  console.log(`📁 ${files.length} arquivos JSON encontrados.\n`);

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
  console.log(`\n  Total: ${allEntries.length} registros para inserir\n`);

  // Upsert em batches de 300
  const BATCH = 300;
  let inserted = 0;
  for (let i = 0; i < allEntries.length; i += BATCH) {
    const batch = allEntries.slice(i, i + BATCH);
    const { error } = await supabase
      .from('tabela_precos')
      .upsert(batch, { onConflict: 'origem,destino' });
    if (error) {
      console.error(`❌ Erro no batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  ✅ Inseridos: ${inserted}/${allEntries.length}`);
    }
  }

  console.log('\n');

  // Confirmar contagem
  const { count } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  console.log(`📊 Total na tabela: ${count} registros`);
  console.log('✅ Seed direto concluído!');
}

main().catch(console.error);
