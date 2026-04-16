import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/components/AdminLayout';
import { motion } from 'framer-motion';
import {
  Car, Users, Star, DollarSign, CheckCircle, Clock, AlertTriangle,
  TrendingUp, Calendar, Activity, Shield, XCircle, Trophy,
  BarChart3, Filter, Loader2,
} from 'lucide-react';

type Ride = {
  id: string; status: string; valor: number | null; valor_estimado: number | null;
  created_at: string; concluida_at: string | null;
  origem_texto: string; destino_texto: string; motorista_id: string | null; cliente_id: string;
};
type UserRecord = {
  id: string; nome: string; telefone: string; tipo: string; status: string;
  roles?: string[] | null; avatar_url?: string | null;
};

// Helper: get week boundaries
function getWeekRange(weeksAgo: number) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
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

const AdminDashboardPage: React.FC = () => {
  const [periodo, setPeriodo] = useState('esta_semana');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // ── Fetch rides ──
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

  // ── Fetch users ──
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

    if (periodo === 'esta_semana') {
      const r = getWeekRange(0);
      cutoffStart = r.start; cutoffEnd = r.end;
    } else if (periodo === 'semana_passada') {
      const r = getWeekRange(1);
      cutoffStart = r.start; cutoffEnd = r.end;
    } else if (periodo === 'este_mes') {
      const now = new Date();
      cutoffStart = new Date(now.getFullYear(), now.getMonth(), 1);
      cutoffEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (periodo === 'custom' && customStart && customEnd) {
      cutoffStart = new Date(customStart);
      cutoffEnd = new Date(customEnd + 'T23:59:59');
    }

    if (!cutoffStart) return rides;
    return rides.filter(r => {
      const d = new Date(r.created_at);
      return d >= cutoffStart! && (!cutoffEnd || d < cutoffEnd);
    });
  }, [rides, periodo, customStart, customEnd]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = filteredRides.length;
    const aprovadas = filteredRides.filter(r => r.status === 'aprovada');
    const emAnalise = filteredRides.filter(r => r.status === 'em_analise');
    const recusadas = filteredRides.filter(r => r.status === 'recusada');
    const naoRealizadas = filteredRides.filter(r => r.status === 'nao_realizada');
    const receitaTotal = aprovadas.reduce((sum, r) => sum + (r.valor || 0), 0);
    const receitaEstimada = filteredRides.reduce((sum, r) => sum + (r.valor_estimado || r.valor || 0), 0);

    // Admin vs common user rides
    const adminIds = new Set(users.filter(u => u.roles?.includes('admin') || u.tipo === 'admin').map(u => u.id));
    const corridasAdmin = filteredRides.filter(r => adminIds.has(r.motorista_id || ''));
    const corridasComum = filteredRides.filter(r => r.motorista_id && !adminIds.has(r.motorista_id));

    return {
      total, aprovadas: aprovadas.length, emAnalise: emAnalise.length,
      recusadas: recusadas.length, naoRealizadas: naoRealizadas.length,
      receitaTotal, receitaEstimada,
      corridasAdmin: corridasAdmin.length, corridasComum: corridasComum.length,
      receitaAdmin: corridasAdmin.filter(r => r.status === 'aprovada').reduce((s, r) => s + (r.valor || 0), 0),
      receitaComum: corridasComum.filter(r => r.status === 'aprovada').reduce((s, r) => s + (r.valor || 0), 0),
    };
  }, [filteredRides, users]);

  // ── Driver ranking ──
  const driverRanking = useMemo(() => {
    const motoristasMap = new Map<string, { viagens: number; receita: number; aprovadas: number }>();
    filteredRides.forEach(r => {
      if (!r.motorista_id) return;
      const existing = motoristasMap.get(r.motorista_id) || { viagens: 0, receita: 0, aprovadas: 0 };
      existing.viagens++;
      if (r.status === 'aprovada') { existing.aprovadas++; existing.receita += (r.valor || 0); }
      motoristasMap.set(r.motorista_id, existing);
    });

    return Array.from(motoristasMap.entries())
      .map(([id, data]) => {
        const user = users.find(u => u.id === id);
        return { id, nome: user?.nome || 'Desconhecido', avatar_url: user?.avatar_url, ...data };
      })
      .sort((a, b) => b.viagens - a.viagens);
  }, [filteredRides, users]);

  // ── Top routes ──
  const topRoutes = useMemo(() => {
    const routeMap = new Map<string, { count: number; receita: number }>();
    filteredRides.filter(r => r.status === 'aprovada').forEach(r => {
      const key = `${r.origem_texto} → ${r.destino_texto}`;
      const existing = routeMap.get(key) || { count: 0, receita: 0 };
      existing.count++;
      existing.receita += (r.valor || 0);
      routeMap.set(key, existing);
    });
    return Array.from(routeMap.entries())
      .map(([rota, data]) => ({ rota, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredRides]);

  const isLoading = loadingRides || loadingUsers;

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" /> Dashboard
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Desempenho geral da plataforma</p>
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
        <div className="space-y-6">
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Total Corridas', value: stats.total, icon: <Car className="w-4 h-4" />, color: 'text-white', bg: 'bg-white/[0.06]' },
              { label: 'Aprovadas', value: stats.aprovadas, icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Em Análise', value: stats.emAnalise, icon: <Clock className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
              { label: 'Receita Total', value: `R$ ${stats.receitaTotal.toFixed(2)}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/10' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
                  </div>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Admin vs Motorista Comparação ── */}
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-purple-400" /> Admin vs Motoristas Comuns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-purple-400">Administradores</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-2xl font-bold text-purple-400">{stats.corridasAdmin}</p>
                      <p className="text-[10px] text-muted-foreground">Corridas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-400">R$ {stats.receitaAdmin.toFixed(0)}</p>
                      <p className="text-[10px] text-muted-foreground">Receita</p>
                    </div>
                  </div>
                </div>
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-accent" />
                    <span className="text-sm font-semibold text-accent">Motoristas Comuns</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-2xl font-bold text-accent">{stats.corridasComum}</p>
                      <p className="text-[10px] text-muted-foreground">Corridas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent">R$ {stats.receitaComum.toFixed(0)}</p>
                      <p className="text-[10px] text-muted-foreground">Receita</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Driver Ranking ── */}
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" /> Ranking de Motoristas</h3>
              {driverRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma viagem no período selecionado</p>
              ) : (
                <div className="space-y-2">
                  {driverRanking.map((driver, i) => (
                    <motion.div key={driver.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                      <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-gray-400/10 border border-gray-400/20' : i === 2 ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-muted/30'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold ${i === 0 ? 'bg-yellow-500/30 text-yellow-400' : i === 1 ? 'bg-gray-400/30 text-gray-300' : i === 2 ? 'bg-orange-500/30 text-orange-400' : 'bg-white/10 text-white/50'}`}>
                          {i + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center shrink-0">
                          {driver.avatar_url ? <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-accent" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{driver.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{driver.aprovadas} aprovadas de {driver.viagens}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-accent">{driver.viagens}</p>
                          <p className="text-[10px] text-muted-foreground">corrida{driver.viagens !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Top Routes ── */}
          {topRoutes.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Rotas Mais Populares</h3>
                <div className="space-y-2">
                  {topRoutes.map((route, i) => (
                    <div key={route.rota} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                      <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{route.rota}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">{route.count}x</p>
                        <p className="text-[10px] text-green-400">R$ {route.receita.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Users Summary ── */}
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Resumo de Usuários</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center bg-muted/30 rounded-lg p-3">
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="text-center bg-green-500/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-400">{users.filter(u => u.status === 'ativo').length}</p>
                  <p className="text-[10px] text-muted-foreground">Ativos</p>
                </div>
                <div className="text-center bg-purple-500/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-purple-400">{users.filter(u => u.roles?.includes('admin') || u.tipo === 'admin').length}</p>
                  <p className="text-[10px] text-muted-foreground">Admins</p>
                </div>
                <div className="text-center bg-red-500/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-400">{users.filter(u => u.status === 'banido').length}</p>
                  <p className="text-[10px] text-muted-foreground">Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboardPage;
