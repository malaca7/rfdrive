/**
 * Seed: Carrega TabelaRF.json na tabela_precos do Supabase.
 * Execução: node scripts/seed-tabela-precos.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = process.env.VITE_SUPABASE_URL || 'https://kjdfjbwhwbrepakatovz.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGZqYndod2JyZXBha2F0b3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTk2NTMsImV4cCI6MjA5MTU5NTY1M30.Wq_xbbKoGLyKtwHhcXaiQK9LMZYTQnbJ6sj5OrXal2I';

const supabase = createClient(url, key);

async function main() {
  console.log('Carregando TabelaRF.json...');
  const raw = JSON.parse(readFileSync('src/data/TabelaRF.json', 'utf-8'));
  
  // Dedup by normalized key
  const seen = new Set();
  const entries = raw.filter(e => {
    if (!e.origem || !e.destino || e.valor == null) return false;
    const key = `${e.origem.trim().toLowerCase()}|${e.destino.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Total entries (deduplicadas): ${entries.length}`);

  // Check current count
  const { count } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  console.log(`Registros atuais no Supabase: ${count || 0}`);

  // Upsert in batches
  const BATCH = 300;
  let total = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH).map(e => ({
      origem: e.origem.trim(),
      destino: e.destino.trim(),
      valor: e.valor,
      regiao: e.regiao || 'Cabo',
    }));
    const { data, error } = await supabase
      .from('tabela_precos')
      .upsert(batch, { onConflict: 'origem,destino' })
      .select('id');
    if (error) {
      console.error(`Batch ${i}–${i + BATCH} falhou:`, error.message);
    } else {
      total += data.length;
      process.stdout.write(`\r  ${total}/${entries.length} inseridos...`);
    }
  }

  console.log(`\n✅ Seed completo: ${total} registros.`);

  // Verify
  const { count: finalCount } = await supabase
    .from('tabela_precos')
    .select('*', { count: 'exact', head: true });
  console.log(`Total no Supabase agora: ${finalCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });
