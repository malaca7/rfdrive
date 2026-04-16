const { createClient } = require('@supabase/supabase-js');

const url = 'https://kjdfjbwhwbrepakatovz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZGZqYndod2JyZXBha2F0b3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTk2NTMsImV4cCI6MjA5MTU5NTY1M30.Wq_xbbKoGLyKtwHhcXaiQK9LMZYTQnbJ6sj5OrXal2I';

const supabase = createClient(url, key);

async function main() {
  // Test if table exists
  const { error: checkErr } = await supabase.from('evaluation_links').select('id').limit(1);
  
  if (checkErr && checkErr.message.includes('Could not find')) {
    console.log('Tabela evaluation_links NAO existe.');
    console.log('');
    console.log('Execute o SQL abaixo no SQL Editor do Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/kjdfjbwhwbrepakatovz/sql/new');
    console.log('');
    console.log('--- COPIE TODO O SQL DO ARQUIVO: ---');
    console.log('supabase/migrations/20260416300000_evaluation_links.sql');
    console.log('');
    
    // Try via fetch to Supabase SQL endpoint (needs service_role or dashboard)
    const https = require('https');
    const sql = require('fs').readFileSync('supabase/migrations/20260416300000_evaluation_links.sql', 'utf8');
    
    // Try the pg_query RPC approach
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
      console.log('RPC exec_sql nao disponivel (esperado). Use o Dashboard.');
      console.log('Erro:', error.message);
    } else {
      console.log('SQL executado com sucesso!', data);
    }
  } else {
    console.log('Tabela evaluation_links ja existe!');
  }
}

main().catch(console.error);
