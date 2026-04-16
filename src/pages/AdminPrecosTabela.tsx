import React, { Suspense } from 'react';
import { AdminPrecosLayout } from '@/components/AdminPrecosLayout';
import { Loader2 } from 'lucide-react';

const AdminTabelaPrecos = React.lazy(() => import('@/components/AdminTabelaPrecos'));

const AdminPrecosTabela: React.FC = () => (
  <AdminPrecosLayout>
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>}>
      <AdminTabelaPrecos />
    </Suspense>
  </AdminPrecosLayout>
);

export default AdminPrecosTabela;
