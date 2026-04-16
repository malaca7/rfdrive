import React, { Suspense } from 'react';
import { AdminPrecosLayout } from '@/components/AdminPrecosLayout';
import { Loader2 } from 'lucide-react';

const AdminPricing = React.lazy(() => import('@/components/AdminPricing'));

const AdminPrecosHorarios: React.FC = () => (
  <AdminPrecosLayout>
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>}>
      <AdminPricing defaultTab="horarios" />
    </Suspense>
  </AdminPrecosLayout>
);

export default AdminPrecosHorarios;
