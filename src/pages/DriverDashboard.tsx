import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Clock, CheckCircle, Car, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

const DriverDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingRides, isLoading: loadingPending } = useQuery({
    queryKey: ['pending-rides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myRides } = useQuery({
    queryKey: ['my-accepted-rides', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('corridas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corridas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pending-rides'] });
        queryClient.invalidateQueries({ queryKey: ['my-accepted-rides'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const acceptMutation = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({ motorista_id: user!.id, status: 'aceita' as const })
        .eq('id', rideId)
        .eq('status', 'pendente');
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Corrida aceita!' });
      queryClient.invalidateQueries({ queryKey: ['pending-rides'] });
      queryClient.invalidateQueries({ queryKey: ['my-accepted-rides'] });
    },
    onError: () => {
      toast({ title: 'Erro ao aceitar corrida', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({ status: 'concluida' as const })
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Corrida concluída!' });
      queryClient.invalidateQueries({ queryKey: ['my-accepted-rides'] });
    },
  });

  const RideCard = ({ ride, actions }: { ride: any; actions?: React.ReactNode }) => (
    <Card>
      <CardContent className="py-4">
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-success shrink-0" />
            <span className="text-sm font-medium">{ride.origem_texto}</span>
          </div>
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm font-medium">{ride.destino_texto}</span>
          </div>
          {ride.horario_estimado && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{ride.horario_estimado}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(ride.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {actions}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Olá, <span className="text-gradient">{profile?.nome || 'Motorista'}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Corridas disponíveis para você</p>
        </div>

        <Tabs defaultValue="disponiveis">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="disponiveis" className="flex-1 gap-2">
              <Car className="w-4 h-4" />
              Disponíveis
              {pendingRides && pendingRides.length > 0 && (
                <Badge variant="default" className="ml-1 gradient-accent text-accent-foreground text-xs px-1.5 py-0">
                  {pendingRides.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="minhas" className="flex-1 gap-2">
              <CheckCircle className="w-4 h-4" /> Minhas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disponiveis">
            {loadingPending ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !pendingRides?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma corrida disponível no momento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingRides.map((ride, i) => (
                  <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <RideCard
                      ride={ride}
                      actions={
                        <Button
                          size="sm"
                          className="gradient-accent text-accent-foreground font-semibold hover:opacity-90"
                          onClick={() => acceptMutation.mutate(ride.id)}
                          disabled={acceptMutation.isPending}
                        >
                          {acceptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aceitar'}
                        </Button>
                      }
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="minhas">
            {!myRides?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhuma corrida aceita</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myRides.map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    actions={
                      <div className="flex items-center gap-2">
                        <Badge variant={ride.status === 'concluida' ? 'outline' : 'default'}>
                          {ride.status === 'aceita' ? 'Em andamento' : ride.status === 'concluida' ? 'Concluída' : ride.status}
                        </Badge>
                        {ride.status === 'aceita' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeMutation.mutate(ride.id)}
                            disabled={completeMutation.isPending}
                          >
                            Concluir
                          </Button>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default DriverDashboard;
