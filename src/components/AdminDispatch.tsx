/**
 * Etapa 24 — Painel Administrativo de Despacho Automático
 * Mostra corridas, ofertas, rodadas, motoristas, tempos de resposta.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Loader2,
  Zap,
  Clock,
  Check,
  X,
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  Users,
  MapPin,
  Trophy,
  Timer,
  TrendingUp,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfertaWithDetails {
  id: string;
  corrida_id: string;
  motorista_id: string;
  status: string;
  rodada_disparo: number;
  score_ranking: number | null;
  distancia_km: number | null;
  enviado_em: string;
  respondido_em: string | null;
  tempo_resposta_segundos: number | null;
  motivo_rodada: string | null;
  motorista_nome?: string;
  motorista_telefone?: string;
}

interface CorridaDispatch {
  id: string;
  origem_texto: string;
  destino_texto: string;
  status: string;
  created_at: string;
  valor_estimado: number | null;
  motorista_id: string | null;
  motorista_nome?: string;
  ofertas: OfertaWithDetails[];
  totalOfertas: number;
  totalAceitas: number;
  totalRecusadas: number;
  totalExpiradas: number;
  totalEnviadas: number;
  rodadaAtual: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  enviada: { label: 'Enviada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <Clock className="w-3 h-3" /> },
  aceita: { label: 'Aceita', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: <Check className="w-3 h-3" /> },
  recusada: { label: 'Recusada', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <X className="w-3 h-3" /> },
  expirada: { label: 'Expirada', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: <AlertTriangle className="w-3 h-3" /> },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: <Ban className="w-3 h-3" /> },
};

const AdminDispatch: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [expandedRide, setExpandedRide] = useState<string | null>(null);

  // Query all offers with ride and driver data
  const { data: corridasDispatch, isLoading, refetch } = useQuery({
    queryKey: ['admin-dispatch'],
    queryFn: async () => {
      // Get rides that have offers
      const { data: ofertas, error } = await supabase
        .from('ofertas_corrida')
        .select('*')
        .order('enviado_em', { ascending: false });

      if (error) throw error;
      if (!ofertas || ofertas.length === 0) return [];

      // Get unique ride IDs and driver IDs
      const rideIds = [...new Set(ofertas.map((o) => o.corrida_id))];
      const driverIds = [...new Set(ofertas.map((o) => o.motorista_id))];

      // Fetch rides
      const { data: rides } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, status, created_at, valor_estimado, motorista_id')
        .in('id', rideIds);

      // Fetch drivers
      const { data: drivers } = await supabase
        .from('users')
        .select('id, nome, telefone')
        .in('id', driverIds);

      const driversMap = new Map((drivers || []).map((d) => [d.id, d]));
      const ridesMap = new Map((rides || []).map((r) => [r.id, r]));

      // Group offers by ride
      const grouped = new Map<string, OfertaWithDetails[]>();
      for (const oferta of ofertas) {
        const driver = driversMap.get(oferta.motorista_id);
        const enriched: OfertaWithDetails = {
          ...oferta,
          motorista_nome: driver?.nome || 'Desconhecido',
          motorista_telefone: driver?.telefone || '',
        };
        if (!grouped.has(oferta.corrida_id)) {
          grouped.set(oferta.corrida_id, []);
        }
        grouped.get(oferta.corrida_id)!.push(enriched);
      }

      // Build result
      const result: CorridaDispatch[] = [];
      for (const [rideId, rideOfertas] of grouped) {
        const ride = ridesMap.get(rideId);
        if (!ride) continue;

        const winner = rideOfertas.find((o) => o.status === 'aceita');
        const winnerDriver = winner ? driversMap.get(winner.motorista_id) : null;

        result.push({
          id: rideId,
          origem_texto: ride.origem_texto,
          destino_texto: ride.destino_texto,
          status: ride.status,
          created_at: ride.created_at,
          valor_estimado: ride.valor_estimado,
          motorista_id: ride.motorista_id,
          motorista_nome: winnerDriver?.nome || (ride.motorista_id ? 'Atribuído manualmente' : undefined),
          ofertas: rideOfertas,
          totalOfertas: rideOfertas.length,
          totalAceitas: rideOfertas.filter((o) => o.status === 'aceita').length,
          totalRecusadas: rideOfertas.filter((o) => o.status === 'recusada').length,
          totalExpiradas: rideOfertas.filter((o) => o.status === 'expirada').length,
          totalEnviadas: rideOfertas.filter((o) => o.status === 'enviada').length,
          rodadaAtual: Math.max(...rideOfertas.map((o) => o.rodada_disparo)),
        });
      }

      return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    refetchInterval: 1000,
  });

  // Metrics query
  const { data: metricas } = useQuery({
    queryKey: ['admin-driver-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metricas_motorista')
        .select('*, motorista:motorista_id(nome, telefone)' as any)
        .order('media_tempo_aceite', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 1000,
  });

  // Filter
  const filtered = useMemo(() => {
    if (!corridasDispatch) return [];
    let result = corridasDispatch;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.origem_texto.toLowerCase().includes(q) ||
          r.destino_texto.toLowerCase().includes(q) ||
          r.motorista_nome?.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.ofertas.some(
            (o) =>
              o.motorista_nome?.toLowerCase().includes(q) ||
              o.motorista_telefone?.includes(q),
          ),
      );
    }

    if (statusFilter !== 'todos') {
      result = result.filter((r) => r.ofertas.some((o) => o.status === statusFilter));
    }

    return result;
  }, [corridasDispatch, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!corridasDispatch) return { total: 0, aceitas: 0, recusadas: 0, expiradas: 0, pendentes: 0 };
    return {
      total: corridasDispatch.reduce((s, r) => s + r.totalOfertas, 0),
      aceitas: corridasDispatch.reduce((s, r) => s + r.totalAceitas, 0),
      recusadas: corridasDispatch.reduce((s, r) => s + r.totalRecusadas, 0),
      expiradas: corridasDispatch.reduce((s, r) => s + r.totalExpiradas, 0),
      pendentes: corridasDispatch.reduce((s, r) => s + r.totalEnviadas, 0),
    };
  }, [corridasDispatch]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Total', value: stats.total, icon: <Zap className="w-4 h-4" />, color: 'text-accent' },
          { label: 'Aceitas', value: stats.aceitas, icon: <Check className="w-4 h-4" />, color: 'text-green-400' },
          { label: 'Recusadas', value: stats.recusadas, icon: <X className="w-4 h-4" />, color: 'text-red-400' },
          { label: 'Expiradas', value: stats.expiradas, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-400' },
          { label: 'Pendentes', value: stats.pendentes, icon: <Clock className="w-4 h-4" />, color: 'text-blue-400' },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl">
            <CardContent className="py-3 px-3 text-center">
              <div className={`inline-flex items-center gap-1 ${s.color} mb-1`}>
                {s.icon}
                <span className="text-lg font-bold">{s.value}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, ID..."
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['todos', 'enviada', 'aceita', 'recusada', 'expirada', 'cancelada'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-8 rounded-lg ${
                statusFilter === s ? 'bg-accent hover:bg-accent/90' : ''
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'todos' ? 'Todos' : statusConfig[s]?.label || s}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="h-8" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Rides list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered?.length ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma corrida com despacho automático</p>
            <p className="text-xs text-muted-foreground mt-1">
              O sistema despacha automaticamente quando uma corrida é solicitada
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((corrida) => (
            <RideDispatchCard
              key={corrida.id}
              corrida={corrida}
              expanded={expandedRide === corrida.id}
              onToggle={() =>
                setExpandedRide((prev) => (prev === corrida.id ? null : corrida.id))
              }
            />
          ))}
        </div>
      )}

      {/* Driver metrics */}
      {metricas && metricas.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent" />
              Ranking de Motoristas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {metricas.map((m: any, i: number) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2.5"
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : i === 1
                        ? 'bg-gray-400/20 text-gray-300'
                        : i === 2
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(m as any).motorista?.nome || 'Motorista'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Timer className="w-3 h-3" />
                        {Number(m.media_tempo_aceite).toFixed(1)}s
                      </span>
                      <span className="text-green-400">
                        ✓ {m.total_corridas_aceitas}
                      </span>
                      <span className="text-red-400">
                        ✗ {m.total_corridas_recusadas}
                      </span>
                      <span className="text-yellow-400">
                        ⏳ {m.total_corridas_expiradas}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-accent">
                      {Number(m.taxa_aceite).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">taxa aceite</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Card de cada corrida com ofertas ──
const RideDispatchCard: React.FC<{
  corrida: CorridaDispatch;
  expanded: boolean;
  onToggle: () => void;
}> = ({ corrida, expanded, onToggle }) => {
  const rodadas = useMemo(() => {
    const map = new Map<number, OfertaWithDetails[]>();
    for (const o of corrida.ofertas) {
      if (!map.has(o.rodada_disparo)) map.set(o.rodada_disparo, []);
      map.get(o.rodada_disparo)!.push(o);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [corrida.ofertas]);

  const winner = corrida.ofertas.find((o) => o.status === 'aceita');

  return (
    <Card className="rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">
                {corrida.id.slice(0, 8)}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] py-0 ${
                  corrida.status === 'aprovada'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : corrida.status === 'em_analise'
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-muted'
                }`}
              >
                {corrida.status.replace(/_/g, ' ')}
              </Badge>
              {corrida.totalEnviadas > 0 && (
                <Badge variant="outline" className="text-[10px] py-0 bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse">
                  {corrida.totalEnviadas} pendente{corrida.totalEnviadas > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium truncate">
              {corrida.origem_texto} → {corrida.destino_texto}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
              <span>
                {new Date(corrida.created_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {corrida.totalOfertas} oferta{corrida.totalOfertas > 1 ? 's' : ''}
              </span>
              <span>Rodada {corrida.rodadaAtual}</span>
              {winner && (
                <span className="text-green-400 font-semibold">
                  ✓ {winner.motorista_nome} ({Number(winner.tempo_resposta_segundos).toFixed(1)}s)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mini status pills */}
            <div className="flex gap-0.5">
              {corrida.totalAceitas > 0 && (
                <span className="w-2 h-2 rounded-full bg-green-500" />
              )}
              {corrida.totalRecusadas > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500" />
              )}
              {corrida.totalExpiradas > 0 && (
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
              )}
              {corrida.totalEnviadas > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
              {rodadas.map(([rodada, ofertas]) => (
                <div key={rodada} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                      Rodada {rodada}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {ofertas[0]?.motivo_rodada}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {ofertas
                      .sort((a, b) => (a.score_ranking ?? 0) - (b.score_ranking ?? 0))
                      .reverse()
                      .map((oferta) => {
                        const cfg = statusConfig[oferta.status] || statusConfig.enviada;
                        return (
                          <div
                            key={oferta.id}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              oferta.status === 'aceita'
                                ? 'bg-green-500/5 border border-green-500/20'
                                : 'bg-muted/20'
                            }`}
                          >
                            <Badge variant="outline" className={`text-[10px] py-0 gap-0.5 ${cfg.color}`}>
                              {cfg.icon}
                              {cfg.label}
                            </Badge>
                            <span className="font-medium truncate flex-1">
                              {oferta.motorista_nome}
                            </span>
                            {oferta.motorista_telefone && (
                              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                {oferta.motorista_telefone}
                              </span>
                            )}
                            {oferta.score_ranking != null && (
                              <span className="text-[10px] text-accent font-mono">
                                score: {oferta.score_ranking.toFixed(2)}
                              </span>
                            )}
                            {oferta.distancia_km != null && (
                              <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {Number(oferta.distancia_km).toFixed(1)}km
                              </span>
                            )}
                            {oferta.tempo_resposta_segundos != null && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Timer className="w-2.5 h-2.5" />
                                {Number(oferta.tempo_resposta_segundos).toFixed(1)}s
                              </span>
                            )}
                            {oferta.status === 'aceita' && (
                              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default AdminDispatch;
