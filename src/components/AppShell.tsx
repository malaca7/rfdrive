import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Navigation, LogOut, User, Shield, Truck, BarChart3, Calculator, IdCard, UserCog, ClipboardList, Trophy } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { motion } from 'framer-motion';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';

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
  { path: '/motorista/viagens', label: 'Registrar', icon: Calculator, color: 'from-emerald-500 to-green-400' },
  { path: '/motorista/dashboard', label: 'Dashboard', icon: BarChart3, color: 'from-blue-500 to-cyan-400' },
  { path: '/motorista/dashboardall', label: 'Geral', icon: Trophy, color: 'from-amber-500 to-yellow-400' },
  { path: '/motorista/historico', label: 'Viagens', icon: ClipboardList, color: 'from-violet-500 to-purple-400' },
  { path: '/motorista/credencial', label: 'Credencial', icon: IdCard, color: 'from-pink-500 to-rose-400' },
  { path: '/motorista/editperfil', label: 'Perfil', icon: UserCog, color: 'from-slate-400 to-zinc-300' },
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut, availableScreens, activeScreen, setActiveScreen, roles, user } = useAuth();
  const { nomePlataforma, logoUrl } = usePlatformConfig();
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
    <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="shrink-0 z-50 bg-card/98 backdrop-blur-2xl border-b border-white/[0.08] safe-top shadow-lg shadow-black/20">
        <div className="w-full px-[4%] h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-accent/30 glow-accent overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Navigation className="w-[18px] h-[18px] text-white" />}
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white">{nomePlataforma}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <p className="text-sm font-semibold truncate max-w-[120px] text-white">{(profile?.nome || '').split(' ')[0]}</p>
              {activeScreen && (
                <p className="text-[10px] text-white/50 capitalize">{activeScreen}</p>
              )}
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-2xl object-cover border-2 border-white/15 shadow-md" />
            ) : (
              <img src={getAnimalAvatarUrl(profile?.id || profile?.nome || '?')} alt="" className="w-9 h-9 rounded-2xl object-cover border-2 border-white/15 shadow-md" />
            )}
            <button
              onClick={() => { signOut(); navigate('/'); }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="page-enter">
          {children}
        </div>
      </main>

      {/* ── Bottom Navigation — floating dock ── */}
      <nav className="shrink-0 z-40 safe-bottom">
        <div className="mx-3 mb-2 bg-card/95 backdrop-blur-2xl rounded-2xl border border-white/[0.1] shadow-2xl shadow-black/40">
          <div className="flex items-stretch justify-around h-[60px] px-1">
            {(isMotoristaRoute || (!isAdminScreen && !isAdminRoute)) ? (
              <>
                {MOTORISTA_NAV.map(item => {
                  const isActive = location.pathname === item.path;
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
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          isActive ? `bg-gradient-to-br ${item.color} shadow-lg shadow-white/10` : 'text-white/45'
                        }`}
                      >
                        <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : ''}`} />
                      </motion.div>
                      <span className={`text-[9px] font-bold tracking-wide ${isActive ? 'text-white' : 'text-white/40'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
                {isAdmin && (
                  <>
                    <div className="w-px self-stretch my-2.5 bg-white/12 mx-0.5" />
                    <button
                      onClick={() => { setActiveScreen('admin'); navigate('/admin'); }}
                      className="relative flex flex-col items-center justify-center gap-1 flex-1 tap-highlight"
                      title="Admin"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.08] border border-white/15 text-white/60 hover:text-white/90 hover:border-accent/30 transition-all">
                        <Shield className="w-[18px] h-[18px]" />
                      </div>
                      <span className="text-[9px] font-bold tracking-wide text-white/50">Admin</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveScreen('motorista'); navigate('/motorista/dashboard'); }}
                  className="relative flex flex-col items-center justify-center gap-1 flex-1 tap-highlight"
                  title="Motorista"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.08] border border-white/15 text-white/60 hover:text-white/90 hover:border-accent/30 transition-all">
                    <Truck className="w-[18px] h-[18px]" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wide text-white/50">Motorista</span>
                </button>
                <div className="w-px self-stretch my-2.5 bg-white/12 mx-0.5" />
                <div className="relative flex flex-col items-center justify-center gap-1 flex-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-400 shadow-lg shadow-indigo-500/25">
                    <Shield className="w-[18px] h-[18px] text-white" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wide text-white">Admin</span>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
