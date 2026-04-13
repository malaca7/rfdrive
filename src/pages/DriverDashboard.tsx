import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  MapPin, Navigation, Clock, CheckCircle, Car, Loader2,
  Edit3, DollarSign, MessageSquare, User, Phone, AlertTriangle,
  ChevronRight, X, Check, History, Star,
} from 'lucide-react';
import StarRating from '@/components/StarRating';
import { useToast } from '@/hooks/use-toast';

type Corrida = {
  id: string;
  cliente_id: string;
  motorista_id: string | null;
  origem_texto: string;
  destino_texto: string;
  horario_estimado: string | null;
  status: 'nova' | 'aguardando_motorista' | 'aceita' | 'em_analise' | 'aprovada' | 'nao_realizada' | 'recusada';
  canal_origem: 'whatsapp' | 'app';
  valor: number | null;
  distancia_km: number | null;
  valor_estimado: number | null;
  observacao_motorista: string | null;
  origem_editada: string | null;
  destino_editado: string | null;
  edicao_pendente: boolean;
  edicao_aprovada: boolean | null;
  concluida_at: string | null;
  created_at: string;
  cliente?: { nome: string; telefone: string } | null;
};

const DriverDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('disponiveis');
  const [selectedRide, setSelectedRide] = useState<Corrida | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);
  const [editOrigem, setEditOrigem] = useState('');
  const [editDestino, setEditDestino] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');

  // ── Queries ──
  const { data: pendingRides, isLoading: loadingPending } = useQuery({
    queryKey: ['pending-rides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('status', 'aguardando_motorista')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = await Promise.all(
        (data || []).map(async (ride: any) => {
          const { data: cliente } = await supabase
            .from('users')
            .select('nome, telefone')
            .eq('id', ride.cliente_id)
            .single();
          return { ...ride, cliente } as Corrida;
        })
      );
      return enriched;
    },
  });

  const { data: activeRides } = useQuery({
    queryKey: ['my-active-rides', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', user!.id)
        .eq('status', 'aceita')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = await Promise.all(
        (data || []).map(async (ride: any) => {
          const { data: cliente } = await supabase
            .from('users')
            .select('nome, telefone')
            .eq('id', ride.cliente_id)
            .single();
          return { ...ride, cliente } as Corrida;
        })
      );
      return enriched;
    },
    enabled: !!user,
  });

  const { data: completedRides } = useQuery({
    queryKey: ['my-completed-rides', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', user!.id)
        .in('status', ['em_analise', 'aprovada'])
        .order('concluida_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const enriched = await Promise.all(
        (data || []).map(async (ride: any) => {
          const { data: cliente } = await supabase
            .from('users')
            .select('nome, telefone')
            .eq('id', ride.cliente_id)
            .single();
          return { ...ride, cliente } as Corrida;
        })
      );
      return enriched;
    },
    enabled: !!user,
  });

  // ── Average rating ──
  const { data: avgRating } = useQuery({
    queryKey: ['driver-avg-rating', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('motorista_id', user!.id);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum, r) => sum + r.nota, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!user,
  });

  // ── Realtime ──
  useEffect(() => {
    const channel = supabase
      .channel('corridas-driver-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corridas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pending-rides'] });
        queryClient.invalidateQueries({ queryKey: ['my-active-rides'] });
        queryClient.invalidateQueries({ queryKey: ['my-completed-rides'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Mutations ──
  const acceptMutation = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({ motorista_id: user!.id, status: 'aceita' as const })
        .eq('id', rideId)
        .eq('status', 'aguardando_motorista');
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Corrida aceita!', description: 'Você agora pode gerenciar esta corrida.' });
      setActiveTab('ativas');
      queryClient.invalidateQueries({ queryKey: ['pending-rides'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-rides'] });
    },
    onError: () => {
      toast({ title: 'Erro ao aceitar corrida', description: 'Outro motorista pode ter aceitado primeiro.', variant: 'destructive' });
    },
  });

  const editAddressMutation = useMutation({
    mutationFn: async ({ rideId, origem, destino }: { rideId: string; origem: string; destino: string }) => {
      const { error } = await supabase
        .from('corridas')
        .update({
          origem_editada: origem,
          destino_editado: destino,
          edicao_pendente: true,
          edicao_aprovada: null,
        })
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Solicitação de alteração enviada', description: 'Aguardando aprovação do passageiro.' });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: ['my-active-rides'] });
    },
    onError: () => {
      toast({ title: 'Erro ao solicitar alteração', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ rideId, valorFinal, obs }: { rideId: string; valorFinal: number | null; obs: string }) => {
      const { error } = await supabase
        .from('corridas')
        .update({
          status: 'em_analise' as const,
          valor: valorFinal,
          observacao_motorista: obs || null,
          concluida_at: new Date().toISOString(),
        })
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Corrida concluída!', description: 'O passageiro foi notificado.' });
      setShowConcluirDialog(false);
      setSelectedRide(null);
      setValor('');
      setObservacao('');
      queryClient.invalidateQueries({ queryKey: ['my-active-rides'] });
      queryClient.invalidateQueries({ queryKey: ['my-completed-rides'] });
    },
    onError: () => {
      toast({ title: 'Erro ao concluir corrida', variant: 'destructive' });
    },
  });

  // ── Helpers ──
  const openEditDialog = (ride: Corrida) => {
    setSelectedRide(ride);
    setEditOrigem(ride.origem_editada || ride.origem_texto);
    setEditDestino(ride.destino_editado || ride.destino_texto);
    setShowEditDialog(true);
  };

  const openConcluirDialog = (ride: Corrida) => {
    setSelectedRide(ride);
    setValor(ride.valor?.toString() || '');
    setObservacao(ride.observacao_motorista || '');
    setShowConcluirDialog(true);
  };

  const handleConcluir = () => {
    if (!selectedRide) return;
    const valorNum = valor ? parseFloat(valor.replace(',', '.')) : null;
    if (valor && (isNaN(valorNum!) || valorNum! < 0)) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    completeMutation.mutate({ rideId: selectedRide.id, valorFinal: valorNum, obs: observacao });
  };

  const handleEditSubmit = () => {
    if (!selectedRide || !editOrigem.trim() || !editDestino.trim()) return;
    editAddressMutation.mutate({
      rideId: selectedRide.id,
      origem: editOrigem.trim(),
      destino: editDestino.trim(),
    });
  };

  const activeCount = activeRides?.length || 0;
  const pendingCount = pendingRides?.length || 0;

  // ── Pending Ride Card ──
  const PendingRideCard = ({ ride, index }: { ride: Corrida; index: number }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className="border-border/50 hover:border-accent/30 transition-colors">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{ride.cliente?.nome || 'Passageiro'}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(ride.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-sm font-medium">{ride.origem_texto}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span className="text-sm font-medium">{ride.destino_texto}</span>
            </div>
            {ride.horario_estimado && (
              <div className="flex items-center gap-2 ml-4">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{ride.horario_estimado}</span>
              </div>
            )}
            {(ride.distancia_km != null || ride.valor_estimado != null) && (
              <div className="flex items-center gap-3 ml-4">
                {ride.distancia_km != null && (
                  <span className="text-xs font-semibold text-accent">{ride.distancia_km} km</span>
                )}
                {ride.valor_estimado != null && (
                  <span className="text-xs font-semibold text-green-400">R$ {Number(ride.valor_estimado).toFixed(2)}</span>
                )}
              </div>
            )}
          </div>

          <Button
            className="w-full gradient-accent text-accent-foreground font-semibold hover:opacity-90"
            onClick={() => acceptMutation.mutate(ride.id)}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Car className="w-4 h-4 mr-2" />}
            Aceitar Corrida
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  // ── Active Ride Card (full management) ──
  const ActiveRideCard = ({ ride }: { ride: Corrida }) => {
    const hasEditPending = ride.edicao_pendente && ride.edicao_aprovada === null;
    const editApproved = ride.edicao_aprovada === true;
    const editRejected = ride.edicao_aprovada === false;
    const origemAtual = editApproved ? (ride.origem_editada || ride.origem_texto) : ride.origem_texto;
    const destinoAtual = editApproved ? (ride.destino_editado || ride.destino_texto) : ride.destino_texto;

    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="py-4 space-y-4">
          {/* Client info header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <User className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm">{ride.cliente?.nome || 'Passageiro'}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {ride.cliente?.telefone || '—'}
                </p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Em andamento</Badge>
          </div>

          <Separator />

          {/* Route info */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Origem</p>
                <p className="text-sm font-medium">{origemAtual}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Destino</p>
                <p className="text-sm font-medium">{destinoAtual}</p>
              </div>
            </div>
            {ride.horario_estimado && (
              <div className="flex items-center gap-2 ml-4">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{ride.horario_estimado}</span>
              </div>
            )}
          </div>

          {/* Edit status */}
          {hasEditPending && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-400">Alteração de endereço aguardando aprovação do passageiro</p>
            </div>
          )}
          {editRejected && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <X className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">Passageiro recusou a alteração de endereço</p>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openEditDialog(ride)}
              disabled={hasEditPending}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar Endereço
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => openConcluirDialog(ride)}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Concluir Corrida
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Completed Ride Card ──
  const CompletedRideCard = ({ ride }: { ride: Corrida }) => (
    <Card className="border-border/50 opacity-80">
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {ride.concluida_at
              ? new Date(ride.concluida_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : new Date(ride.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-2">
            {ride.valor != null && (
              <Badge variant="outline" className="text-green-400 border-green-500/30">
                R$ {ride.valor.toFixed(2)}
              </Badge>
            )}
            <Badge variant="outline">{ride.status === 'aprovada' ? 'Aprovada ✅' : 'Em Análise'}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs">{ride.origem_texto}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-xs">{ride.destino_texto}</span>
        </div>
        {ride.cliente && (
          <p className="text-xs text-muted-foreground">{ride.cliente.nome}</p>
        )}
        {ride.observacao_motorista && (
          <p className="text-xs text-muted-foreground italic">"{ride.observacao_motorista}"</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Olá, <span className="text-gradient">{profile?.nome || 'Motorista'}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount > 0
              ? `${activeCount} corrida${activeCount > 1 ? 's' : ''} em andamento`
              : 'Pronto para dirigir'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-accent">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-green-400">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{completedRides?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Rating */}
        {avgRating && (
          <Card className="mb-6 border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-lg text-yellow-400">{avgRating.avg}</span>
                <span className="text-xs text-muted-foreground">/ 5</span>
              </div>
              <p className="text-xs text-muted-foreground">{avgRating.count} avaliação{avgRating.count > 1 ? 'ões' : ''}</p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="disponiveis" className="flex-1 gap-1.5 text-xs">
              <Car className="w-3.5 h-3.5" />
              Disponíveis
              {pendingCount > 0 && (
                <Badge variant="default" className="ml-1 gradient-accent text-accent-foreground text-[10px] px-1.5 py-0 h-4">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ativas" className="flex-1 gap-1.5 text-xs">
              <Navigation className="w-3.5 h-3.5" />
              Ativas
              {activeCount > 0 && (
                <Badge variant="default" className="ml-1 bg-green-600 text-white text-[10px] px-1.5 py-0 h-4">
                  {activeCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* AVAILABLE RIDES */}
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
                  <p className="text-xs text-muted-foreground mt-1">As corridas aparecem aqui em tempo real</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingRides.map((ride, i) => (
                  <PendingRideCard key={ride.id} ride={ride} index={i} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ACTIVE RIDES */}
          <TabsContent value="ativas">
            {!activeRides?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Navigation className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma corrida em andamento</p>
                  <p className="text-xs text-muted-foreground mt-1">Aceite uma corrida na aba "Disponíveis"</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeRides.map((ride) => (
                  <ActiveRideCard key={ride.id} ride={ride} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="historico">
            {!completedRides?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma corrida concluída</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {completedRides.map((ride) => (
                  <CompletedRideCard key={ride.id} ride={ride} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit Address Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Editar Endereço
            </DialogTitle>
            <DialogDescription>
              O passageiro precisará aprovar a alteração antes que ela seja efetivada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nova Origem</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <Input value={editOrigem} onChange={(e) => setEditOrigem(e.target.value)} placeholder="Endereço de origem" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Novo Destino</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <Input value={editDestino} onChange={(e) => setEditDestino(e.target.value)} placeholder="Endereço de destino" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleEditSubmit}
              disabled={editAddressMutation.isPending || !editOrigem.trim() || !editDestino.trim()}
            >
              {editAddressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Solicitar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete Ride Dialog ── */}
      <Dialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Concluir Corrida
            </DialogTitle>
            <DialogDescription>
              Adicione o valor e uma observação se necessário.
            </DialogDescription>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-4 py-2">
              {/* Ride summary */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Resumo da corrida</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-sm">{selectedRide.origem_texto}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-sm">{selectedRide.destino_texto}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Passageiro: {selectedRide.cliente?.nome || '—'}
                </p>
              </div>

              {/* Value */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Valor da Corrida (R$)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Ex: 25,00"
                  className="text-lg font-semibold"
                />
              </div>

              {/* Observation */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Observação (opcional)
                </label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Passageiro pediu para esperar 5 min na saída"
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConcluirDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleConcluir}
              disabled={completeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar Conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default DriverDashboard;
