import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation, LogOut, User, Shield, Truck, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SCREEN_CONFIG: Record<string, { label: string; icon: React.ReactNode; activeClass: string; dotColor: string }> = {
  cliente: {
    label: 'Cliente',
    icon: <User className="w-5 h-5" />,
    activeClass: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  motorista: {
    label: 'Motorista',
    icon: <Truck className="w-5 h-5" />,
    activeClass: 'text-green-400',
    dotColor: 'bg-green-400',
  },
  admin: {
    label: 'Admin',
    icon: <Shield className="w-5 h-5" />,
    activeClass: 'text-purple-400',
    dotColor: 'bg-purple-400',
  },
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut, availableScreens, activeScreen, setActiveScreen } = useAuth();

  const showNav = availableScreens.length > 1;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="shrink-0 z-50 glass border-b border-border/40 safe-top">
        <div className="w-full px-[4%] h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-lg shadow-accent/20">
              <Navigation className="w-[18px] h-[18px] text-accent-foreground" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">RF Drive</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <p className="text-sm font-semibold truncate max-w-[120px]">{profile?.nome || ''}</p>
              {activeScreen && (
                <p className="text-[10px] text-muted-foreground capitalize">{activeScreen}</p>
              )}
            </div>
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
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

      {/* ── Bottom Navigation (mobile-first, multi-role) ── */}
      {showNav && (
        <nav className="shrink-0 z-50 glass border-t border-border/40 safe-bottom">
          <div className="w-full px-[4%] flex items-stretch justify-around h-16">
            {availableScreens.map(screen => {
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
                    ${isActive ? cfg.activeClass : 'text-muted-foreground'}
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className={`absolute top-0 left-[25%] right-[25%] h-[3px] rounded-b-full ${cfg.dotColor}`}
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
