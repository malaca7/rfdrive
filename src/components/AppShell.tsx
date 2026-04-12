import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Car, LogOut, User } from 'lucide-react';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, role, user, signOut } = useAuth();

  const roleLabel: Record<string, string> = {
    cliente: 'Cliente',
    motorista: 'Motorista',
    admin: 'Administrador',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Car className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-bold text-lg">RideAI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.nome}</p>
              {user?.id && (
                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={user.id}>
                  ID: {user.id}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{roleLabel[role || 'cliente']}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
};

export default AppShell;
