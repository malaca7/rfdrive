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
  Trophy, TrendingUp, Loader2,
  Crown, Medal, Award, Filter, Users, Car,
  Activity, CheckCircle, Clock, Eye, AlertTriangle, XCircle,
  FileText, MapPin, Calendar, Star,
} from 'lucide-react';

type PeriodFilter = 'semana' | 'semana_passada' | 'mes' | 'personalizado';

function getWeekRange(): [Date, Date] {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getLastWeekRange(): [Date, Date] {
  const [thisStart] = getWeekRange();
  const end = new Date(thisStart);
  end.setDate(end.getDate() - 1);
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

const RANK_ICONS = [
  <Crown key="1" className="w-5 h-5 text-yellow-400" />,
  <Medal key="2" className="w-5 h-5 text-gray-300" />,
  <Award key="3" className="w-5 h-5 text-amber-600" />,
];

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
  </div>
);

export const MotoristaDashboardGeralContent: React.FC = () => {
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

  // ── Todas corridas da plataforma no período ──
  const { data: allRides, isLoading } = useQuery({
    queryKey: ['plataforma-corridas-full', dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return [];
      const { data, error } = await supabase
        .from('corridas')
        .select('id, motorista_id, status, origem_texto, destino_texto, created_at, concluida_at')
        .eq('status', 'aprovada')
        .gte('created_at', dateRange[0].toISOString())
        .lte('created_at', dateRange[1].toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!dateRange,
  });

  // ── Nomes dos motoristas ──
  const motoristIds = useMemo(() => {
    const ids = new Set<string>();
    allRides?.forEach(r => { if (r.motorista_id) ids.add(r.motorista_id); });
    return Array.from(ids);
  }, [allRides]);

  const { data: motoristas } = useQuery({
    queryKey: ['motoristas-nomes', motoristIds],
    queryFn: async () => {
      if (motoristIds.length === 0) return {};
      const { data, error } = await supabase
        .from('users')
        .select('id, nome')
        .in('id', motoristIds);
      if (error) throw error;
      const map: Record<string, { nome: string; avatar_url: string | null }> = {};
      data?.forEach(u => { map[u.id] = { nome: u.nome, avatar_url: (u as any).avatar_url || null }; });
      return map;
    },
    enabled: motoristIds.length > 0,
  });

  // ── Média de avaliação por motorista ──
  const { data: driverRatings } = useQuery({
    queryKey: ['plataforma-avaliacoes', motoristIds],
    queryFn: async () => {
      if (motoristIds.length === 0) return {};
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('motorista_id, nota')
        .in('motorista_id', motoristIds);
      if (error) throw error;
      const map: Record<string, number[]> = {};
      data?.forEach(a => {
        if (!map[a.motorista_id]) map[a.motorista_id] = [];
        map[a.motorista_id].push(a.nota);
      });
      const { data: linkEvals } = await supabase
        .from('evaluation_links')
        .select('motorista_id, nota')
        .in('motorista_id', motoristIds)
        .eq('status', 'respondida')
        .not('nota', 'is', null);
      linkEvals?.forEach(a => {
        if (!map[a.motorista_id]) map[a.motorista_id] = [];
        if (a.nota) map[a.motorista_id].push(a.nota);
      });
      return map;
    },
    enabled: motoristIds.length > 0,
  });

  // ── Stats computados ──
  const { ranking, platformStats, statusBreakdown, topRoutes, ridesByDay, dayNames } = useMemo(() => {
    if (!allRides) return {
      ranking: [], platformStats: { total: 0, motoristas: 0, today: 0, week: 0, avgRating: null as number | null, totalRatings: 0, completedCount: 0, cancelledCount: 0 },
      statusBreakdown: { em_analise: 0, aprovada: 0, nao_realizada: 0 },
      topRoutes: [] as { origem: string; destino: string; count: number }[],
      ridesByDay: Array(7).fill(0) as number[],
      dayNames: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const byStatus = { em_analise: 0, aprovada: 0, nao_realizada: 0 };
    allRides.forEach(r => { if (r.status in byStatus) byStatus[r.status as keyof typeof byStatus]++; });

    const ridesToday = allRides.filter(r => new Date(r.created_at) >= today).length;
    const ridesWeek = allRides.filter(r => new Date(r.created_at) >= weekAgo).length;
    const completedCount = allRides.filter(r => r.status === 'aprovada').length;
    const cancelledCount = byStatus.nao_realizada;

    const allRatingsFlat: number[] = [];
    if (driverRatings) {
      Object.values(driverRatings).forEach(arr => arr.forEach(n => allRatingsFlat.push(n)));
    }
    const avgRating = allRatingsFlat.length > 0
      ? allRatingsFlat.reduce((a, b) => a + b, 0) / allRatingsFlat.length : null;

    const byDriver: Record<string, { viagens: number }> = {};
    allRides.filter(r => r.status === 'aprovada').forEach(r => {
      const mid = r.motorista_id || 'unknown';
      if (!byDriver[mid]) byDriver[mid] = { viagens: 0 };
      byDriver[mid].viagens++;
    });

    const rankArr = Object.entries(byDriver)
      .map(([id, stats]) => {
        const ratings = driverRatings?.[id] || [];
        const avgR = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        return {
          id,
          nome: motoristas?.[id]?.nome || 'Motorista',
          avatar_url: motoristas?.[id]?.avatar_url || null,
          ...stats,
          avgRating: avgR,
          totalRatings: ratings.length,
          isMe: id === user?.id,
        };
      })
      .sort((a, b) => b.viagens - a.viagens);

    const routeCount: Record<string, { origem: string; destino: string; count: number }> = {};
    allRides.forEach(r => {
      if (r.origem_texto && r.destino_texto) {
        const key = `${r.origem_texto}→${r.destino_texto}`;
        if (!routeCount[key]) routeCount[key] = { origem: r.origem_texto, destino: r.destino_texto, count: 0 };
        routeCount[key].count++;
      }
    });
    const topR = Object.values(routeCount).sort((a, b) => b.count - a.count).slice(0, 5);

    const dayN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const byDay = Array(7).fill(0);
    allRides.forEach(r => { byDay[new Date(r.created_at).getDay()]++; });

    return {
      ranking: rankArr,
      platformStats: { total: allRides.length, motoristas: Object.keys(byDriver).length, today: ridesToday, week: ridesWeek, avgRating, totalRatings: allRatingsFlat.length, completedCount, cancelledCount },
      statusBreakdown: byStatus,
      topRoutes: topR,
      ridesByDay: byDay,
      dayNames: dayN,
    };
  }, [allRides, motoristas, user, driverRatings]);

  const myPosition = ranking.findIndex(r => r.isMe) + 1;
  const maxDay = Math.max(...ridesByDay, 1);

  const formatRange = (s: Date, e: Date) => {
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${fmt(s)} – ${fmt(e)}`;
  };

  const periodLabel: Record<PeriodFilter, string> = {
    semana: `Esta Semana (${formatRange(...getWeekRange())})`,
    semana_passada: `Semana Passada (${formatRange(...getLastWeekRange())})`,
    mes: 'Este Mês',
    personalizado: 'Personalizado',
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <h1 className="text-[clamp(1.3rem,4.5vw,1.75rem)] font-extrabold leading-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-accent" />
            Dashboard Geral
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            Visão completa da plataforma
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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
            {/* My position */}
            {myPosition > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                <Card className="mb-[4%] border-accent/30 bg-accent/5">
                  <CardContent className="py-3 px-[4%] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center text-white font-bold text-sm">
                        #{myPosition}
                      </div>
                      <div>
                        <p className="text-sm font-bold">Sua Posição</p>
                        <p className="text-xs text-muted-foreground">{periodLabel[period]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">
                        {ranking[myPosition - 1]?.viagens || 0} viagens
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Ranking ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Ranking de Motoristas
                </h2>
                <Badge variant="outline" className="text-xs">{periodLabel[period]}</Badge>
              </div>

              {ranking.length === 0 ? (
                <Card className="mb-[4%]">
                  <CardContent className="py-12 text-center">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma viagem neste período</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 mb-[4%]">
                  {ranking.map((driver, i) => (
                    <Card key={driver.id} className={`border-border/50 transition-colors ${driver.isMe ? 'border-accent/40 bg-accent/5' : ''}`}>
                      <CardContent className="py-3 px-[4%]">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 shrink-0">
                            {i < 3 ? RANK_ICONS[i] : (
                              <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                            )}
                          </div>
                          <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                            {driver.avatar_url ? (
                              <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {driver.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {driver.nome}
                              {driver.isMe && <span className="text-accent ml-1">(você)</span>}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{driver.viagens} viagem{driver.viagens > 1 ? 'ns' : ''}</span>
                              {driver.avgRating && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                                  {driver.avgRating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-accent">{driver.viagens}</p>
                            <p className="text-[10px] text-muted-foreground">corrida{driver.viagens !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <Card className="border-l-[3px] border-l-accent border-t-0 border-r-0 border-b-0 bg-accent/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <Car className="w-5 h-5 text-accent mx-auto mb-1" />
                    <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold text-accent">{platformStats.total}</p>
                    <p className="text-[clamp(0.6rem,1.8vw,0.7rem)] text-muted-foreground font-medium">Total Corridas</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <Card className="border-l-[3px] border-l-blue-500 border-t-0 border-r-0 border-b-0 bg-blue-500/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <Activity className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold text-blue-400">{platformStats.today}</p>
                    <p className="text-[clamp(0.6rem,1.8vw,0.7rem)] text-muted-foreground font-medium">Corridas Hoje</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                <Card className="border-l-[3px] border-l-green-500 border-t-0 border-r-0 border-b-0 bg-green-500/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <TrendingUp className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold text-green-400">{platformStats.week}</p>
                    <p className="text-[clamp(0.6rem,1.8vw,0.7rem)] text-muted-foreground font-medium">Últimos 7 Dias</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-l-[3px] border-l-yellow-500 border-t-0 border-r-0 border-b-0 bg-yellow-500/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                    <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold text-yellow-400">
                      {platformStats.avgRating ? platformStats.avgRating.toFixed(1) : '—'}
                    </p>
                    <p className="text-[clamp(0.6rem,1.8vw,0.7rem)] text-muted-foreground font-medium">
                      Nota Média {platformStats.totalRatings > 0 && `(${platformStats.totalRatings})`}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* ── Status Breakdown + Rotas ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Status das Corridas
                    </h3>
                    <div className="space-y-2">
                      {([
                        { key: 'em_analise', label: 'Em Análise', icon: Eye, color: 'text-orange-400', bg: 'bg-orange-500' },
                        { key: 'aprovada', label: 'Aprovadas', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500' },
                        { key: 'nao_realizada', label: 'Não Realizadas', icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-500' },
                      ] as const).map(s => (
                        <div key={s.key} className="flex items-center gap-2">
                          <s.icon className={`w-3.5 h-3.5 ${s.color} shrink-0`} />
                          <span className="text-xs w-24 truncate">{s.label}</span>
                          <div className="flex-1">
                            <Bar value={statusBreakdown[s.key]} max={platformStats.total} color={s.bg} />
                          </div>
                          <span className={`text-xs font-bold w-6 text-right ${s.color}`}>
                            {statusBreakdown[s.key]}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Taxa de conclusão</span>
                      <span className="font-semibold text-green-400">
                        {platformStats.total > 0 ? ((platformStats.completedCount / platformStats.total) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      Rotas Mais Solicitadas
                    </h3>
                    {topRoutes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhuma rota registrada</p>
                    ) : (
                      <div className="space-y-2">
                        {topRoutes.map((route, i) => (
                          <div key={i} className="bg-muted/30 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                <span className="text-xs truncate">{route.origem}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {route.count}x
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">{route.destino}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* ── Corridas p/ Dia + Resumo ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      Corridas por Dia
                    </h3>
                    <div className="flex items-end gap-1.5 h-24 px-1">
                      {[1,2,3,4,5,6,0].map((dayIdx) => (
                        <div key={dayIdx} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground">{ridesByDay[dayIdx]}</span>
                          <div
                            className="w-full bg-accent/80 rounded-t-sm transition-all"
                            style={{ height: `${maxDay > 0 ? (ridesByDay[dayIdx] / maxDay) * 64 : 0}px`, minHeight: ridesByDay[dayIdx] > 0 ? '4px' : '0px' }}
                          />
                          <span className="text-[9px] text-muted-foreground">{dayNames[dayIdx]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      Resumo
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-accent/10 rounded-lg p-3 text-center">
                        <Car className="w-4 h-4 text-accent mx-auto mb-1" />
                        <p className="text-lg font-bold">{platformStats.motoristas}</p>
                        <p className="text-[10px] text-muted-foreground">Motoristas Ativos</p>
                      </div>
                      <div className="bg-green-500/10 rounded-lg p-3 text-center">
                        <CheckCircle className="w-4 h-4 text-green-400 mx-auto mb-1" />
                        <p className="text-lg font-bold">{platformStats.completedCount}</p>
                        <p className="text-[10px] text-muted-foreground">Concluídas</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total de corridas</span>
                        <span className="font-semibold">{platformStats.total}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Não Realizadas</span>
                        <span className="font-semibold text-red-400">{platformStats.cancelledCount}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Corridas hoje</span>
                        <span className="font-semibold text-blue-400">{platformStats.today}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
    </div>
  );
};

const MotoristaDashboardAll: React.FC = () => (
  <AppShell>
    <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
      <MotoristaDashboardGeralContent />
    </div>
  </AppShell>
);

export default MotoristaDashboardAll;
