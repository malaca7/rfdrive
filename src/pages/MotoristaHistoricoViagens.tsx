import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  ClipboardList, ChevronRight, Loader2, CheckCircle, Clock, XCircle, DollarSign,
} from 'lucide-react';

type StatusFilter = 'todos' | 'aprovada' | 'em_analise' | 'recusada';

const MotoristaHistoricoViagens: React.FC = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const { data: viagens, isLoading } = useQuery({
    queryKey: ['historico-viagens-completo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, valor, status, concluida_at, created_at, observacao_motorista')
        .eq('motorista_id', user!.id)
        .in('status', ['em_analise', 'aprovada', 'finalizada', 'recusada'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = viagens?.filter(v => {
    if (statusFilter === 'todos') return true;
    if (statusFilter === 'aprovada') return v.status === 'aprovada' || v.status === 'finalizada';
    return v.status === statusFilter;
  }) || [];

  const totalAprovadas = viagens?.filter(v => v.status === 'aprovada' || v.status === 'finalizada').length || 0;
  const totalPendentes = viagens?.filter(v => v.status === 'em_analise').length || 0;
  const totalRecusadas = viagens?.filter(v => v.status === 'recusada').length || 0;
  const receita = viagens
    ?.filter(v => v.status === 'aprovada' || v.status === 'finalizada')
    .reduce((s, v) => s + (v.valor || 0), 0) || 0;

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto space-y-[3%]">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[clamp(1.3rem,4.5vw,1.75rem)] font-extrabold leading-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-accent" />
            Viagens Registradas
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            Histórico completo de viagens
          </p>
        </motion.div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Aprovadas', value: totalAprovadas, color: 'text-green-400', border: 'border-green-500/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
            { label: 'Pendentes', value: totalPendentes, color: 'text-yellow-400', border: 'border-yellow-500/20', icon: <Clock className="w-3.5 h-3.5" /> },
            { label: 'Recusadas', value: totalRecusadas, color: 'text-red-400', border: 'border-red-500/20', icon: <XCircle className="w-3.5 h-3.5" /> },
            { label: 'Receita', value: `R$${receita.toFixed(0)}`, color: 'text-accent', border: 'border-accent/20', icon: <DollarSign className="w-3.5 h-3.5" /> },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={s.border}>
                <CardContent className="py-3 text-center">
                  <div className={`${s.color} mx-auto mb-1 flex justify-center`}>{s.icon}</div>
                  <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: 'todos' as const, label: 'Todos', count: viagens?.length || 0 },
            { key: 'aprovada' as const, label: 'Aprovadas', count: totalAprovadas },
            { key: 'em_analise' as const, label: 'Pendentes', count: totalPendentes },
            { key: 'recusada' as const, label: 'Recusadas', count: totalRecusadas },
          ]).map(f => (
            <Button
              key={f.key}
              variant={statusFilter === f.key ? 'default' : 'outline'}
              size="sm"
              className={`text-xs rounded-full shrink-0 ${statusFilter === f.key ? 'gradient-accent text-accent-foreground' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>

        {/* Trip List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((ride, idx) => (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.5) }}
              >
                <Card className="border-border/50">
                  <CardContent className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(ride.concluida_at || ride.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {ride.valor != null && (
                          <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
                            R$ {ride.valor.toFixed(2)}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            ride.status === 'aprovada' || ride.status === 'finalizada'
                              ? 'text-green-400 border-green-500/30 text-[10px]'
                              : ride.status === 'recusada'
                                ? 'text-red-400 border-red-500/30 text-[10px]'
                                : 'text-yellow-400 border-yellow-500/30 text-[10px]'
                          }
                        >
                          {ride.status === 'aprovada' || ride.status === 'finalizada'
                            ? '✅ Aprovada'
                            : ride.status === 'recusada'
                              ? '❌ Recusada'
                              : '⏳ Em Análise'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-xs truncate">{ride.origem_texto}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span className="text-xs truncate">{ride.destino_texto}</span>
                    </div>
                    {ride.observacao_motorista && (
                      <p className="text-[10px] text-muted-foreground italic truncate">
                        📝 {ride.observacao_motorista}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma viagem encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter !== 'todos' ? 'Tente outro filtro' : 'Registre viagens na aba "Registrar"'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaHistoricoViagens;
