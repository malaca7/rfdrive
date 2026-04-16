import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  Trophy, TrendingUp, Loader2, BarChart3,
  Crown, Medal, Award, Calendar, Filter, Users, Car,
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

const RANK_ICONS = [
  <Crown className="w-5 h-5 text-yellow-400" />,
  <Medal className="w-5 h-5 text-gray-300" />,
  <Award className="w-5 h-5 text-amber-600" />,
];

const MotoristaDashboardAll: React.FC = () => {
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

  // ── Todas corridas aprovadas da plataforma no período ──
  const { data: allRides, isLoading } = useQuery({
    queryKey: ['plataforma-corridas', dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return [];
      const { data, error } = await supabase
        .from('corridas')
        .select('id, motorista_id, valor, status, concluida_at, created_at')
        .in('status', ['aprovada', 'finalizada'])
        .gte('concluida_at', dateRange[0].toISOString())
        .lte('concluida_at', dateRange[1].toISOString());
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
        .select('id, nome, avatar_url')
        .in('id', motoristIds);
      if (error) throw error;
      const map: Record<string, { nome: string; avatar_url: string | null }> = {};
      data?.forEach(u => { map[u.id] = { nome: u.nome, avatar_url: u.avatar_url }; });
      return map;
    },
    enabled: motoristIds.length > 0,
  });

  // ── Ranking / Stats ──
  const { ranking, platformStats } = useMemo(() => {
    if (!allRides) return { ranking: [], platformStats: { total: 0, receita: 0, motoristas: 0 } };

    const byDriver: Record<string, { viagens: number }> = {};

    allRides.forEach(r => {
      const mid = r.motorista_id || 'unknown';
      if (!byDriver[mid]) byDriver[mid] = { viagens: 0 };
      byDriver[mid].viagens++;
    });

    const rankArr = Object.entries(byDriver)
      .map(([id, stats]) => ({
        id,
        nome: motoristas?.[id]?.nome || 'Motorista',
        avatar_url: motoristas?.[id]?.avatar_url || null,
        ...stats,
        isMe: id === user?.id,
      }))
      .sort((a, b) => b.viagens - a.viagens);

    return {
      ranking: rankArr,
      platformStats: {
        total: allRides.length,
        motoristas: Object.keys(byDriver).length,
      },
    };
  }, [allRides, motoristas, user]);

  const myPosition = ranking.findIndex(r => r.isMe) + 1;

  const periodLabel = {
    semana: 'Esta Semana',
    semana_passada: 'Semana Passada',
    mes: 'Este Mês',
    personalizado: 'Período Personalizado',
  };

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <h1 className="text-[clamp(1.3rem,4.5vw,1.75rem)] font-extrabold leading-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-accent" />
            Dashboard Geral
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            Desempenho de todos os motoristas da plataforma
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
            {/* Platform Stats */}
            <div className="grid grid-cols-2 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-accent/20">
                  <CardContent className="py-[12%] text-center">
                    <Car className="w-5 h-5 text-accent mx-auto mb-1" />
                    <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold text-accent">{platformStats.total}</p>
                    <p className="text-[clamp(0.55rem,1.8vw,0.65rem)] text-muted-foreground font-medium">Viagens</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-blue-500/20">
                  <CardContent className="py-[12%] text-center">
                    <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold text-blue-400">{platformStats.motoristas}</p>
                    <p className="text-[clamp(0.55rem,1.8vw,0.65rem)] text-muted-foreground font-medium">Motoristas</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* My position */}
            {myPosition > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
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

            {/* Ranking */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Ranking de Motoristas
                </h2>
                <Badge variant="outline" className="text-xs">{periodLabel[period]}</Badge>
              </div>

              {ranking.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma viagem neste período</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {ranking.map((driver, i) => (
                    <Card key={driver.id} className={`border-border/50 transition-colors ${driver.isMe ? 'border-accent/40 bg-accent/5' : ''}`}>
                      <CardContent className="py-3 px-[4%]">
                        <div className="flex items-center gap-3">
                          {/* Position */}
                          <div className="flex items-center justify-center w-8 shrink-0">
                            {i < 3 ? RANK_ICONS[i] : (
                              <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                            )}
                          </div>
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                            {driver.avatar_url ? (
                              <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {driver.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {driver.nome}
                              {driver.isMe && <span className="text-accent ml-1">(você)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{driver.viagens} viagem{driver.viagens > 1 ? 'ns' : ''}</p>
                          </div>
                          {/* Corridas */}
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
          </>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaDashboardAll;
