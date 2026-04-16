import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  ClipboardList, ChevronRight, Loader2, CheckCircle, Clock, XCircle, DollarSign, Filter,
} from 'lucide-react';

type PeriodFilter = 'semana' | 'semana_passada' | 'mes' | 'personalizado';

function getWeekRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getLastWeekRange(): [Date, Date] {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() - now.getDay() - 1);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

function getMonthRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

const MotoristaHistoricoViagens: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('semana');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo((): [Date, Date] | null => {
    switch (period) {
      case 'semana': return getWeekRange();
      case 'semana_passada': return getLastWeekRange();
      case 'mes': return getMonthRange();
      case 'personalizado':
        if (customStart && customEnd) {
          return [new Date(customStart + 'T00:00:00'), new Date(customEnd + 'T23:59:59')];
        }
        return null;
    }
  }, [period, customStart, customEnd]);

  const { data: viagens, isLoading } = useQuery({
    queryKey: ['historico-viagens-completo', user?.id, dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return [];
      const { data, error } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, valor, status, concluida_at, created_at, observacao_motorista')
        .eq('motorista_id', user!.id)
        .in('status', ['em_analise', 'aprovada', 'finalizada', 'recusada'])
        .gte('concluida_at', dateRange[0].toISOString())
        .lte('concluida_at', dateRange[1].toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!dateRange,
  });

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

        {/* Period Filter */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <Card>
            <CardContent className="py-3 px-[4%] space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtrar Período</span>
              </div>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">📅 Esta Semana</SelectItem>
                  <SelectItem value="semana_passada">📅 Semana Passada</SelectItem>
                  <SelectItem value="mes">📅 Este Mês</SelectItem>
                  <SelectItem value="personalizado">📅 Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {period === 'personalizado' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">De</label>
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-10" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Até</label>
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-10" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Trip List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (viagens?.length || 0) > 0 ? (
          <div className="space-y-2">
            {viagens!.map((ride, idx) => (
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
                Nenhuma viagem encontrada no período selecionado
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaHistoricoViagens;
