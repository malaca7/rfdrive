import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, Car } from 'lucide-react';
import { motion } from 'framer-motion';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  aceita: { label: 'Aceita', variant: 'default' },
  concluida: { label: 'Concluída', variant: 'outline' },
  rejeitada: { label: 'Rejeitada', variant: 'destructive' },
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
      <Card>
        <CardContent className="py-12 text-center">
          <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma corrida solicitada ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rides.map((ride, i) => {
        const cfg = statusConfig[ride.status] || statusConfig.pendente;
        return (
          <motion.div
            key={ride.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-xs text-muted-foreground">
                    {new Date(ride.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
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
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RideHistory;
