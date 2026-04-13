import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RideRequestForm from '@/components/RideRequestForm';
import RideHistory from '@/components/RideHistory';
import AppShell from '@/components/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, History } from 'lucide-react';

const ClientDashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Olá, <span className="text-gradient">{profile?.nome || 'Cliente'}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Para onde vamos hoje?</p>
        </div>

        <Tabs defaultValue="nova" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="nova" className="flex-1 gap-2">
              <Plus className="w-4 h-4" /> Nova
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 gap-2">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>
          <TabsContent value="nova">
            <RideRequestForm />
          </TabsContent>
          <TabsContent value="historico">
            <RideHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default ClientDashboard;
