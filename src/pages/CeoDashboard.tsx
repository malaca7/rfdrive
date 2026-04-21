import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CeoLayout from '@/components/CeoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, DollarSign, Car, Users, Shield, TrendingUp, Activity } from 'lucide-react';
import { ROLE_BADGE_CLASS } from '@/lib/rbac';
import { motion } from 'framer-motion';

const CeoDashboard: React.FC = () => {
  const { data: users = [] } = useQuery({
    queryKey: ['ceo-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, nome, tipo, roles, status, created_at');
      if (error) throw error;
      return data as { id: string; nome: string; tipo: string; roles?: string[] | null; status: string; created_at: string }[];
    },
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ['ceo-rides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('id, status, valor, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; status: string; valor: number | null; created_at: string }[];
    },
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const stats = useMemo(() => {
    const ceos = users.filter(u => u.tipo === 'ceo' || u.roles?.includes('ceo'));
    const admins = users.filter(u => (u.tipo === 'admin' || u.roles?.includes('admin')) && u.tipo !== 'ceo' && !u.roles?.includes('ceo'));
    const motoristas = users.filter(u => u.tipo === 'motorista' || u.roles?.includes('motorista'));
    const aceitas = rides.filter(r => r.status === 'aprovada');
    const receita = aceitas.reduce((s, r) => s + (r.valor || 0), 0);
    return { ceos: ceos.length, admins: admins.length, motoristas: motoristas.length, totalUsers: users.length, totalRides: rides.length, aceitas: aceitas.length, receita };
  }, [users, rides]);

  const cards = [
    { label: 'Receita Total', value: `R$ ${stats.receita.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: 'from-yellow-500 to-amber-400', badge: 'Financeiro' },
    { label: 'Viagens Concluídas', value: stats.aceitas, icon: Car, color: 'from-emerald-500 to-green-400', badge: 'Operação' },
    { label: 'Total de Corridas', value: stats.totalRides, icon: Activity, color: 'from-blue-500 to-cyan-400', badge: 'Acumulado' },
    { label: 'Motoristas', value: stats.motoristas, icon: Users, color: 'from-violet-500 to-purple-400', badge: 'Usuários' },
    { label: 'Administradores', value: stats.admins, icon: Shield, color: 'from-orange-500 to-amber-400', badge: 'Gestão' },
    { label: 'CEOs', value: stats.ceos, icon: Crown, color: 'from-yellow-600 to-yellow-400', badge: 'Nível máximo' },
  ];

  return (
    <CeoLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h1 className="text-xl font-extrabold">Painel CEO</h1>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGE_CLASS.ceo}`}>
            Nível Máximo
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Visão estratégica completa da plataforma</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/40 hover:border-yellow-400/30 transition-all">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{card.badge}</span>
                  </div>
                  <p className="text-2xl font-extrabold">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="border-yellow-400/20">
        <CardContent className="p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            Resumo Executivo
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• <span className="text-foreground font-semibold">{stats.totalRides}</span> corridas registradas no total</p>
            <p>• <span className="text-foreground font-semibold">{stats.aceitas}</span> corridas concluídas ({stats.totalRides > 0 ? ((stats.aceitas / stats.totalRides) * 100).toFixed(0) : 0}% de conversão)</p>
            <p>• Receita acumulada: <span className="text-yellow-400 font-semibold">R$ {stats.receita.toFixed(2).replace('.', ',')}</span></p>
            <p>• <span className="text-foreground font-semibold">{stats.motoristas}</span> motoristas cadastrados</p>
          </div>
        </CardContent>
      </Card>
    </CeoLayout>
  );
};

export default CeoDashboard;
