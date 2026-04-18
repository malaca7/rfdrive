import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RideRequestForm from '@/components/RideRequestForm';
import RideHistory from '@/components/RideHistory';
import AppShell from '@/components/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, History, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const ClientDashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {/* Hero greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-[5%]"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Bem-vindo de volta</span>
          </div>
          <h1 className="text-[clamp(1.5rem,5vw,2rem)] font-extrabold leading-tight">
            Olá, <span className="text-gradient">{profile?.nome || 'Cliente'}</span>
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">Para onde vamos hoje?</p>
        </motion.div>

        <Tabs defaultValue="nova" className="w-full">
          <TabsList className="w-full mb-[4%] h-12 p-1 bg-muted/30 rounded-2xl border border-border">
            <TabsTrigger value="nova" className="flex-1 gap-2 rounded-xl h-full text-sm font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.3)]">
              <Plus className="w-4 h-4" /> Nova Corrida
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 gap-2 rounded-xl h-full text-sm font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.3)]">
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
