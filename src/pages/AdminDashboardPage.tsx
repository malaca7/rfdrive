import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/AdminLayout';
import { motion } from 'framer-motion';
import {
  Car, Users, DollarSign, CheckCircle,
  TrendingUp, TrendingDown, Calendar, Activity, Shield, Trophy,
  BarChart3, Loader2, Target, Zap, Clock, MapPin, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';

type Ride = {
  id: string; status: string; valor: number | null; valor_estimado: number | null;
  created_at: string; concluida_at: string | null;
  origem_texto: string; destino_texto: string; motorista_id: string | null; cliente_id: string;
};
type UserRecord = {
  id: string; nome: string; telefone: string; tipo: string; status: string;
  roles?: string[] | null; avatar_url?: string | null;
};

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getWeekRange(weeksAgo: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const start = new Date(monday);
  start.setDate(start.getDate() - weeksAgo * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

const PERIOD_OPTIONS = [
  { value: 'esta_semana', label: 'Esta Semana' },
  { value: 'semana_passada', label: 'Semana Passada' },
  { value: 'este_mes', label: 'Este Mês' },
  { value: 'todos', label: 'Todo Período' },
  { value: 'custom', label: 'Personalizado' },
];

// ── Bar component ──
const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="w-full h-2.5 bg-muted/50 rounded-full overflow-hidden">
    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
  </div>
);

const AdminDashboardPage: React.FC = () => {
  const [periodo, setPeriodo] = useState('esta_semana');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { data: rides = [], isLoading: loadingRides } = useQuery({
    queryKey: ['admin-rides-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('corridas').select('id, status, valor, valor_estimado, created_at, concluida_at, origem_texto, destino_texto, motorista_id, cliente_id').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Ride[];
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, nome, telefone, tipo, status, roles, avatar_url');
      if (error) throw error;
      return (data || []) as UserRecord[];
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  // ── Period filter ──
  const filteredRides = useMemo(() => {
    let cutoffStart: Date | null = null;
    let cutoffEnd: Date | null = null;
    if (periodo === 'esta_semana') { const r = getWeekRange(0); cutoffStart = r.start; cutoffEnd = r.end; }
    else if (periodo === 'semana_passada') { const r = getWeekRange(1); cutoffStart = r.start; cutoffEnd = r.end; }
    else if (periodo === 'este_mes') { const now = new Date(); cutoffStart = new Date(now.getFullYear(), now.getMonth(), 1); cutoffEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
    else if (periodo === 'custom' && customStart && customEnd) { cutoffStart = new Date(customStart); cutoffEnd = new Date(customEnd + 'T23:59:59'); }
    if (!cutoffStart) return rides;
    return rides.filter(r => { const d = new Date(r.concluida_at || r.created_at); return d >= cutoffStart! && (!cutoffEnd || d < cutoffEnd); });
  }, [rides, periodo, customStart, customEnd]);

  // ── Previous period rides for comparison ──
  const previousPeriodRides = useMemo(() => {
    if (periodo === 'todos' || periodo === 'custom') return [];
    let cutoffStart: Date | null = null;
    let cutoffEnd: Date | null = null;
    if (periodo === 'esta_semana') { const r = getWeekRange(1); cutoffStart = r.start; cutoffEnd = r.end; }
    else if (periodo === 'semana_passada') { const r = getWeekRange(2); cutoffStart = r.start; cutoffEnd = r.end; }
    else if (periodo === 'este_mes') { const now = new Date(); cutoffStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); cutoffEnd = new Date(now.getFullYear(), now.getMonth(), 1); }
    if (!cutoffStart) return [];
    return rides.filter(r => { const d = new Date(r.concluida_at || r.created_at); return d >= cutoffStart! && (!cutoffEnd || d < cutoffEnd); });
  }, [rides, periodo]);

  // ── Motoristas list ──
  const motoristas = useMemo(() => users.filter(u => (u.roles?.includes('motorista') || u.tipo === 'motorista') && u.status === 'ativo'), [users]);
  const adminIds = useMemo(() => new Set(users.filter(u => u.roles?.includes('admin') || u.tipo === 'admin').map(u => u.id)), [users]);

  // ── Core stats ──
  const stats = useMemo(() => {
    const aprovadas = filteredRides.filter(r => r.status === 'aprovada');
    const prevAprovadas = previousPeriodRides.filter(r => r.status === 'aprovada');
    const totalRides = filteredRides.length;
    const receitaTotal = aprovadas.reduce((sum, r) => sum + (r.valor || 0), 0);
    const prevReceita = prevAprovadas.reduce((sum, r) => sum + (r.valor || 0), 0);
    const ticketMedio = aprovadas.length > 0 ? receitaTotal / aprovadas.length : 0;
    const prevTicket = prevAprovadas.length > 0 ? prevReceita / prevAprovadas.length : 0;

    const corridasAdmin = aprovadas.filter(r => adminIds.has(r.motorista_id || ''));
    const corridasComum = aprovadas.filter(r => r.motorista_id && !adminIds.has(r.motorista_id));

    // Change percentages
    const receitaChange = prevReceita > 0 ? ((receitaTotal - prevReceita) / prevReceita) * 100 : 0;
    const viagensChange = prevAprovadas.length > 0 ? ((aprovadas.length - prevAprovadas.length) / prevAprovadas.length) * 100 : 0;
    const ticketChange = prevTicket > 0 ? ((ticketMedio - prevTicket) / prevTicket) * 100 : 0;

    return {
      totalRides, aprovadas: aprovadas.length, receitaTotal, ticketMedio,
      receitaChange, viagensChange, ticketChange,
      corridasAdmin: corridasAdmin.length, corridasComum: corridasComum.length,
      receitaAdmin: corridasAdmin.reduce((s, r) => s + (r.valor || 0), 0),
      receitaComum: corridasComum.reduce((s, r) => s + (r.valor || 0), 0),
      emAnalise: filteredRides.filter(r => r.status === 'em_analise').length,
      prevReceita, prevAprovadas: prevAprovadas.length,
    };
  }, [filteredRides, previousPeriodRides, adminIds]);

  // ── Revenue by day of week (all time for patterns) ──
  const dayStats = useMemo(() => {
    const aprovadas = rides.filter(r => r.status === 'aprovada');
    const byDay = Array(7).fill(null).map(() => ({ viagens: 0, receita: 0 }));
    aprovadas.forEach(r => {
      const day = new Date(r.concluida_at || r.created_at).getDay();
      byDay[day].viagens++;
      byDay[day].receita += (r.valor || 0);
    });
    const maxViagens = Math.max(...byDay.map(d => d.viagens), 1);
    const maxReceita = Math.max(...byDay.map(d => d.receita), 1);
    const bestDayIdx = byDay.reduce((best, d, i) => d.receita > byDay[best].receita ? i : best, 0);
    const worstDayIdx = byDay.reduce((worst, d, i) => (d.viagens > 0 && d.receita < byDay[worst].receita) || byDay[worst].viagens === 0 ? i : worst, 0);
    return { byDay, maxViagens, maxReceita, bestDayIdx, worstDayIdx };
  }, [rides]);

  // ── Viagens por dia da semana no período filtrado ──
  const filteredDayStats = useMemo(() => {
    const aprovadas = filteredRides.filter(r => r.status === 'aprovada');
    const byDay = Array(7).fill(null).map(() => ({ viagens: 0, receita: 0 }));
    aprovadas.forEach(r => {
      const day = new Date(r.concluida_at || r.created_at).getDay();
      byDay[day].viagens++;
      byDay[day].receita += (r.valor || 0);
    });
    const maxViagens = Math.max(...byDay.map(d => d.viagens), 1);
    return { byDay, maxViagens };
  }, [filteredRides]);

  // ── Driver ranking ──
  const driverRanking = useMemo(() => {
    const aprovadas = filteredRides.filter(r => r.status === 'aprovada');
    const map = new Map<string, { viagens: number; receita: number }>();
    aprovadas.forEach(r => {
      if (!r.motorista_id) return;
      const ex = map.get(r.motorista_id) || { viagens: 0, receita: 0 };
      ex.viagens++; ex.receita += (r.valor || 0);
      map.set(r.motorista_id, ex);
    });
    return Array.from(map.entries())
      .map(([id, data]) => {
        const user = users.find(u => u.id === id);
        return { id, nome: user?.nome || 'Desconhecido', avatar_url: user?.avatar_url, isAdmin: adminIds.has(id), ...data };
      })
      .sort((a, b) => b.receita - a.receita);
  }, [filteredRides, users, adminIds]);

  // ── Top routes ──
  const topRoutes = useMemo(() => {
    const map = new Map<string, { origem: string; destino: string; count: number; receita: number }>();
    filteredRides.filter(r => r.status === 'aprovada').forEach(r => {
      const key = `${r.origem_texto}|${r.destino_texto}`;
      const ex = map.get(key) || { origem: r.origem_texto, destino: r.destino_texto, count: 0, receita: 0 };
      ex.count++; ex.receita += (r.valor || 0);
      map.set(key, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [filteredRides]);

  // ── Revenue potential (motoristas ativos que não fizeram viagens no período) ──
  const potentialStats = useMemo(() => {
    const motoristasComViagem = new Set(filteredRides.filter(r => r.status === 'aprovada').map(r => r.motorista_id).filter(Boolean));
    const motoristasOciosos = motoristas.filter(m => !motoristasComViagem.has(m.id));
    const mediaReceitaPorMotorista = driverRanking.length > 0
      ? driverRanking.reduce((s, d) => s + d.receita, 0) / driverRanking.length : 0;
    const receitaPotencial = motoristasOciosos.length * mediaReceitaPorMotorista;
    return { motoristasOciosos: motoristasOciosos.length, receitaPotencial, mediaReceitaPorMotorista };
  }, [filteredRides, motoristas, driverRanking]);

  // ── Daily revenue trend (last 14 days) ──
  const dailyTrend = useMemo(() => {
    const days: { label: string; receita: number; viagens: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const dayRides = rides.filter(r => {
        if (r.status !== 'aprovada') return false;
        const rd = new Date(r.concluida_at || r.created_at);
        return rd >= dayStart && rd <= dayEnd;
      });
      days.push({ label: dStr, receita: dayRides.reduce((s, r) => s + (r.valor || 0), 0), viagens: dayRides.length });
    }
    return days;
  }, [rides]);

  const maxDailyReceita = Math.max(...dailyTrend.map(d => d.receita), 1);

  // ── Busiest hours ──
  const hourStats = useMemo(() => {
    const aprovadas = rides.filter(r => r.status === 'aprovada');
    const byHour = Array(24).fill(0);
    aprovadas.forEach(r => { byHour[new Date(r.concluida_at || r.created_at).getHours()]++; });
    const peakHour = byHour.reduce((best, v, i) => v > byHour[best] ? i : best, 0);
    return { byHour, peakHour };
  }, [rides]);

  const isLoading = loadingRides || loadingUsers;

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const positive = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(value).toFixed(0)}%
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" /> Dashboard Financeiro
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Análise completa de faturamento, motoristas e operação</p>
      </div>

      {/* Period filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-full sm:w-52">
            <Calendar className="w-4 h-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {periodo === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-4">

          {/* ═══ KPI CARDS ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="border-green-500/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <ChangeIndicator value={stats.receitaChange} />
                </div>
                <p className="text-xl font-extrabold text-green-400">R$ {stats.receitaTotal.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Faturamento</p>
              </CardContent>
            </Card>
            <Card className="border-accent/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <ChangeIndicator value={stats.viagensChange} />
                </div>
                <p className="text-xl font-extrabold text-accent">{stats.aprovadas}</p>
                <p className="text-[10px] text-muted-foreground">Viagens Aprovadas</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <Target className="w-4 h-4 text-blue-400" />
                  <ChangeIndicator value={stats.ticketChange} />
                </div>
                <p className="text-xl font-extrabold text-blue-400">R$ {stats.ticketMedio.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-500/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <Activity className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-xl font-extrabold text-yellow-400">{stats.emAnalise}</p>
                <p className="text-[10px] text-muted-foreground">Em Análise</p>
              </CardContent>
            </Card>
          </div>

          {/* ═══ FATURAMENTO DETALHADO + POTENCIAL ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Faturamento real */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" /> Faturamento Detalhado
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-muted-foreground">Admin</span>
                    </div>
                    <p className="text-lg font-bold text-purple-400">R$ {stats.receitaAdmin.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground">{stats.corridasAdmin} viagen{stats.corridasAdmin !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Car className="w-3 h-3 text-accent" />
                      <span className="text-[10px] text-muted-foreground">Motoristas</span>
                    </div>
                    <p className="text-lg font-bold text-accent">R$ {stats.receitaComum.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground">{stats.corridasComum} viagen{stats.corridasComum !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {stats.prevReceita > 0 && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium">Comparação com período anterior</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Anterior</span>
                      <span>R$ {stats.prevReceita.toFixed(0)} ({stats.prevAprovadas} viagens)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Diferença</span>
                      <span className={stats.receitaTotal >= stats.prevReceita ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {stats.receitaTotal >= stats.prevReceita ? '+' : ''}R$ {(stats.receitaTotal - stats.prevReceita).toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Potencial de faturamento */}
            <Card className="border-emerald-500/20">
              <CardContent className="py-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" /> Potencial de Faturamento
                </h3>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Quanto o grupo poderia faturar a mais</p>
                  <p className="text-2xl font-extrabold text-emerald-400">+R$ {potentialStats.receitaPotencial.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {potentialStats.motoristasOciosos} motorista{potentialStats.motoristasOciosos !== 1 ? 's' : ''} sem viagens no período
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Motoristas ativos</span>
                    <span className="font-semibold">{motoristas.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Com viagens no período</span>
                    <span className="font-semibold text-green-400">{driverRanking.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sem viagens no período</span>
                    <span className="font-semibold text-red-400">{potentialStats.motoristasOciosos}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Média por motorista ativo</span>
                    <span className="font-semibold text-accent">R$ {potentialStats.mediaReceitaPorMotorista.toFixed(0)}</span>
                  </div>
                </div>
                {potentialStats.motoristasOciosos > 0 && stats.receitaTotal > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                    <p className="text-[10px] text-yellow-400 font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Faturamento total possível: R$ {(stats.receitaTotal + potentialStats.receitaPotencial).toFixed(0)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ TENDÊNCIA DIÁRIA (últimos 14 dias) ═══ */}
          <Card>
            <CardContent className="py-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> Faturamento Diário (últimos 14 dias)
              </h3>
              <div className="flex items-end gap-1 h-28 px-1">
                {dailyTrend.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-background border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg z-10">
                      <p className="font-semibold">R$ {day.receita.toFixed(0)}</p>
                      <p className="text-muted-foreground">{day.viagens} viagem{day.viagens !== 1 ? 's' : ''}</p>
                    </div>
                    <div
                      className="w-full bg-accent/70 hover:bg-accent rounded-t transition-all cursor-pointer"
                      style={{ height: `${(day.receita / maxDailyReceita) * 80}px`, minHeight: day.receita > 0 ? '4px' : '0px' }}
                    />
                    <span className="text-[7px] text-muted-foreground leading-none">{day.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span>Média: R$ {(dailyTrend.reduce((s, d) => s + d.receita, 0) / 14).toFixed(0)}/dia</span>
                <span>Total 14d: R$ {dailyTrend.reduce((s, d) => s + d.receita, 0).toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* ═══ DIAS DA SEMANA (padrões) ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Viagens por dia */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" /> Viagens por Dia da Semana
                </h3>
                <p className="text-[10px] text-muted-foreground -mt-1">Período selecionado</p>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                    const d = filteredDayStats.byDay[dayIdx];
                    const isBest = dayIdx === dayStats.bestDayIdx;
                    return (
                      <div key={dayIdx} className="flex items-center gap-2">
                        <span className={`text-xs w-8 font-medium ${isBest ? 'text-accent' : 'text-muted-foreground'}`}>{DAY_NAMES[dayIdx]}</span>
                        <div className="flex-1"><Bar value={d.viagens} max={filteredDayStats.maxViagens} color={isBest ? 'bg-accent' : 'bg-accent/50'} /></div>
                        <span className="text-xs font-bold w-6 text-right">{d.viagens}</span>
                        <span className="text-[10px] text-green-400 font-medium w-16 text-right">R$ {d.receita.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Insights dos dias */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" /> Insights da Semana
                </h3>
                <p className="text-[10px] text-muted-foreground -mt-1">Baseado em todo o histórico</p>
                <div className="space-y-2.5">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-semibold text-green-400">Dia mais lucrativo</span>
                    </div>
                    <p className="text-sm font-bold">{DAY_NAMES_FULL[dayStats.bestDayIdx]}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {dayStats.byDay[dayStats.bestDayIdx].viagens} viagens · R$ {dayStats.byDay[dayStats.bestDayIdx].receita.toFixed(0)} total
                    </p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-semibold text-red-400">Dia mais fraco</span>
                    </div>
                    <p className="text-sm font-bold">{DAY_NAMES_FULL[dayStats.worstDayIdx]}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {dayStats.byDay[dayStats.worstDayIdx].viagens} viagens · R$ {dayStats.byDay[dayStats.worstDayIdx].receita.toFixed(0)} total
                    </p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-400">Horário de pico</span>
                    </div>
                    <p className="text-sm font-bold">{String(hourStats.peakHour).padStart(2, '0')}:00 - {String(hourStats.peakHour + 1).padStart(2, '0')}:00</p>
                    <p className="text-[10px] text-muted-foreground">{hourStats.byHour[hourStats.peakHour]} viagens nesse horário</p>
                  </div>
                  {dayStats.byDay[dayStats.bestDayIdx].viagens > 0 && (
                    <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-semibold text-accent">Ticket médio por dia</span>
                      </div>
                      <p className="text-sm font-bold">
                        R$ {(dayStats.byDay[dayStats.bestDayIdx].receita / dayStats.byDay[dayStats.bestDayIdx].viagens).toFixed(0)}/viagem em {DAY_NAMES_FULL[dayStats.bestDayIdx]}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ RANKING DE MOTORISTAS (receita) ═══ */}
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Ranking de Motoristas por Faturamento
                </h3>
                <Badge variant="outline" className="text-[10px]">{driverRanking.length} motoristas</Badge>
              </div>
              {driverRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma viagem no período</p>
              ) : (
                <div className="space-y-2">
                  {driverRanking.map((driver, i) => {
                    const maxReceita = driverRanking[0]?.receita || 1;
                    return (
                      <motion.div key={driver.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-gray-400/10 border border-gray-400/20' : i === 2 ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-muted/30'}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${i === 0 ? 'bg-yellow-500/30 text-yellow-400' : i === 1 ? 'bg-gray-400/30 text-gray-300' : i === 2 ? 'bg-orange-500/30 text-orange-400' : 'bg-white/10 text-white/50'}`}>
                            {i + 1}
                          </div>
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center shrink-0">
                            {driver.avatar_url ? <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" /> : <img src={getAnimalAvatarUrl(driver.id)} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{driver.nome}</p>
                              {driver.isAdmin && <Badge variant="outline" className="text-[8px] px-1 py-0 text-purple-400 border-purple-500/30">Admin</Badge>}
                            </div>
                            <div className="w-full mt-1"><Bar value={driver.receita} max={maxReceita} color={i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : 'bg-accent/60'} /></div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-green-400">R$ {driver.receita.toFixed(0)}</p>
                            <p className="text-[10px] text-muted-foreground">{driver.viagens} viagen{driver.viagens !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {driverRanking.length > 0 && (
                <>
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-xs font-bold text-green-400">R$ {driverRanking.reduce((s, d) => s + d.receita, 0).toFixed(0)}</p>
                      <p className="text-[9px] text-muted-foreground">Total grupo</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-xs font-bold text-accent">R$ {(driverRanking.reduce((s, d) => s + d.receita, 0) / driverRanking.length).toFixed(0)}</p>
                      <p className="text-[9px] text-muted-foreground">Média/motorista</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-xs font-bold">{driverRanking.reduce((s, d) => s + d.viagens, 0)}</p>
                      <p className="text-[9px] text-muted-foreground">Total viagens</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ═══ ROTAS + EQUIPE ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Top Routes */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400" /> Rotas Mais Lucrativas
                </h3>
                {topRoutes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma rota no período</p>
                ) : (
                  <div className="space-y-2">
                    {topRoutes.map((route, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                <span className="text-xs truncate">{route.origem}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <span className="text-[10px] text-muted-foreground truncate">{route.destino}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-xs font-bold text-green-400">R$ {route.receita.toFixed(0)}</p>
                            <p className="text-[10px] text-muted-foreground">{route.count}x</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo da equipe */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" /> Resumo da Equipe
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-accent/10 rounded-lg p-3 text-center">
                    <Car className="w-4 h-4 text-accent mx-auto mb-1" />
                    <p className="text-lg font-bold">{motoristas.length}</p>
                    <p className="text-[10px] text-muted-foreground">Motoristas Ativos</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <Activity className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-400">{driverRanking.length}</p>
                    <p className="text-[10px] text-muted-foreground">Produzindo</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total usuários</span>
                    <span className="font-semibold">{users.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Admins</span>
                    <span className="font-semibold text-purple-400">{adminIds.size}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Taxa de ocupação</span>
                    <span className="font-semibold text-accent">
                      {motoristas.length > 0 ? ((driverRanking.length / motoristas.length) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Viagens/motorista ativo</span>
                    <span className="font-semibold">
                      {driverRanking.length > 0 ? (driverRanking.reduce((s, d) => s + d.viagens, 0) / driverRanking.length).toFixed(1) : '0'}
                    </span>
                  </div>
                </div>
                {potentialStats.motoristasOciosos > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <p className="text-[10px] text-red-400 font-medium">
                      ⚠️ {potentialStats.motoristasOciosos} motorista{potentialStats.motoristasOciosos !== 1 ? 's' : ''} ociosos — potencial de +R$ {potentialStats.receitaPotencial.toFixed(0)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboardPage;
