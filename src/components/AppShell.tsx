import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Navigation, LogOut, User, Shield, Truck } from 'lucide-react';

const SCREEN_CONFIG: Record<string, { label: string; shortLabel: string; icon: React.ReactNode; color: string }> = {
  cliente: {
    label: 'Cliente',
    shortLabel: 'Cliente',
    icon: <User className="w-3.5 h-3.5" />,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  },
  motorista: {
    label: 'Motorista',
    shortLabel: 'Motorista',
    icon: <Truck className="w-3.5 h-3.5" />,
    color: 'bg-green-500/20 text-green-400 border-green-500/40',
  },
  admin: {
    label: 'Admin',
    shortLabel: 'Admin',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  },
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, roles, user, signOut, availableScreens, activeScreen, setActiveScreen } = useAuth();

  const showNav = availableScreens.length > 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Navigation className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-bold text-lg">RF Drive</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.nome}</p>
              {user?.id && (
                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={user.id}>
                  ID: {user.id}
                </p>
              )}
              <div className="flex items-center gap-1 justify-end">
                {roles.map(r => {
                  const cfg = SCREEN_CONFIG[r];
                  return cfg ? (
                    <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cfg.color}`}>
                      {cfg.shortLabel}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Navigation bar for multi-role users */}
        {showNav && (
          <div className="border-t border-border/50 bg-background/80">
            <div className="max-w-4xl mx-auto px-4">
              <nav className="flex gap-1 py-1.5">
                {availableScreens.map(screen => {
                  const cfg = SCREEN_CONFIG[screen];
                  if (!cfg) return null;
                  const isActive = screen === activeScreen;
                  return (
                    <button
                      key={screen}
                      onClick={() => setActiveScreen(screen)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                        transition-all duration-200 border
                        ${isActive
                          ? `${cfg.color} shadow-sm`
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }
                      `}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
};

export default AppShell;
