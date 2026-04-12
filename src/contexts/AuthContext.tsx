import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'cliente' | 'motorista' | 'admin';

interface AuthContextType {
  user: { id: string; nome: string; telefone: string; tipo: AppRole; status: string } | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (telefone: string, password: string, nome: string) => Promise<void>;
  signIn: (telefone: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; nome: string; telefone: string; tipo: AppRole; status: string } | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(false);

  const signUp = async (telefone: string, password: string, nome: string) => {
    setLoading(true);
    try {
      // Verifica se já existe
      const { data: exists } = await supabase.from('users').select('id').eq('telefone', telefone).single();
      if (exists) throw new Error('Telefone já cadastrado.');
      // Cria usuário
      const { data, error } = await supabase.from('users').insert({ telefone, senha: password, nome, tipo: 'cliente', status: 'ativo' }).select().single();
      if (error) throw new Error(error.message);
      setUser(data);
      setRole('cliente');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (telefone: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data } = await supabase.from('users').select('*').eq('telefone', telefone).eq('senha', password).single();
      if (!data) return false;
      setUser(data);
      setRole(data.tipo);
      return true;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
