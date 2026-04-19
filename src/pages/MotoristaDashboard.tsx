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
  Star, TrendingUp, DollarSign, CheckCircle,
  Loader2, Filter, Calendar, Car, Award,
  Trophy, Flame, Target, Zap, Shield, ThumbsUp, MapPin,
  Crown, Rocket, CalendarCheck, CalendarDays, Medal, Gem, Banknote, Timer, Gauge, Map,
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

type DriverStats = {
  totalViagens: number;
  viagensAprovadas: number;
  avgRating: number | null;
  totalAvaliacoes: number;
  taxaConclusao: number;
  viagensHoje: number;
  viagensSemana: number;
  viagensMes: number;
  receitaAllTime: number;
  melhorDia: string;
};

type BadgeCategory = 'diario' | 'semanal' | 'mensal' | 'viagens' | 'receita' | 'qualidade';

type BadgeDef = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  condition: (stats: DriverStats) => boolean;
  color: string;
  category: BadgeCategory;
  progress?: (stats: DriverStats) => { current: number; target: number };
};

const BADGE_CATEGORIES: { key: BadgeCategory; label: string; emoji: string }[] = [
  { key: 'diario', label: 'Metas Diárias', emoji: '🔥' },
  { key: 'semanal', label: 'Metas Semanais', emoji: '📅' },
  { key: 'mensal', label: 'Metas Mensais', emoji: '📆' },
  { key: 'viagens', label: 'Marcos de Viagens', emoji: '🏆' },
  { key: 'receita', label: 'Metas de Receita', emoji: '💰' },
  { key: 'qualidade', label: 'Qualidade & Confiança', emoji: '⭐' },
];

