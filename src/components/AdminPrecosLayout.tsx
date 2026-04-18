import React, { Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { Loader2, Tag, Clock, TableProperties } from 'lucide-react';

const AdminPricing = React.lazy(() => import('@/components/AdminPricing'));

const PRECO_NAV = [
  { path: '/admin/precos/config/tarifas', label: 'Tarifas', icon: <Tag className="w-4 h-4" /> },
  { path: '/admin/precos/config/horarios', label: 'Horários', icon: <Clock className="w-4 h-4" /> },
  { path: '/admin/precos/tabela', label: 'Tabela RF', icon: <TableProperties className="w-4 h-4" /> },
];

const AdminPrecosLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AdminLayout>
      {/* Sub-nav for pricing */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {PRECO_NAV.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive ? 'bg-muted/60 text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
      {children}
    </AdminLayout>
  );
};

export { AdminPrecosLayout };
export default AdminPrecosLayout;
