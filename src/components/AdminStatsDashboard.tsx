import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Car, Users, Star, DollarSign, CheckCircle, Clock, AlertTriangle,
  TrendingUp, MapPin, Calendar, Activity, Shield, XCircle, Eye,
  FileText, UserCheck, Ban, Filter, RotateCcw,
} from 'lucide-react';

type Ride = {
  id: string;
  status: string;
  valor: number | null;
  valor_estimado: number | null;
  created_at: string;
  concluida_at: string | null;
  origem_texto: string;
  destino_texto: string;
  motorista_id: string | null;
  cliente_id: string;
  cliente?: { nome: string; telefone: string; tipo: string } | null;
  motorista?: { nome: string; telefone: string } | null;
  avaliacao_cliente?: { nota: number; comentario: string | null } | null;
  avaliacao_motorista?: { nota: number; comentario: string | null } | null;
};

type UserRecord = {
  id: string;
  nome: string;
  telefone: string;
  tipo: string;
  status: string;
  ativo: boolean;
  created_at: string;
  veiculo_marca?: string | null;
  veiculo_modelo?: string | null;
  veiculo_cor?: string | null;
  veiculo_placa?: string | null;
};

interface AdminStatsProps {
  rides: Ride[];
  users: UserRecord[];
}

const AdminStatsDashboard: React.FC<AdminStatsProps> = ({ rides, users }) => {
  const [periodo, setPeriodo] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Filtered rides based on selected filters
  const filteredRides = useMemo(() => {
    let result = rides;

    // Period filter
    if (periodo !== 'todos') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let cutoff: Date;
      switch (periodo) {
        case 'hoje': cutoff = today; break;
        case '7dias': cutoff = new Date(today.getTime() - 7 * 86400000); break;
        case '30dias': cutoff = new Date(today.getTime() - 30 * 86400000); break;
        default: cutoff = new Date(0);
      }
      result = result.filter(r => new Date(r.created_at) >= cutoff);
    }

    // Status filter
    if (statusFilter !== 'todos') {
      result = result.filter(r => r.status === statusFilter);
    }

    return result;
  }, [rides, periodo, statusFilter]);

  const hasFilters = periodo !== 'todos' || statusFilter !== 'todos';

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);

    // Rides by status
    const byStatus = {
      em_analise: 0, aprovada: 0, nao_realizada: 0,
    };
    filteredRides.forEach(r => { if (r.status in byStatus) byStatus[r.status as keyof typeof byStatus]++; });

    // Time-based
    const ridesToday = filteredRides.filter(r => new Date(r.created_at) >= today);
    const ridesWeek = filteredRides.filter(r => new Date(r.created_at) >= weekAgo);
    const ridesMonth = filteredRides.filter(r => new Date(r.created_at) >= monthAgo);

    // Revenue (somente aprovadas)
    const completedRides = filteredRides.filter(r => r.status === 'aprovada');
    const totalRevenue = completedRides.reduce((sum, r) => sum + (r.valor || r.valor_estimado || 0), 0);
    const revenueToday = ridesToday.filter(r => r.status === 'aprovada')
      .reduce((sum, r) => sum + (r.valor || r.valor_estimado || 0), 0);
    const revenueWeek = ridesWeek.filter(r => r.status === 'aprovada')
      .reduce((sum, r) => sum + (r.valor || r.valor_estimado || 0), 0);

    // Drivers
    const motoristas = users.filter(u => u.tipo === 'motorista');
    const clientes = users.filter(u => u.tipo === 'cliente');
    const banidos = users.filter(u => u.status === 'banido');

    // Driver stats
    const driverRideCount: Record<string, { nome: string; count: number; revenue: number; ratings: number[]; }> = {};
    filteredRides.forEach(r => {
      if (r.motorista_id && r.motorista) {
        if (!driverRideCount[r.motorista_id]) {
          driverRideCount[r.motorista_id] = { nome: r.motorista.nome, count: 0, revenue: 0, ratings: [] };
        }
        driverRideCount[r.motorista_id].count++;
        if (r.valor) driverRideCount[r.motorista_id].revenue += r.valor;
        if (r.avaliacao_cliente?.nota) driverRideCount[r.motorista_id].ratings.push(r.avaliacao_cliente.nota);
      }
    });
    const topDrivers = Object.entries(driverRideCount)
      .map(([id, d]) => ({
        id,
        nome: d.nome,
        count: d.count,
        revenue: d.revenue,
        avgRating: d.ratings.length > 0 ? d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length : null,
        totalRatings: d.ratings.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top routes
    const routeCount: Record<string, { origem: string; destino: string; count: number }> = {};
    filteredRides.forEach(r => {
      const key = `${r.origem_texto}→${r.destino_texto}`;
      if (!routeCount[key]) routeCount[key] = { origem: r.origem_texto, destino: r.destino_texto, count: 0 };
      routeCount[key].count++;
    });
    const topRoutes = Object.values(routeCount).sort((a, b) => b.count - a.count).slice(0, 5);

    // Avg rating
    const allClientRatings = filteredRides.filter(r => r.avaliacao_cliente).map(r => r.avaliacao_cliente!.nota);
    const avgClientRating = allClientRatings.length > 0
      ? allClientRatings.reduce((a, b) => a + b, 0) / allClientRatings.length : null;

    // Rides by day of week
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const ridesByDay = Array(7).fill(0);
    ridesMonth.forEach(r => { ridesByDay[new Date(r.created_at).getDay()]++; });

    return {
      total: filteredRides.length,
      byStatus,
      ridesToday: ridesToday.length,
      ridesWeek: ridesWeek.length,
      ridesMonth: ridesMonth.length,
      totalRevenue,
      revenueToday,
      revenueWeek,
      motoristas: motoristas.length,
      clientes: clientes.length,
      banidos: banidos.length,
      totalUsers: users.length,
      topDrivers,
      topRoutes,
      avgClientRating,
      totalRatings: allClientRatings.length,
      ridesByDay,
      dayNames,
      motoristasAtivos: motoristas.filter(m => m.ativo && m.status !== 'banido').length,
      completedCount: completedRides.length,
      cancelledCount: byStatus.nao_realizada,
    };
  }, [filteredRides, users]);

  // Simple bar for visual representation
  const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );

  const maxDay = Math.max(...stats.ridesByDay, 1);

  return (
    <div className="space-y-[3%]">
      {/* ── Filtros ── */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Filter className="w-4 h-4" />
              Filtros
            </div>

            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo Período</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="30dias">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="nao_realizada">Não Realizada</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <button
                onClick={() => { setPeriodo('todos'); setStatusFilter('todos'); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar
              </button>
            )}

            {hasFilters && (
              <Badge variant="outline" className="ml-auto text-[10px] px-2 py-0.5">
                {filteredRides.length} de {rides.length} corridas
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[2%]">
        <Card className="border-green-500/20">
          <CardContent className="py-[10%] text-center">
            <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-[clamp(1.1rem,3.5vw,1.6rem)] font-extrabold text-green-400">
              R$ {stats.totalRevenue.toFixed(0)}
            </p>
            <p className="text-[clamp(0.55rem,1.6vw,0.7rem)] text-muted-foreground">Receita Total</p>
          </CardContent>
        </Card>
        <Card className="border-accent/20">
          <CardContent className="py-[10%] text-center">
            <Activity className="w-5 h-5 text-accent mx-auto mb-1" />
            <p className="text-[clamp(1.1rem,3.5vw,1.6rem)] font-extrabold text-accent">
              {stats.ridesToday}
            </p>
            <p className="text-[clamp(0.55rem,1.6vw,0.7rem)] text-muted-foreground">Corridas Hoje</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="py-[10%] text-center">
            <TrendingUp className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-[clamp(1.1rem,3.5vw,1.6rem)] font-extrabold text-blue-400">
              {stats.ridesWeek}
            </p>
            <p className="text-[clamp(0.55rem,1.6vw,0.7rem)] text-muted-foreground">Últimos 7 Dias</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="py-[10%] text-center">
            <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-[clamp(1.1rem,3.5vw,1.6rem)] font-extrabold text-yellow-400">
              {stats.avgClientRating ? stats.avgClientRating.toFixed(1) : '—'}
            </p>
            <p className="text-[clamp(0.55rem,1.6vw,0.7rem)] text-muted-foreground">
              Nota Média {stats.totalRatings > 0 && `(${stats.totalRatings})`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Receita detalhada + Status breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[2%]">
        {/* Revenue breakdown */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              Receita
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="text-sm font-bold text-green-400">R$ {stats.revenueToday.toFixed(0)}</p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">7 dias</p>
                <p className="text-sm font-bold text-green-400">R$ {stats.revenueWeek.toFixed(0)}</p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-green-400">R$ {stats.totalRevenue.toFixed(0)}</p>
              </div>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Corridas concluídas</span>
                <span className="font-semibold">{stats.completedCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Ticket médio</span>
                <span className="font-semibold text-green-400">
                  R$ {stats.completedCount > 0 ? (stats.totalRevenue / stats.completedCount).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
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
                  <span className="text-xs w-28 truncate">{s.label}</span>
                  <div className="flex-1">
                    <Bar value={stats.byStatus[s.key]} max={stats.total} color={s.bg} />
                  </div>
                  <span className={`text-xs font-bold w-6 text-right ${s.color}`}>
                    {stats.byStatus[s.key]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Motoristas + Rotas populares ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[2%]">
        {/* Top Motoristas */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Car className="w-4 h-4 text-accent" />
              Top Motoristas
            </h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-green-400" />
                {stats.motoristasAtivos} ativos
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {stats.motoristas} total
              </span>
              {stats.banidos > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <Ban className="w-3 h-3" />
                  {stats.banidos} banidos
                </span>
              )}
            </div>
            {stats.topDrivers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum motorista com corridas</p>
            ) : (
              <div className="space-y-2">
                {stats.topDrivers.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2">
                    <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{d.nome}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{d.count} corrida{d.count > 1 ? 's' : ''}</span>
                        <span className="text-green-400 font-medium">R$ {d.revenue.toFixed(0)}</span>
                        {d.avgRating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                            {d.avgRating.toFixed(1)}
                            <span className="text-muted-foreground/60">({d.totalRatings})</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {d.count}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Rotas */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              Rotas Mais Solicitadas
            </h3>
            {stats.topRoutes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma rota registrada</p>
            ) : (
              <div className="space-y-2">
                {stats.topRoutes.map((route, i) => (
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
                    <div className="flex items-center gap-2 mt-0.5 ml-0">
                      <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{route.destino}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Corridas por dia da semana + Usuários ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[2%]">
        {/* Rides by day of week */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              Corridas por Dia (últimos 30 dias)
            </h3>
            <div className="flex items-end gap-1.5 h-24 px-1">
              {stats.ridesByDay.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{count}</span>
                  <div
                    className="w-full bg-accent/80 rounded-t-sm transition-all"
                    style={{ height: `${maxDay > 0 ? (count / maxDay) * 64 : 0}px`, minHeight: count > 0 ? '4px' : '0px' }}
                  />
                  <span className="text-[9px] text-muted-foreground">{stats.dayNames[i]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Users overview */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Usuários
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{stats.clientes}</p>
                <p className="text-[10px] text-muted-foreground">Clientes</p>
              </div>
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <Car className="w-4 h-4 text-accent mx-auto mb-1" />
                <p className="text-lg font-bold">{stats.motoristas}</p>
                <p className="text-[10px] text-muted-foreground">Motoristas</p>
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total de usuários</span>
                <span className="font-semibold">{stats.totalUsers}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Motoristas ativos</span>
                <span className="font-semibold text-green-400">{stats.motoristasAtivos}</span>
              </div>
              {stats.banidos > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Banidos</span>
                  <span className="font-semibold text-red-400">{stats.banidos}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Taxa de conclusão</span>
                <span className="font-semibold">
                  {stats.total > 0 ? ((stats.completedCount / stats.total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminStatsDashboard;
