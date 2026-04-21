import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hasPermission as rbacHasPermission, hasMinRole as rbacHasMinRole, type Permission, type AppRole as RbacRole } from '@/lib/rbac';
import { logPlatformActivity } from '@/lib/activity-log';

type AppRole = 'cliente' | 'motorista' | 'admin' | 'ceo';

type ScreenKey = 'cliente' | 'motorista' | 'admin' | 'ceo';

interface UserData {
  id: string;
  nome: string;
  telefone: string;
  tipo: AppRole;
  roles: AppRole[];
  status: string;
  veiculo_placa?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: UserData | null;
  profile: UserData | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  hasPermission: (p: Permission) => boolean;
  hasMinRole: (r: RbacRole) => boolean;
  isCEO: boolean;
  availableScreens: ScreenKey[];
  activeScreen: ScreenKey;
  setActiveScreen: (s: ScreenKey) => void;
  signUp: (telefone: string, password: string, nome: string) => Promise<void>;
  signIn: (telefone: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserData>) => void;
}

const STORAGE_KEY = 'localizzou_user';
const SCREEN_KEY = 'localizzou_screen';

/** Strip phone to digits only for consistent DB storage/lookup */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Derive effective roles from DB roles + tipo fallback
function deriveRoles(tipo: string, dbRoles?: string[] | null): AppRole[] {
  const validRoles = new Set<AppRole>();
  const normalizedTipo = String(tipo || '').toLowerCase();

  // Add roles from DB array
  if (dbRoles && dbRoles.length > 0) {
    for (const r of dbRoles) {
      const normalizedRole = String(r || '').toLowerCase();
      if (normalizedRole === 'cliente' || normalizedRole === 'motorista' || normalizedRole === 'admin' || normalizedRole === 'ceo') {
        validRoles.add(normalizedRole as AppRole);
      }
    }
  }

  // Fallback: if no DB roles, derive from tipo
  if (!dbRoles || dbRoles.length === 0) {
    if (normalizedTipo === 'ceo') {
      validRoles.add('ceo');
      validRoles.add('admin');
    } else if (normalizedTipo === 'motorista') {
      validRoles.add('motorista');
    } else if (normalizedTipo === 'admin') {
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
  const isCeo = user?.tipo === 'ceo' || roles.includes('ceo');
  const isAdmin = user?.tipo === 'admin' || roles.includes('admin') || isCeo;
  const isMotorista = user?.tipo === 'motorista' || roles.includes('motorista');

  // Todos têm acesso a cliente
  screens.push('cliente');

  // Motorista: por tipo, role ou veículo cadastrado
  if (isMotorista || user?.veiculo_placa) {
    screens.push('motorista');
  }

  // Admin
  if (isAdmin) {
    screens.push('admin');
  }

  // CEO — painel exclusivo
  if (isCeo) {
    screens.push('ceo');
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
    if (saved === 'cliente' || saved === 'motorista' || saved === 'admin' || saved === 'ceo') return saved;
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
  const isCEO = roles.includes('ceo') || String(user?.tipo || '').toLowerCase() === 'ceo';

  const hasRole = (r: AppRole) => roles.includes(r);
  const hasPermission = (p: Permission) => rbacHasPermission(roles, p);
  const hasMinRole = (r: RbacRole) => rbacHasMinRole(roles, r);

  const setActiveScreen = (s: ScreenKey) => {
    const tipo = String(user?.tipo || '').toLowerCase();
    const isCeo = tipo === 'ceo' || roles.includes('ceo');
    const isAdmin = tipo === 'admin' || roles.includes('admin') || isCeo;
    const canAccess = availableScreens.includes(s)
      || (s === 'admin' && isAdmin)
      || (s === 'ceo' && isCeo);
    if (canAccess) {
      setActiveScreenState(s);
      localStorage.setItem(SCREEN_KEY, s);
    }
  };

  // Ensure activeScreen is valid for current user
  useEffect(() => {
    if (user) {
      const tipo = String(user.tipo || '').toLowerCase();
      const isCeo = tipo === 'ceo' || roles.includes('ceo');
      const isAdmin = tipo === 'admin' || roles.includes('admin') || isCeo;
      const allScreens = [...availableScreens];
      if (isAdmin && !allScreens.includes('admin')) allScreens.push('admin');
      if (isCeo && !allScreens.includes('ceo')) allScreens.push('ceo');
      if (!allScreens.includes(activeScreen as ScreenKey)) {
        const defaultScreen = allScreens.includes('ceo') ? 'ceo' :
          allScreens.includes('admin') ? 'admin' :
          allScreens.includes('motorista') ? 'motorista' : 'cliente';
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

  // Refresh do usuário em cache para evitar role desatualizada (ex.: admin -> ceo)
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    const refreshUser = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data || !mounted) return;

      const dbRoles = deriveRoles(data.tipo, data.roles);
      const mergedUser: UserData = {
        id: data.id,
        nome: data.nome,
        telefone: data.telefone,
        tipo: (String(data.tipo || '').toLowerCase() as AppRole),
        roles: dbRoles,
        status: data.status,
        veiculo_placa: data.veiculo_placa || null,
        avatar_url: data.avatar_url || null,
        created_at: data.created_at || user.created_at,
      };

      const hasRoleChanged =
        String(user.tipo || '').toLowerCase() !== mergedUser.tipo
        || user.roles.join('|') !== mergedUser.roles.join('|');

      if (hasRoleChanged) {
        setUser(mergedUser);
        setRole(mergedUser.tipo);

        const screens = getAvailableScreens(mergedUser.roles, mergedUser);
        if (screens.includes('ceo')) {
          setActiveScreenState('ceo');
          localStorage.setItem(SCREEN_KEY, 'ceo');
        }
      }
    };

    refreshUser();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const signUp = async (telefone: string, password: string, nome: string) => {
    setLoading(true);
    try {
      const phone = normalizePhone(telefone);
      const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('telefone', phone)
        .maybeSingle();
      if (exists) throw new Error('Telefone já cadastrado.');

      const { data, error } = await supabase
        .from('users')
        .insert({ telefone: phone, senha: password, nome, tipo: 'cliente' as const, status: 'ativo' as const })
        .select()
        .single();
      if (error) throw new Error(error.message);

      const userData = data as any;
      setUser({
        ...userData,
        roles: deriveRoles(userData.tipo, userData.roles),
        veiculo_placa: userData.veiculo_placa || null,
        created_at: userData.created_at,
      } as UserData);
      setRole('cliente');
      setActiveScreen('cliente');

      await logPlatformActivity({
        userId: userData.id,
        action: 'signup',
        category: 'auth',
        entity: 'users',
        entityId: userData.id,
        details: { tipo: 'cliente' },
      });
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (telefone: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const phone = normalizePhone(telefone);

      // Try normalized (digits-only) first, then formatted as fallback
      let { data } = await supabase
        .from('users')
        .select('*')
        .eq('telefone', phone)
        .eq('senha', password)
        .maybeSingle();

      // Fallback: try with original formatted phone for legacy entries
      if (!data) {
        const res = await supabase
          .from('users')
          .select('*')
          .eq('telefone', telefone)
          .eq('senha', password)
          .maybeSingle();
        data = res.data;

        // If found with formatted phone, normalize it in DB for future logins
        if (data) {
          await supabase.from('users').update({ telefone: phone }).eq('id', data.id);
          data.telefone = phone;
        }
      }
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
        avatar_url: userData.avatar_url || null,
        created_at: userData.created_at,
      };
      setUser(userObj);
      setRole(userData.tipo as AppRole);

      // Definir tela direto (sem wrapper, que usa closure stale)
      const screens = getAvailableScreens(derivedRoles, userObj);
      const defaultScreen = screens.includes('ceo') ? 'ceo' :
        screens.includes('admin') ? 'admin' :
        screens.includes('motorista') ? 'motorista' :
        screens.includes('cliente') ? 'cliente' : 'cliente';
      setActiveScreenState(defaultScreen);
      localStorage.setItem(SCREEN_KEY, defaultScreen);

      await logPlatformActivity({
        userId: userObj.id,
        action: 'signin',
        category: 'auth',
        entity: 'users',
        entityId: userObj.id,
        details: { tipo: userObj.tipo, screen: defaultScreen },
      });

      return true;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = (updates: Partial<UserData>) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  };

  const signOut = async () => {
    if (user?.id) {
      await logPlatformActivity({
        userId: user.id,
        action: 'signout',
        category: 'auth',
        entity: 'users',
        entityId: user.id,
        details: { tipo: user.tipo },
      });
    }

    setUser(null);
    setRole(null);
    setActiveScreenState('cliente');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCREEN_KEY);
  };

  return (
    <AuthContext.Provider value={{
      user, profile: user, role, roles, loading,
      hasRole, hasPermission, hasMinRole, isCEO,
      availableScreens, activeScreen, setActiveScreen,
      signUp, signIn, signOut, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
