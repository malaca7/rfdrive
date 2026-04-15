import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, Car, DollarSign, MessageSquare, Route } from 'lucide-react';
import { motion } from 'framer-motion';

/** Status mapping for client-visible badges */
const getStatusBadge = (status: string): { label: string; variant: 'outline' | 'destructive' | 'default' | 'secondary'; className?: string } => {
  switch (status) {
    case 'nova':
      return { label: 'Nova', variant: 'secondary' };
    case 'aguardando_motorista':
      return { label: 'Aguardando', variant: 'secondary', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    case 'aceita':
      return { label: 'Aceita', variant: 'outline', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'a_caminho':
      return { label: 'A caminho', variant: 'outline', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'em_corrida':
      return { label: 'Em viagem', variant: 'outline', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'em_analise':
    case 'aprovada':
    case 'finalizada':
      return { label: 'Concluída', variant: 'outline', className: 'bg-green-500/10 text-green-400 border-green-500/20' };
    case 'nao_realizada':
    case 'recusada':
      return { label: 'Não Concluída', variant: 'destructive' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

const RideHistory: React.FC = () => {
  const { user } = useAuth();

  const { data: rides, isLoading } = useQuery({
    queryKey: ['my-rides', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('cliente_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!rides || rides.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-[10%] text-center">
          <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma corrida solicitada ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rides.map((ride, i) => {
        const statusBadge = getStatusBadge(ride.status);
        return (
          <motion.div
            key={ride.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="rounded-2xl">
              <CardContent className="py-[3.5%] px-[4%]">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-xs text-muted-foreground">
                    {new Date(ride.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <Badge variant={statusBadge.variant} className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-success shrink-0" />
                    <span className="text-sm">{ride.origem_texto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm">{ride.destino_texto}</span>
                  </div>
                  {ride.horario_estimado && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{ride.horario_estimado}</span>
                    </div>
                  )}
                  {ride.valor_estimado != null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-sm font-semibold text-green-400">R$ {Number(ride.valor_estimado).toFixed(2)}</span>
                      </div>
                      {ride.preco_regra_aplicada && ride.preco_regra_aplicada.includes('+') && (() => {
                        const cor = (ride.preco_detalhes as any)?.cor_regra || '#8b5cf6';
                        return (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: cor, backgroundColor: `${cor}18` }}>
                            ⏰ {(ride.preco_detalhes as any)?.regra_horario || 'Preço dinâmico'}
                          </span>
                        );
                      })()}
                      {ride.tem_bagagem && (
                        <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">📦 Bagagem</span>
                      )}
                    </div>
                  )}
                </div>
                {(ride.valor != null || ride.observacao_motorista) && (
                  <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                    {ride.valor != null && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-sm font-semibold text-green-400">R$ {Number(ride.valor).toFixed(2)}</span>
                      </div>
                    )}
                    {ride.observacao_motorista && (
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground italic">"{ride.observacao_motorista}"</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RideHistory;
