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
  Star, TrendingUp, DollarSign, CheckCircle, Clock,
  Loader2, BarChart3, Filter, Calendar,
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

const MotoristaDashboard: React.FC = () => {
  const { user, profile } = useAuth();
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

  // ── Corridas concluídas (aprovadas + em_analise) no período ──
  const { data: completedRides, isLoading } = useQuery({
    queryKey: ['meu-desempenho', user?.id, dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return [];
      const { data, error } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, valor, status, concluida_at, created_at')
        .eq('motorista_id', user!.id)
        .in('status', ['em_analise', 'aprovada', 'finalizada'])
        .gte('concluida_at', dateRange[0].toISOString())
        .lte('concluida_at', dateRange[1].toISOString())
        .order('concluida_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!dateRange,
  });

  // ── Média de avaliação ──
  const { data: avgRating } = useQuery({
    queryKey: ['driver-avg-rating', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('motorista_id', user!.id);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum, r) => sum + r.nota, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!user,
  });

  // ── Avaliações individuais ──
  const { data: avaliacoes } = useQuery({
    queryKey: ['driver-avaliacoes-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('id, nota, comentario, created_at, tipo')
        .eq('motorista_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: avaliacoesAdmin } = useQuery({
    queryKey: ['driver-avaliacoes-admin-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_admin')
        .select('id, nota, comentario, created_at')
        .eq('motorista_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // ── Stats computados ──
  const totalViagens = completedRides?.length || 0;
  const viagensAprovadas = completedRides?.filter(r => r.status === 'aprovada' || r.status === 'finalizada').length || 0;
  const viagensPendentes = completedRides?.filter(r => r.status === 'em_analise').length || 0;
  const receitaTotal = completedRides
    ?.filter(r => r.status === 'aprovada' || r.status === 'finalizada')
    .reduce((sum, r) => sum + (r.valor || 0), 0) || 0;

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <h1 className="text-[clamp(1.5rem,5vw,2rem)] font-extrabold leading-tight">
            Olá, <span className="text-gradient">{profile?.nome || 'Motorista'}</span>
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            Seu desempenho pessoal
          </p>
        </motion.div>

        {/* Period Filter */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <Card className="mb-[4%]">
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="border-accent/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 mx-auto mb-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-accent">{viagensAprovadas}</p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Aprovadas</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-green-500/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10 mx-auto mb-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-green-400">
                      R$ {receitaTotal.toFixed(0)}
                    </p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Receita Total</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-yellow-500/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/10 mx-auto mb-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-yellow-400">{viagensPendentes}</p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Pendentes</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Rating */}
            {avgRating && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="mb-[4%] border-yellow-500/20 bg-yellow-500/5">
                  <CardContent className="py-3 flex items-center justify-between px-[4%]">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-lg text-yellow-400">{avgRating.avg}</span>
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{avgRating.count} avaliação{avgRating.count > 1 ? 'ões' : ''}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Avaliações Recebidas */}
            {((avaliacoes && avaliacoes.length > 0) || (avaliacoesAdmin && avaliacoesAdmin.length > 0)) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Star className="w-4 h-4 text-accent" />
                    Avaliações Recebidas
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    {(avaliacoes?.length || 0) + (avaliacoesAdmin?.length || 0)} total
                  </Badge>
                </div>
                <div className="space-y-2 mb-[4%]">
                  {avaliacoesAdmin?.map(a => (
                    <Card key={`admin-${a.id}`} className="border-border/50">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= a.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        {a.comentario && <p className="text-xs text-muted-foreground">{a.comentario}</p>}
                      </CardContent>
                    </Card>
                  ))}
                  {avaliacoes?.map(a => (
                    <Card key={`av-${a.id}`} className="border-border/50">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= a.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        {a.comentario && <p className="text-xs text-muted-foreground">{a.comentario}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaDashboard;
