import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://kjdfjbwhwbrepakatovz.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CAF3wv_GsLSxfFi5b09PIA_hGKP_HVg';

const supabase = createClient(url, key);

const telefone = '(81) 99613-8924';
const senha = 'admin123';
const nome = 'Admin';

async function main() {
  console.log(`Criando admin: ${telefone}`);

  // Check if already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telefone', telefone)
    .maybeSingle();

  if (existing) {
    // Update to admin
    const { error } = await supabase
      .from('users')
      .update({ tipo: 'admin' })
      .eq('id', existing.id);
    if (error) {
      console.error('Erro ao atualizar:', error.message);
      return;
    }
    console.log('Usuário existente promovido a admin!');
  } else {
    // Create new admin
    const { data, error } = await supabase
      .from('users')
      .insert({ telefone, senha, nome, tipo: 'admin', status: 'ativo' })
      .select()
      .single();
    if (error) {
      console.error('Erro ao criar admin:', error.message);
      return;
    }
    console.log('Admin criado! ID:', data.id);
  }

  console.log('\n--- Resumo ---');
  console.log(`Telefone: ${telefone}`);
  console.log(`Senha: ${senha}`);
  console.log('Tipo: admin');
}

main();
