import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  MapPin, Navigation, Clock, CheckCircle, XCircle,
  Users, Car, Shield, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch all rides
  const { data: rides, isLoading: loadingRides } = useQuery({
    queryKey: ['admin-rides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all profiles + roles (admin can see all)
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
      if (pErr) throw pErr;
      const { data: roles, error: rErr } = await supabase.from('user_roles').select('*');
      if (rErr) throw rErr;
      return profiles.map((p) => ({
        ...p,
        roles: roles.filter((r) => r.user_id === p.user_id).map((r) => r.role),
      }));
    },
  });

  const updateRideMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { aprovado_admin?: boolean; status?: 'pendente' | 'aceita' | 'concluida' | 'rejeitada' } }) => {
      const { error } = await supabase.from('corridas').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      toast({ title: 'Corrida atualizada!' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'ativo' | 'banido' }) => {
      const { error } = await supabase.from('profiles').update({ status }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuário atualizado!' });
    },
  });

  const filteredRides = rides?.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  const statusColors: Record<string, string> = {
    pendente: 'bg-yellow-100 text-yellow-800',
    aceita: 'bg-blue-100 text-blue-800',
    concluida: 'bg-green-100 text-green-800',
    rejeitada: 'bg-red-100 text-red-800',
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie corridas e usuários</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: rides?.length || 0, icon: Car },
            { label: 'Pendentes', value: rides?.filter((r) => r.status === 'pendente').length || 0, icon: Clock },
            { label: 'Aceitas', value: rides?.filter((r) => r.status === 'aceita').length || 0, icon: CheckCircle },
            { label: 'Usuários', value: users?.length || 0, icon: Users },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="py-4 text-center">
                <s.icon className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="corridas">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="corridas" className="flex-1 gap-2">
              <Car className="w-4 h-4" /> Corridas
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex-1 gap-2">
              <Users className="w-4 h-4" /> Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="corridas">
            <div className="mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aceita">Aceita</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingRides ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {filteredRides?.map((ride, i) => (
                  <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card>
                      <CardContent className="py-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[ride.status]}`}>
                                {ride.status}
                              </span>
                              {ride.aprovado_admin && (
                                <Badge variant="outline" className="text-xs">Aprovado</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-success" />
                              <span className="text-sm">{ride.origem_texto}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Navigation className="w-3.5 h-3.5 text-accent" />
                              <span className="text-sm">{ride.destino_texto}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(ride.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {!ride.aprovado_admin && ride.status !== 'rejeitada' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success border-success/30"
                                onClick={() => updateRideMutation.mutate({ id: ride.id, updates: { aprovado_admin: true } })}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                              </Button>
                            )}
                            {ride.status !== 'rejeitada' && ride.status !== 'concluida' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30"
                                onClick={() => updateRideMutation.mutate({ id: ride.id, updates: { status: 'rejeitada' } })}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="usuarios">
            <div className="space-y-3">
              {users?.map((u) => (
                <Card key={u.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{u.nome || 'Sem nome'}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        <div className="flex gap-1 mt-1">
                          {u.roles.map((r: string) => (
                            <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={u.status === 'ativo' ? 'destructive' : 'default'}
                        onClick={() =>
                          updateUserMutation.mutate({
                            userId: u.user_id,
                            status: u.status === 'ativo' ? 'banido' : 'ativo',
                          })
                        }
                      >
                        {u.status === 'ativo' ? 'Banir' : 'Ativar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default AdminDashboard;
