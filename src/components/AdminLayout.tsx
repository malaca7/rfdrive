import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3, Car, Users, DollarSign, Settings, Star,
} from 'lucide-react';
import AppShell from '@/components/AppShell';

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
  { path: '/admin/corridas', label: 'Corridas', icon: <Car className="w-4 h-4" /> },
  { path: '/admin/usuarios', label: 'Usuários', icon: <Users className="w-4 h-4" /> },
  { path: '/admin/precos', label: 'Preços', icon: <DollarSign className="w-4 h-4" /> },
  { path: '/admin/perform', label: 'Avaliações', icon: <Star className="w-4 h-4" /> },
  { path: '/admin/config', label: 'Config', icon: <Settings className="w-4 h-4" /> },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell>
      {/* Admin sub-navigation */}
      <div className="sticky top-0 z-40 bg-[hsl(0_0%_5%)]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="w-full max-w-5xl mx-auto px-[3%]">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
            {ADMIN_NAV.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-lg shadow-accent/20'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Page content */}
      <div className="w-full px-[3%] py-[3%] max-w-5xl mx-auto">
        {children}
      </div>
    </AppShell>
  );
};

export default AdminLayout;
