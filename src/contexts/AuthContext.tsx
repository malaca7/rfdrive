import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'cliente' | 'motorista' | 'admin';

type ScreenKey = 'cliente' | 'motorista' | 'admin';

interface UserData {
  id: string;
  nome: string;
  telefone: string;
  tipo: AppRole;
  roles: AppRole[];
  status: string;
  veiculo_placa?: string | null;
}

interface AuthContextType {
  user: UserData | null;
  profile: UserData | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  availableScreens: ScreenKey[];
  activeScreen: ScreenKey;
  setActiveScreen: (s: ScreenKey) => void;
  signUp: (telefone: string, password: string, nome: string) => Promise<void>;
  signIn: (telefone: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'localizzou_user';
const SCREEN_KEY = 'localizzou_screen';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Derive effective roles from DB roles + tipo fallback
function deriveRoles(tipo: string, dbRoles?: string[] | null): AppRole[] {
  const validRoles = new Set<AppRole>();

  // Add roles from DB array
  if (dbRoles && dbRoles.length > 0) {
    for (const r of dbRoles) {
      if (r === 'cliente' || r === 'motorista' || r === 'admin') {
        validRoles.add(r);
      }
    }
  }

  // Fallback: if no DB roles, derive from tipo
  if (!dbRoles || dbRoles.length === 0) {
    if (tipo === 'motorista') {
      validRoles.add('motorista');
    } else if (tipo === 'admin') {
      validRoles.add('admin');
    } else {
      validRoles.add('cliente');
    }
  }

  // Ensure at least one role
  if (validRoles.size === 0) validRoles.add('cliente');

  return Array.from(validRoles);
}

// Determine which screens a user can access
function getAvailableScreens(roles: AppRole[], user?: UserData | null): ScreenKey[] {
  const screens: ScreenKey[] = [];
  const isAdmin = user?.tipo === 'admin' || roles.includes('admin');

  // Todos têm acesso a cliente
  screens.push('cliente');

  // Motorista: basta ter veículo cadastrado (qualquer role/tipo)
  if (user?.veiculo_placa) {
    screens.push('motorista');
  }

  // Admin
  if (isAdmin) {
    screens.push('admin');
  }

  return screens;
}

function loadCachedUser(): UserData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (_e) {
    return null;
  }
}

function loadCachedScreen(): ScreenKey {
  try {
    const saved = localStorage.getItem(SCREEN_KEY);
    if (saved === 'cliente' || saved === 'motorista' || saved === 'admin') return saved;
  } catch (_e) { /* ignore */ }
  return 'cliente';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(loadCachedUser);
  const [role, setRole] = useState<AppRole | null>(() => loadCachedUser()?.tipo ?? null);
  const [activeScreen, setActiveScreenState] = useState<ScreenKey>(loadCachedScreen);
  const [loading, setLoading] = useState(false);

  const roles = user ? deriveRoles(user.tipo, user.roles) : [];
  const availableScreens = getAvailableScreens(roles, user);

  const hasRole = (r: AppRole) => roles.includes(r);

  const setActiveScreen = (s: ScreenKey) => {
    const isAdmin = user?.tipo === 'admin' || roles.includes('admin');
    const canAccess = availableScreens.includes(s) || (s === 'admin' && isAdmin);
    if (canAccess) {
      setActiveScreenState(s);
      localStorage.setItem(SCREEN_KEY, s);
    }
  };

  // Ensure activeScreen is valid for current user
  useEffect(() => {
    if (user) {
      const isAdmin = user.tipo === 'admin' || roles.includes('admin');
      const allScreens = isAdmin ? [...availableScreens, 'admin'] : availableScreens;
      if (!allScreens.includes(activeScreen as ScreenKey)) {
        const defaultScreen = allScreens.includes('admin') ? 'admin' :
          allScreens.includes('motorista') ? 'motorista' :
          allScreens.includes('cliente') ? 'cliente' : 'cliente';
        setActiveScreenState(defaultScreen);
        localStorage.setItem(SCREEN_KEY, defaultScreen);
      }
    }
  }, [user, availableScreens, activeScreen, roles]);

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

      const userData = data as any;
      setUser({
        ...userData,
        roles: deriveRoles(userData.tipo, userData.roles),
        veiculo_placa: userData.veiculo_placa || null,
      } as UserData);
      setRole('cliente');
      setActiveScreen('cliente');
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

      const userData = data as any;
      const derivedRoles = deriveRoles(userData.tipo, userData.roles);
      const userObj: UserData = {
        id: userData.id,
        nome: userData.nome,
        telefone: userData.telefone,
        tipo: userData.tipo,
        roles: derivedRoles,
        status: userData.status,
        veiculo_placa: userData.veiculo_placa || null,
      };
      setUser(userObj);
      setRole(userData.tipo as AppRole);

      // Admin sempre entra direto no painel admin
      const screens = getAvailableScreens(derivedRoles, userObj);
      const defaultScreen = screens.includes('admin') ? 'admin' :
        screens.includes('motorista') ? 'motorista' :
        screens.includes('cliente') ? 'cliente' : 'cliente';
      setActiveScreen(defaultScreen);

      return true;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setRole(null);
    setActiveScreenState('cliente');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCREEN_KEY);
  };

  return (
    <AuthContext.Provider value={{
      user, profile: user, role, roles, loading,
      hasRole, availableScreens, activeScreen, setActiveScreen,
      signUp, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
