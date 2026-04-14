import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation, LogOut, User, Shield, Truck, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SCREEN_CONFIG: Record<string, { label: string; icon: React.ReactNode; activeClass: string; dotColor: string }> = {
  cliente: {
    label: 'Cliente',
    icon: <User className="w-5 h-5" />,
    activeClass: 'text-accent',
    dotColor: 'bg-accent',
  },
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

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut, availableScreens, activeScreen, setActiveScreen, roles, user } = useAuth();

  // Só mostra telas disponíveis (motorista só aparece com veículo cadastrado)
  const showNav = true;

  // Verificar se usuário é admin via tipo ou roles
  const isAdmin = user?.tipo === 'admin' || roles.includes('admin');
  // Telas disponíveis considerando também o tipo de usuário
  const effectiveAvailableScreens = isAdmin && !availableScreens.includes('admin')
    ? [...availableScreens, 'admin']
    : availableScreens;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[hsl(0_0%_4%)] overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="shrink-0 z-50 bg-[hsl(0_0%_6%)]/95 backdrop-blur-2xl border-b border-white/[0.06] safe-top">
        <div className="w-full px-[4%] h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-[hsl(22_100%_55%/0.3)] glow-accent">
              <Navigation className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white">RF Drive</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <p className="text-sm font-semibold truncate max-w-[120px] text-white">{profile?.nome || ''}</p>
              {activeScreen && (
                <p className="text-[10px] text-white/40 capitalize">{activeScreen}</p>
              )}
            </div>
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
      {showNav && (
        <nav className="shrink-0 z-50 bg-[hsl(0_0%_6%)]/95 backdrop-blur-2xl border-t border-white/[0.06] safe-bottom">
          <div className="w-full px-[4%] flex items-stretch justify-around h-16">
            {effectiveAvailableScreens.map(screen => {
              const cfg = SCREEN_CONFIG[screen];
              if (!cfg) return null;
              const isActive = screen === activeScreen;
              return (
                <button
                  key={screen}
                  onClick={() => setActiveScreen(screen)}
                  className={`
                    relative flex flex-col items-center justify-center gap-0.5 flex-1
                    transition-all duration-200
                    ${isActive ? cfg.activeClass : 'text-white/30'}
                  `}
                  tabIndex={0}
                  title={cfg.label}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute top-0 left-[25%] right-[25%] h-[3px] rounded-b-full bg-accent"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    {cfg.icon}
                  </span>
                  <span className={`text-[10px] font-semibold ${isActive ? '' : 'opacity-60'}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default AppShell;
