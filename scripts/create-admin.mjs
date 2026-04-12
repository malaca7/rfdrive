import { createClient } from '@supabase/supabase-js';

const url = 'https://gyhtosjmwhznkahtirqs.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aHRvc2ptd2h6bmthaHRpcnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDc1ODksImV4cCI6MjA5MTU4MzU4OX0.RfQrqeDPHbkpNtUkv-6yy80J61M7HVN1HxwlmjMag6s';

const supabase = createClient(url, key);

const telefone = '81996138924';
const email = `55${telefone}@rideai.local`;
const password = 'admin123'; // temporary, change after first login
const nome = 'Admin';

async function main() {
  console.log(`Criando conta: ${telefone} -> ${email}`);

  // 1. Sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome, telefone } },
  });

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      console.log('Conta já existe, fazendo login...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        console.error('Erro no login:', loginError.message);
        console.log('\nSe a senha é diferente, rode este SQL no Supabase Dashboard > SQL Editor:');
        console.log(`INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = '${email}' ON CONFLICT (user_id, role) DO NOTHING;`);
        return;
      }
      console.log('User ID:', loginData.user?.id);
    } else {
      console.error('Erro no signup:', signUpError.message);
      return;
    }
  } else {
    console.log('Conta criada! User ID:', signUpData.user?.id);
  }

  // 2. Get user id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.error('Não conseguiu obter usuário'); return; }

  console.log(`User ID: ${user.id}`);

  // 3. Insert admin role
  const { error: roleError } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' });
  if (roleError) {
    if (roleError.message.includes('duplicate') || roleError.message.includes('unique')) {
      console.log('Role admin já existe para este user.');
    } else {
      console.error('Erro ao inserir role (esperado - precisa de SQL admin):', roleError.message);
      console.log('\nRode este SQL no Supabase Dashboard > SQL Editor:');
      console.log(`INSERT INTO public.user_roles (user_id, role) VALUES ('${user.id}', 'admin') ON CONFLICT (user_id, role) DO NOTHING;`);
    }
  } else {
    console.log('Role admin adicionada com sucesso!');
  }

  console.log('\n--- Resumo ---');
  console.log(`Telefone: ${telefone}`);
  console.log(`Senha: ${password}`);
  console.log('Role: admin');
}

main();
