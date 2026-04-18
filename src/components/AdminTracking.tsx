import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, User, Clock, Navigation, Car, Radio, MapPinned, AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DriverRow {
  id: string;
  nome: string;
  telefone: string;
  status_disponibilidade: string;
  ultima_atividade: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  location?: {
    latitude: number;
    longitude: number;
    atualizado_em: string;
  } | null;
  activeRide?: {
    id: string;
    status: string;
    origem_texto: string;
    destino_texto: string;
    cliente_nome?: string;
    tracking_ativo?: boolean;
  } | null;
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  aceita: { label: 'Aceita', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' },
  a_caminho: { label: 'Indo buscar', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
  em_corrida: { label: 'Em corrida', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const AdminTracking: React.FC = () => {
  const { data: drivers, isLoading } = useQuery({
    queryKey: ['admin-drivers-tracking'],
    queryFn: async (): Promise<DriverRow[]> => {
      // Get all drivers
      const { data: users, error } = await supabase
        .from('users')
        .select('id, nome, telefone, status_disponibilidade, ultima_atividade, veiculo_marca, veiculo_modelo, veiculo_placa')
        .or('tipo.eq.motorista,roles.cs.{motorista}')
        .order('status_disponibilidade', { ascending: false });
      if (error) throw error;

      // Get all locations
      const { data: locations } = await supabase
        .from('localizacao_motorista' as any)
        .select('*');

      // Get active rides with tracking
      const { data: activeRides } = await supabase
        .from('corridas')
        .select('id, motorista_id, status, origem_texto, destino_texto, tracking_ativo, cliente_id')
        .in('status', ['aceita', 'a_caminho', 'em_corrida'] as any[]);

      // Get client names for active rides
      const clientIds = [...new Set((activeRides || []).map(r => r.cliente_id).filter(Boolean))];
      let clientMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('users')
          .select('id, nome')
          .in('id', clientIds);
        clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.nome]));
      }

      const locMap: Record<string, any> = {};
      for (const l of (locations || [])) {
        locMap[(l as any).motorista_id] = l;
      }

      const rideMap: Record<string, any> = {};
      for (const r of (activeRides || [])) {
        if (r.motorista_id) {
          rideMap[r.motorista_id] = {
            ...r,
            cliente_nome: clientMap[r.cliente_id] || undefined,
          };
        }
      }

      return ((users as any[]) || []).map(u => ({
        ...u,
        location: locMap[u.id] ? {
          latitude: locMap[u.id].latitude,
          longitude: locMap[u.id].longitude,
          atualizado_em: locMap[u.id].atualizado_em,
        } : null,
        activeRide: rideMap[u.id] || null,
      }));
    },
    refetchInterval: 1000,
  });

  const ativos = drivers?.filter(d => (d as any).status_disponibilidade === 'ativo') || [];
  const inativos = drivers?.filter(d => (d as any).status_disponibilidade !== 'ativo') || [];
  const emCorrida = drivers?.filter(d => d.activeRide) || [];

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-green-500/20">
          <CardContent className="py-3 sm:py-4 text-center">
            <p className="text-xl sm:text-2xl font-extrabold text-green-400">{ativos.length}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Online</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="py-3 sm:py-4 text-center">
            <p className="text-xl sm:text-2xl font-extrabold text-blue-400">{emCorrida.length}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Em corrida</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 sm:py-4 text-center">
            <p className="text-xl sm:text-2xl font-extrabold text-muted-foreground">{inativos.length}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Offline</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Drivers with Rides */}
      {emCorrida.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent" />
            Corridas em andamento
          </h3>
          {emCorrida.map((d, i) => {
            const st = statusLabels[d.activeRide!.status] || statusLabels.aceita;
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`border ${st.bg}`}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <Car className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{d.nome}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {[d.veiculo_marca, d.veiculo_modelo].filter(Boolean).join(' ')} {d.veiculo_placa && `• ${d.veiculo_placa}`}
                          </p>
                        </div>
                      </div>
                      <Badge className={st.bg}>
                        <span className={st.color}>{st.label}</span>
                      </Badge>
                    </div>
                    {/* Ride details */}
                    <div className="bg-black/20 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="text-xs">{d.activeRide!.origem_texto}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        <span className="text-xs">{d.activeRide!.destino_texto}</span>
                      </div>
                      {d.activeRide!.cliente_nome && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" /> {d.activeRide!.cliente_nome}
                        </p>
                      )}
                    </div>
                    {/* Location */}
                    {d.location && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <MapPinned className="w-3 h-3 text-green-400" />
                        <span>{d.location.latitude.toFixed(4)}, {d.location.longitude.toFixed(4)}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <Clock className="w-3 h-3" />
                        <span>{timeAgo(d.location.atualizado_em)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* All drivers list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <User className="w-4 h-4" />
          Todos os motoristas ({drivers?.length || 0})
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !drivers?.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum motorista cadastrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {drivers.map((d) => (
              <Card key={d.id} className={`border-border/30 ${(d as any).status_disponibilidade === 'ativo' ? 'bg-green-500/[0.02]' : ''}`}>
                <CardContent className="py-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${(d as any).status_disponibilidade === 'ativo' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-gray-500'}`} />
                      <div>
                        <p className="text-sm font-semibold">{d.nome}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {d.veiculo_placa && <span>{d.veiculo_placa}</span>}
                          {d.location && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {timeAgo(d.location.atualizado_em)}
                              </span>
                            </>
                          )}
                          {(d as any).ultima_atividade && !d.location && (
                            <>
                              <span>•</span>
                              <span>Visto {timeAgo((d as any).ultima_atividade)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.activeRide && (
                        <Badge variant="outline" className="text-[10px] py-0.5 border-accent/30 text-accent">
                          {statusLabels[d.activeRide.status]?.label || 'Ativa'}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] py-0.5 ${(d as any).status_disponibilidade === 'ativo' ? 'border-green-500/30 text-green-400' : 'border-border text-muted-foreground'}`}>
                        {(d as any).status_disponibilidade === 'ativo' ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Placeholder for future map */}
      <Card className="border-dashed border-border/50 bg-transparent">
        <CardContent className="py-6 text-center">
          <MapPin className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50">Mapa em tempo real — em breve</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTracking;