const BADGES: BadgeDef[] = [
  // ── Metas Diárias ──
  { id: 'dia3', icon: <Timer className="w-5 h-5" />, title: 'Dia Produtivo', description: '3+ viagens em um dia', condition: (s) => s.viagensHoje >= 3, color: 'from-amber-500 to-orange-400', category: 'diario', progress: (s) => ({ current: s.viagensHoje, target: 3 }) },
  { id: 'dia5', icon: <Rocket className="w-5 h-5" />, title: 'Super Dia', description: '5+ viagens em um dia', condition: (s) => s.viagensHoje >= 5, color: 'from-red-500 to-rose-400', category: 'diario', progress: (s) => ({ current: s.viagensHoje, target: 5 }) },
  // ── Metas Semanais ──
  { id: 'week3', icon: <CalendarCheck className="w-5 h-5" />, title: 'Semana Ativa', description: '3+ viagens esta semana', condition: (s) => s.viagensSemana >= 3, color: 'from-teal-500 to-cyan-400', category: 'semanal', progress: (s) => ({ current: s.viagensSemana, target: 3 }) },
  { id: 'streak5', icon: <Flame className="w-5 h-5" />, title: 'Semana de Fogo', description: '5+ viagens na semana', condition: (s) => s.viagensSemana >= 5, color: 'from-red-500 to-orange-400', category: 'semanal', progress: (s) => ({ current: s.viagensSemana, target: 5 }) },
  { id: 'week10', icon: <Crown className="w-5 h-5" />, title: 'Maratonista', description: '10+ viagens na semana', condition: (s) => s.viagensSemana >= 10, color: 'from-violet-500 to-purple-400', category: 'semanal', progress: (s) => ({ current: s.viagensSemana, target: 10 }) },
  { id: 'week15', icon: <Medal className="w-5 h-5" />, title: 'Imbatível', description: '15+ viagens na semana', condition: (s) => s.viagensSemana >= 15, color: 'from-yellow-400 to-amber-300', category: 'semanal', progress: (s) => ({ current: s.viagensSemana, target: 15 }) },
  // ── Metas Mensais ──
  { id: 'mes15', icon: <CalendarDays className="w-5 h-5" />, title: 'Mês Ativo', description: '15+ viagens este mês', condition: (s) => s.viagensMes >= 15, color: 'from-sky-500 to-blue-400', category: 'mensal', progress: (s) => ({ current: s.viagensMes, target: 15 }) },
  { id: 'mes30', icon: <Gem className="w-5 h-5" />, title: 'Mês de Ouro', description: '30+ viagens no mês', condition: (s) => s.viagensMes >= 30, color: 'from-yellow-500 to-amber-400', category: 'mensal', progress: (s) => ({ current: s.viagensMes, target: 30 }) },
  { id: 'mes50', icon: <Gauge className="w-5 h-5" />, title: 'Máquina do Mês', description: '50+ viagens no mês', condition: (s) => s.viagensMes >= 50, color: 'from-emerald-500 to-green-400', category: 'mensal', progress: (s) => ({ current: s.viagensMes, target: 50 }) },
  { id: 'mes80', icon: <Map className="w-5 h-5" />, title: 'Rei da Estrada', description: '80+ viagens no mês', condition: (s) => s.viagensMes >= 80, color: 'from-rose-500 to-pink-400', category: 'mensal', progress: (s) => ({ current: s.viagensMes, target: 80 }) },
  // ── Marcos de Viagens ──
  { id: 'first', icon: <Zap className="w-5 h-5" />, title: 'Primeira Corrida', description: 'Completou a primeira viagem', condition: (s) => s.viagensAprovadas >= 1, color: 'from-blue-500 to-cyan-400', category: 'viagens', progress: (s) => ({ current: s.viagensAprovadas, target: 1 }) },
  { id: '10', icon: <Car className="w-5 h-5" />, title: '10 Viagens', description: 'Completou 10 viagens', condition: (s) => s.viagensAprovadas >= 10, color: 'from-green-500 to-emerald-400', category: 'viagens', progress: (s) => ({ current: s.viagensAprovadas, target: 10 }) },
  { id: '25', icon: <TrendingUp className="w-5 h-5" />, title: '25 Viagens', description: 'Completou 25 viagens', condition: (s) => s.viagensAprovadas >= 25, color: 'from-purple-500 to-violet-400', category: 'viagens', progress: (s) => ({ current: s.viagensAprovadas, target: 25 }) },
  { id: '50', icon: <Target className="w-5 h-5" />, title: '50 Viagens', description: 'Meio centenário na estrada', condition: (s) => s.viagensAprovadas >= 50, color: 'from-orange-500 to-amber-400', category: 'viagens', progress: (s) => ({ current: s.viagensAprovadas, target: 50 }) },
  { id: '100', icon: <Trophy className="w-5 h-5" />, title: 'Centenário', description: '100 viagens completadas!', condition: (s) => s.viagensAprovadas >= 100, color: 'from-yellow-500 to-yellow-300', category: 'viagens', progress: (s) => ({ current: s.viagensAprovadas, target: 100 }) },
  { id: '250', icon: <Award className="w-5 h-5" />, title: 'Lenda', description: '250 viagens — motorista lendário', condition: (s) => s.viagensAprovadas >= 250, color: 'from-red-500 to-pink-400', category: 'viagens', progress: (s) => ({ current: s.viagensAprovadas, target: 250 }) },
  // ── Metas de Receita ──
  { id: 'r500', icon: <Banknote className="w-5 h-5" />, title: 'R$ 500', description: 'Faturamento total de R$ 500+', condition: (s) => s.receitaAllTime >= 500, color: 'from-green-500 to-emerald-400', category: 'receita', progress: (s) => ({ current: s.receitaAllTime, target: 500 }) },
  { id: 'r1k', icon: <Banknote className="w-5 h-5" />, title: 'R$ 1.000', description: 'Faturamento total de R$ 1.000+', condition: (s) => s.receitaAllTime >= 1000, color: 'from-emerald-500 to-teal-400', category: 'receita', progress: (s) => ({ current: s.receitaAllTime, target: 1000 }) },
  { id: 'r5k', icon: <Banknote className="w-5 h-5" />, title: 'R$ 5.000', description: 'Faturamento total de R$ 5.000+', condition: (s) => s.receitaAllTime >= 5000, color: 'from-cyan-500 to-blue-400', category: 'receita', progress: (s) => ({ current: s.receitaAllTime, target: 5000 }) },
  // ── Qualidade & Confiança ──
  { id: 'star5', icon: <Star className="w-5 h-5" />, title: 'Nota Máxima', description: 'Avaliação média de 5.0', condition: (s) => s.avgRating === 5 && s.totalAvaliacoes >= 3, color: 'from-yellow-400 to-amber-300', category: 'qualidade' },
  { id: 'star4.5', icon: <ThumbsUp className="w-5 h-5" />, title: 'Excelência', description: 'Avaliação média ≥ 4.5', condition: (s) => (s.avgRating || 0) >= 4.5 && s.totalAvaliacoes >= 5, color: 'from-green-400 to-teal-300', category: 'qualidade' },
  { id: 'reliable', icon: <Shield className="w-5 h-5" />, title: 'Confiável', description: 'Taxa de conclusão ≥ 95%', condition: (s) => s.taxaConclusao >= 95 && s.viagensAprovadas >= 10, color: 'from-indigo-500 to-blue-400', category: 'qualidade' },
];

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

  const { data: completedRides, isLoading } = useQuery({
    queryKey: ['meu-desempenho', user?.id, dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return [];
      const { data, error } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, valor, status, concluida_at, created_at')
        .eq('motorista_id', user!.id)
        .gte('created_at', dateRange[0].toISOString())
        .lte('created_at', dateRange[1].toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!dateRange,
  });

  const { data: allTimeCount } = useQuery({
    queryKey: ['driver-alltime-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('corridas')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', user!.id)
        .in('status', ['aprovada', 'finalizada', 'em_analise']);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: allTimeTotalCount } = useQuery({
    queryKey: ['driver-alltime-total', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('corridas')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const weekRange = useMemo(() => getWeekRange(), []);
  const { data: weekRides } = useQuery({
    queryKey: ['driver-week-rides', user?.id, weekRange[0].toISOString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('corridas')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', user!.id)
        .in('status', ['aprovada', 'finalizada', 'em_analise'])
        .gte('concluida_at', weekRange[0].toISOString())
        .lte('concluida_at', weekRange[1].toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const monthRange = useMemo(() => getMonthRange(), []);
  const { data: monthRides } = useQuery({
    queryKey: ['driver-month-rides', user?.id, monthRange[0].toISOString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('corridas')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', user!.id)
        .in('status', ['aprovada', 'finalizada', 'em_analise'])
        .gte('created_at', monthRange[0].toISOString())
        .lte('created_at', monthRange[1].toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: allTimeRevenue } = useQuery({
    queryKey: ['driver-alltime-revenue', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('valor')
        .eq('motorista_id', user!.id)
        .in('status', ['aprovada', 'finalizada', 'em_analise']);
      if (error) throw error;
      return data?.reduce((sum, r) => sum + (r.valor || 0), 0) || 0;
    },
    enabled: !!user,
  });

  const { data: avgRating } = useQuery({
    queryKey: ['driver-avg-rating', user?.id],
    queryFn: async () => {
      const allNotas: number[] = [];
      const { data: d1 } = await supabase.from('avaliacoes').select('nota').eq('motorista_id', user!.id);
      d1?.forEach(r => allNotas.push(r.nota));
      const { data: d3 } = await supabase.from('evaluation_links').select('nota').eq('motorista_id', user!.id).eq('status', 'respondida').not('nota', 'is', null);
      d3?.forEach(r => { if (r.nota) allNotas.push(r.nota); });
      if (allNotas.length === 0) return null;
      const avg = allNotas.reduce((s, n) => s + n, 0) / allNotas.length;
      return { avg: Math.round(avg * 10) / 10, count: allNotas.length };
    },
    enabled: !!user,
  });

  const { data: avaliacoes } = useQuery({
    queryKey: ['driver-avaliacoes-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('avaliacoes').select('id, nota, comentario, created_at, tipo').eq('motorista_id', user!.id).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: avaliacoesLinks } = useQuery({
    queryKey: ['driver-avaliacoes-links', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('evaluation_links').select('id, nota, comentario, respondida_em, created_at').eq('motorista_id', user!.id).eq('status', 'respondida').not('nota', 'is', null).order('respondida_em', { ascending: false }).limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const viagensAprovadas = completedRides?.filter(r => r.status === 'aprovada' || r.status === 'finalizada' || r.status === 'em_analise').length || 0;
  const viagensPendentes = completedRides?.filter(r => r.status === 'em_analise').length || 0;
  const receitaTotal = completedRides?.filter(r => r.status === 'aprovada' || r.status === 'finalizada' || r.status === 'em_analise').reduce((sum, r) => sum + (r.valor || 0), 0) || 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const viagensHoje = completedRides?.filter(r => new Date(r.created_at) >= todayStart).length || 0;

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ridesByDay = useMemo(() => {
    const counts = Array(7).fill(0);
    completedRides?.forEach(r => { counts[new Date(r.created_at).getDay()]++; });
    return counts;
  }, [completedRides]);
  const maxDay = Math.max(...ridesByDay, 1);
  const melhorDiaIdx = ridesByDay.indexOf(Math.max(...ridesByDay));

  const topRoutes = useMemo(() => {
    const routeMap: Record<string, { origem: string; destino: string; count: number }> = {};
    completedRides?.filter(r => r.status === 'aprovada' || r.status === 'finalizada' || r.status === 'em_analise').forEach(r => {
      if (r.origem_texto && r.destino_texto) {
        const key = `${r.origem_texto}→${r.destino_texto}`;
        if (!routeMap[key]) routeMap[key] = { origem: r.origem_texto, destino: r.destino_texto, count: 0 };
        routeMap[key].count++;
      }
    });
    return Object.values(routeMap).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [completedRides]);

  const taxaConclusao = (allTimeTotalCount && allTimeTotalCount > 0) ? ((allTimeCount || 0) / allTimeTotalCount) * 100 : 0;

  const driverStats: DriverStats = {
    totalViagens: allTimeTotalCount || 0,
    viagensAprovadas: allTimeCount || 0,
    avgRating: avgRating?.avg || null,
    totalAvaliacoes: avgRating?.count || 0,
    taxaConclusao,
    viagensHoje,
    viagensSemana: weekRides || 0,
    viagensMes: monthRides || 0,
    receitaAllTime: allTimeRevenue || 0,
    melhorDia: dayNames[melhorDiaIdx],
  };

  const earnedBadges = BADGES.filter(b => b.condition(driverStats));

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <h1 className="text-[clamp(1.5rem,5vw,2rem)] font-extrabold leading-tight">
            Olá, <span className="text-gradient">{profile?.nome || 'Motorista'}</span>
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">Seu desempenho pessoal</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <Card className="mb-[4%]">
            <CardContent className="py-3 px-[4%] space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtrar Período</span>
              </div>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="border-l-[3px] border-l-accent border-t-0 border-r-0 border-b-0 bg-accent/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/15 mx-auto mb-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-accent">{viagensAprovadas}</p>
                    <p className="text-[clamp(0.65rem,2vw,0.75rem)] text-muted-foreground font-medium">Aprovadas</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-l-[3px] border-l-green-500 border-t-0 border-r-0 border-b-0 bg-green-500/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/15 mx-auto mb-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-green-400">R$ {receitaTotal.toFixed(0)}</p>
                    <p className="text-[clamp(0.65rem,2vw,0.75rem)] text-muted-foreground font-medium">Receita</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-l-[3px] border-l-yellow-500 border-t-0 border-r-0 border-b-0 bg-yellow-500/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/15 mx-auto mb-2">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-yellow-400">{avgRating?.avg || '-'}</p>
                    <p className="text-[clamp(0.65rem,2vw,0.75rem)] text-muted-foreground font-medium">Média {avgRating?.count ? `(${avgRating.count})` : ''}</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-l-[3px] border-l-blue-500 border-t-0 border-r-0 border-b-0 bg-blue-500/[0.04]">
                  <CardContent className="py-[10%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/15 mx-auto mb-2">
                      <Car className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-blue-400">{viagensHoje}</p>
                    <p className="text-[clamp(0.65rem,2vw,0.75rem)] text-muted-foreground font-medium">Hoje</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Resumo detalhado */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
              <Card className="mb-[4%]">
                <CardContent className="py-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    Resumo do Período
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total de corridas</span>
                      <span className="font-semibold">{completedRides?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Pendentes</span>
                      <span className="font-semibold text-orange-400">{viagensPendentes}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Taxa de conclusão</span>
                      <span className="font-semibold text-green-400">{taxaConclusao.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Ticket médio</span>
                      <span className="font-semibold text-green-400">R$ {viagensAprovadas > 0 ? (receitaTotal / viagensAprovadas).toFixed(0) : '0'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total geral (all-time)</span>
                      <span className="font-bold text-accent">{allTimeCount || 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Melhor dia</span>
                      <span className="font-semibold">{dayNames[melhorDiaIdx]}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Insígnias & Metas */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-400" />
                  Insígnias & Metas
                </h2>
                <Badge variant="outline" className="text-xs">{earnedBadges.length}/{BADGES.length}</Badge>
              </div>

              {BADGE_CATEGORIES.map(cat => {
                const catBadges = BADGES.filter(b => b.category === cat.key);
                const earned = catBadges.filter(b => b.condition(driverStats));
                if (catBadges.length === 0) return null;

                return (
                  <div key={cat.key} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{cat.emoji}</span>
                      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{cat.label}</h3>
                      <Badge variant="outline" className="text-[9px] ml-auto px-1.5 py-0">{earned.length}/{catBadges.length}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {catBadges.map((badge, i) => {
                        const isEarned = badge.condition(driverStats);
                        const prog = badge.progress?.(driverStats);
                        return (
                          <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.02 * i }}>
                            <Card className={`overflow-hidden transition-all ${isEarned ? 'border-border/50' : 'border-border/20 opacity-50'}`}>
                              <CardContent className="py-3 px-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                    isEarned
                                      ? `bg-gradient-to-br ${badge.color} text-white shadow-lg`
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {badge.icon}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">{badge.title}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{badge.description}</p>
                                    {!isEarned && prog && (
                                      <>
                                        <div className="mt-1.5 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min((prog.current / prog.target) * 100, 100)}%` }} />
                                        </div>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">{Math.floor(prog.current)}/{prog.target}</p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Corridas por dia + Top Rotas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      Corridas por Dia
                    </h3>
                    <div className="flex items-end gap-1.5 h-24 px-1">
                      {ridesByDay.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground">{count}</span>
                          <div
                            className={`w-full rounded-t-sm transition-all ${i === melhorDiaIdx ? 'bg-accent' : 'bg-accent/50'}`}
                            style={{ height: `${maxDay > 0 ? (count / maxDay) * 64 : 0}px`, minHeight: count > 0 ? '4px' : '0px' }}
                          />
                          <span className={`text-[9px] ${i === melhorDiaIdx ? 'text-accent font-bold' : 'text-muted-foreground'}`}>{dayNames[i]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      Suas Rotas Frequentes
                    </h3>
                    {topRoutes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem rotas neste período</p>
                    ) : (
                      <div className="space-y-2">
                        {topRoutes.map((route, i) => (
                          <div key={i} className="bg-muted/30 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                <span className="text-xs truncate">{route.origem}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{route.count}x</Badge>
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

            {/* Avaliações Recebidas */}
            {((avaliacoes && avaliacoes.length > 0) || (avaliacoesLinks && avaliacoesLinks.length > 0)) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Star className="w-4 h-4 text-accent" />
                    Avaliações Recebidas
                  </h2>
                  <Badge variant="outline" className="text-xs">{(avaliacoes?.length || 0) + (avaliacoesLinks?.length || 0)} total</Badge>
                </div>
                <div className="space-y-2 mb-[4%]">
                  {avaliacoesLinks?.map(a => (
                    <Card key={`link-${a.id}`} className="border-border/50">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-3 h-3 ${s <= (a.nota || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                              ))}
                            </div>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-accent/30 text-accent">cliente</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.respondida_em || a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
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

