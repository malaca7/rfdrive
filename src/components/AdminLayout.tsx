import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3, Car, Users, DollarSign, Settings, Link2, Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Navigation, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Home', icon: BarChart3, color: 'from-blue-500 to-cyan-400' },
  { path: '/admin/corridas', label: 'Corridas', icon: Car, color: 'from-violet-500 to-purple-400' },
  { path: '/admin/usuarios', label: 'Usuários', icon: Users, color: 'from-emerald-500 to-green-400' },
  { path: '/admin/precos', label: 'Preços', icon: DollarSign, color: 'from-amber-500 to-yellow-400' },
  { path: '/admin/avaliacoes-links', label: 'Avaliações', icon: Link2, color: 'from-pink-500 to-rose-400' },
  { path: '/admin/config', label: 'Config', icon: Settings, color: 'from-slate-400 to-zinc-300' },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, setActiveScreen } = useAuth();
  const { nomePlataforma } = usePlatformConfig();

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden">
      {/* ── Top Bar — original style with motorista switch ── */}
      <header className="shrink-0 z-50 bg-card/95 backdrop-blur-2xl border-b border-white/[0.06] safe-top">
        <div className="w-full px-[4%] h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-accent/30 glow-accent">
              <Navigation className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">{nomePlataforma}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <p className="text-sm font-semibold truncate max-w-[120px] text-white">{(profile?.nome || '').split(' ')[0]}</p>
              <p className="text-[10px] text-accent font-medium">Admin</p>
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-2xl object-cover border border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                {(profile?.nome || '?')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => { signOut(); navigate('/'); }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-[18px] h-[18px]" />
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
      <nav className="shrink-0 z-40 safe-bottom">
        <div className="mx-3 mb-2 bg-card/90 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/30">
          <div className="flex items-stretch justify-around h-14 px-1">
            {ADMIN_NAV.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center justify-center gap-0.5 flex-1 tap-highlight"
                  title={item.label}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.2 : 1, y: isActive ? -2 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive ? `bg-gradient-to-br ${item.color} shadow-lg` : 'text-white/30'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                  </motion.div>
                  <span className={`text-[8px] font-bold tracking-wide ${isActive ? 'text-white' : 'text-white/25'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
            <div className="w-px self-stretch my-2 bg-white/10 mx-0.5" />
            <button
              onClick={() => { setActiveScreen('motorista'); navigate('/motorista/dashboard'); }}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 tap-highlight"
              title="Motorista"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/10 text-white/50 hover:text-white/80 hover:border-accent/30 transition-all">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-[8px] font-bold tracking-wide text-white/40">Motorista</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AdminLayout;
