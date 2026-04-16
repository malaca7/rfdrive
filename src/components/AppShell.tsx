import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Navigation, LogOut, User, Shield, Truck, BarChart3, Calculator, IdCard, UserCog, ClipboardList } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { motion, AnimatePresence } from 'framer-motion';

const SCREEN_CONFIG: Record<string, { label: string; icon: React.ReactNode; activeClass: string; dotColor: string }> = {
  motorista: {
    label: 'Motorista',
    icon: <Truck className="w-5 h-5" />,
    activeClass: 'text-accent',
    dotColor: 'bg-accent',
  },
  admin: {
    label: 'Admin',
    icon: <Shield className="w-5 h-5" />,
    activeClass: 'text-accent',
    dotColor: 'bg-accent',
  },
};

const MOTORISTA_NAV = [
  { path: '/motorista/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
  { path: '/motorista/viagens', label: 'Registrar', icon: <Calculator className="w-5 h-5" /> },
  { path: '/motorista/historico', label: 'Viagens', icon: <ClipboardList className="w-5 h-5" /> },
  { path: '/motorista/credencial', label: 'Credencial', icon: <IdCard className="w-5 h-5" /> },
  { path: '/motorista/editperfil', label: 'Perfil', icon: <UserCog className="w-5 h-5" /> },
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut, availableScreens, activeScreen, setActiveScreen, roles, user } = useAuth();
  const { nomePlataforma } = usePlatformConfig();
  const navigate = useNavigate();
  const location = useLocation();

  // Verificar se usuário é admin via tipo ou roles
  const isAdmin = user?.tipo === 'admin' || roles.includes('admin');

  // Check if we're in a motorista route
  const isMotoristaRoute = location.pathname.startsWith('/motorista/');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminScreen = activeScreen === 'admin' && isAdmin;

  // Telas disponíveis para screen switcher (só admin/motorista)
  const effectiveAvailableScreens = (isAdmin && !availableScreens.includes('admin')
    ? [...availableScreens, 'admin']
    : availableScreens
  ).filter(s => s !== 'cliente');

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[hsl(0_0%_4%)] overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="shrink-0 z-50 bg-[hsl(0_0%_6%)]/95 backdrop-blur-2xl border-b border-white/[0.06] safe-top">
        <div className="w-full px-[4%] h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-[hsl(45_100%_50%/0.3)] glow-accent">
              <Navigation className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white">{nomePlataforma}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <p className="text-sm font-semibold truncate max-w-[120px] text-white">{profile?.nome || ''}</p>
              {activeScreen && (
                <p className="text-[10px] text-white/40 capitalize">{activeScreen}</p>
              )}
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-2xl object-cover border border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                {(profile?.nome || '?')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {children}
      </main>

      {/* ── Bottom Navigation ── */}
      <nav className="shrink-0 z-50 bg-[hsl(0_0%_6%)]/95 backdrop-blur-2xl border-t border-white/[0.06] safe-bottom">
        <div className="w-full px-[4%] flex items-stretch justify-around h-16">
          {(isMotoristaRoute || (!isAdminScreen && !isAdminRoute)) ? (
            /* ── Motorista: 5 route-based nav items ── */
            <>
              {MOTORISTA_NAV.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 ${isActive ? 'text-accent' : 'text-white/30'}`}
                    title={item.label}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute top-0 left-[25%] right-[25%] h-[3px] rounded-b-full bg-accent"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                      {item.icon}
                    </span>
                    <span className={`text-[10px] font-semibold ${isActive ? '' : 'opacity-60'}`}>{item.label}</span>
                  </button>
                );
              })}
              {/* If admin, add admin switch button */}
              {isAdmin && (
                <button
                  onClick={() => { setActiveScreen('admin'); navigate('/admin'); }}
                  className="relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 text-white/30"
                  title="Admin"
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-[10px] font-semibold opacity-60">Admin</span>
                </button>
              )}
            </>
          ) : (
            /* ── Admin screen: only show Motorista switch button ── */
            <>
              <button
                onClick={() => { setActiveScreen('motorista'); navigate('/motorista/dashboard'); }}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 text-white/30 hover:text-white/60"
                title="Motorista"
              >
                <Truck className="w-5 h-5" />
                <span className="text-[10px] font-semibold opacity-60">Motorista</span>
              </button>
              <div className="relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 text-accent">
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-[25%] right-[25%] h-[3px] rounded-b-full bg-accent"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
                <Shield className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Admin</span>
              </div>
            </>
          )}
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
