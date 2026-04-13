import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'cliente' | 'motorista' | 'admin';

interface UserData {
  id: string;
  nome: string;
  telefone: string;
  tipo: AppRole;
  status: string;
}

interface AuthContextType {
  user: UserData | null;
  profile: UserData | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (telefone: string, password: string, nome: string) => Promise<void>;
  signIn: (telefone: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'localizzou_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

function loadCachedUser(): UserData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (_e) {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(loadCachedUser);
  const [role, setRole] = useState<AppRole | null>(() => loadCachedUser()?.tipo ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const signUp = async (telefone: string, password: string, nome: string) => {
    setLoading(true);
    try {
      const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();
      if (exists) throw new Error('Telefone já cadastrado.');

      const { data, error } = await supabase
        .from('users')
        .insert({ telefone, senha: password, nome, tipo: 'cliente' as const, status: 'ativo' as const })
        .select()
        .single();
      if (error) throw new Error(error.message);

      setUser(data as UserData);
      setRole('cliente');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (telefone: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('telefone', telefone)
        .eq('senha', password)
        .maybeSingle();
      if (!data) return false;

      if (data.status === 'banido') return false;

      setUser(data as UserData);
      setRole(data.tipo as AppRole);
      return true;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
