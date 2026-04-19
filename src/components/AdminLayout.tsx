import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3, Car, Users, DollarSign, Settings, Star, Truck, Route, FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useTheme } from '@/hooks/useTheme';
import { Navigation, LogOut, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: BarChart3, color: 'from-blue-500 to-cyan-400' },
  { path: '/admin/corridas', label: 'Viagens', icon: Route, color: 'from-violet-500 to-purple-400' },
  { path: '/admin/usuarios', label: 'Motoristas', icon: Users, color: 'from-emerald-500 to-green-400' },
  { path: '/admin/precos', label: 'Preços', icon: DollarSign, color: 'from-amber-500 to-yellow-400' },
  { path: '/admin/avaliacoes-links', label: 'Avaliações', icon: Star, color: 'from-pink-500 to-rose-400' },
  { path: '/admin/recibos', label: 'Recibos', icon: FileText, color: 'from-indigo-500 to-violet-400' },
  { path: '/admin/config', label: 'Config', icon: Settings, color: 'from-slate-400 to-zinc-300' },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, setActiveScreen } = useAuth();
  const { nomePlataforma, logoUrl } = usePlatformConfig();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden">
      {/* ── Top Bar — original style with motorista switch ── */}
      <header className="shrink-0 z-50 bg-bar backdrop-blur-2xl border-b border-border/40 safe-top shadow-lg shadow-black/10 dark:shadow-black/30 bar-glow-bottom">
        <div className="w-full px-[4%] h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-accent/30 glow-accent overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Navigation className="w-5 h-5 text-white" />}
            </div>
            <span className="font-extrabold text-xl tracking-tight text-foreground">{nomePlataforma}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-right mr-1">
              <p className="text-[15px] font-semibold truncate max-w-[140px] text-foreground">{(profile?.nome || '').split(' ')[0]}</p>
              <p className="text-[11px] text-accent font-medium">Admin</p>
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-2xl object-cover border-2 border-border shadow-md" />
            ) : (
              <img src={getAnimalAvatarUrl(profile?.id || profile?.nome || '?')} alt="" className="w-10 h-10 rounded-2xl object-cover border-2 border-border shadow-md" />
            )}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => { signOut(); navigate('/'); }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="w-full px-[3%] py-[3%] max-w-5xl mx-auto page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile floating dock (visible only on mobile, no sidebar) ── */}
      <nav className="shrink-0 z-40 safe-bottom bar-glow-top">
        <div className="mx-3 mb-2 bg-bar backdrop-blur-2xl rounded-2xl border border-border/40 shadow-2xl shadow-black/20 dark:shadow-black/50">
          <div className="flex items-stretch justify-around h-[66px] px-1">
            {ADMIN_NAV.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center justify-center gap-1 flex-1 tap-highlight"
                  title={item.label}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -2 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isActive ? `bg-gradient-to-br ${item.color} shadow-lg shadow-white/15` : 'text-foreground'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                  </motion.div>
                  <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-foreground' : 'text-foreground/70'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
            <div className="w-px self-stretch my-2.5 bg-border mx-0.5" />
            <button
              onClick={() => { setActiveScreen('motorista'); navigate('/motorista/viagens'); }}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 tap-highlight"
              title="Motorista"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-400/40 text-emerald-400 hover:from-emerald-500/30 hover:to-green-500/30 hover:border-emerald-400/60 transition-all">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold tracking-wide text-emerald-400">Motorista</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AdminLayout;
