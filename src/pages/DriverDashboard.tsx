import React, { useState, useEffect, useMemo } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Clock, CheckCircle, Car, Loader2,
  Edit3, DollarSign, MessageSquare, User, Phone, AlertTriangle,
  ChevronRight, X, Check, History, Star, TableProperties, Ban, RotateCcw,
  Calculator, IdCard, Power, MapPinned, ArrowRight, Flag,
} from 'lucide-react';
import StarRating from '@/components/StarRating';
import { TripCalculator, DriverBadge } from '@/components/DriverTools';
import { useToast } from '@/hooks/use-toast';
import { buscarPrecoTabela, normalizeText, syncCacheFromSupabase } from '@/lib/tabela-preco';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDriverAvailability } from '@/hooks/useDriverAvailability';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useRideTracking } from '@/hooks/useRideTracking';
import { useDriverOffers } from '@/hooks/useDriverOffers';
import { DriverOffersList } from '@/components/DriverOfferCard';

type Corrida = {
  id: string;
  cliente_id: string;
  motorista_id: string | null;
  origem_texto: string;
  destino_texto: string;
  horario_estimado: string | null;
  status: 'nova' | 'aguardando_motorista' | 'aceita' | 'a_caminho' | 'em_corrida' | 'em_analise' | 'aprovada' | 'nao_realizada' | 'recusada' | 'finalizada';
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
  observacao_cliente: string | null;
  preco_regra_aplicada: string | null;
  preco_detalhes: Record<string, unknown> | null;
  tem_bagagem: boolean | null;
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
  const [showEditOrigemSugg, setShowEditOrigemSugg] = useState(false);
  const [showEditDestinoSugg, setShowEditDestinoSugg] = useState(false);
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [driverRating, setDriverRating] = useState(0);
  const [driverComentario, setDriverComentario] = useState('');

  // ── Etapa 8: Disponibilidade ──
  const { isAtivo, toggle: toggleDisponibilidade, isPending: togglePending } = useDriverAvailability(user?.id);

  // ── Etapa 7: Geolocalização (ativa só quando disponível) ──
  useDriverLocation({ driverId: user?.id, enabled: isAtivo });

  // ── Etapa 10: Tracking de corrida ──
  const rideTracking = useRideTracking(user?.id);

  // ── Etapa 20: Ofertas de corrida (despacho automático) ──
  const driverOffers = useDriverOffers(user?.id);


  // ── Autocomplete locations (reativo) ──
  const allLocations = useAllLocations();
  const filteredEditOrigens = useMemo(() => {
    if (!editOrigem.trim()) return allLocations;
    const q = normalizeText(editOrigem);
    return allLocations.filter(o => normalizeText(o).includes(q));
  }, [editOrigem, allLocations]);
  const filteredEditDestinos = useMemo(() => {
    if (!editDestino.trim()) return allLocations;
    const q = normalizeText(editDestino);
    return allLocations.filter(d => normalizeText(d).includes(q));
  }, [editDestino, allLocations]);

  // ── Tabela de preço: lookup para edição e conclusão (reativo) ──
  const precoTabelaEdit = usePrecoTabela(editOrigem, editDestino);

  const concluirOrigem = selectedRide
    ? ((selectedRide.edicao_aprovada && selectedRide.origem_editada) ? selectedRide.origem_editada : selectedRide.origem_texto)
    : '';
  const concluirDestino = selectedRide
    ? ((selectedRide.edicao_aprovada && selectedRide.destino_editado) ? selectedRide.destino_editado : selectedRide.destino_texto)
    : '';
  const precoTabelaConcluir = usePrecoTabela(concluirOrigem, concluirDestino);

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
      return (data || []) as Corrida[];
    },
    staleTime: 0,
    refetchInterval: 1000,
  });

  const { data: activeRides } = useQuery({
    queryKey: ['my-active-rides', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', user!.id)
        .in('status', ['aceita', 'a_caminho', 'em_corrida'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Corrida[];
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 1000,
  });

  const { data: completedRides } = useQuery({
    queryKey: ['my-completed-rides', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', user!.id)
        .in('status', ['em_analise', 'aprovada', 'finalizada'])
        .order('concluida_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Corrida[];
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 1000,
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

  // ── Full driver profile (with vehicle info) ──
  const { data: fullProfile } = useQuery({
    queryKey: ['driver-full-profile', user?.id],
    queryFn: async () => {
      // Try with avatar_url first; fall back without it if column doesn't exist yet
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, status, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa, avatar_url, veiculo_foto')
        .eq('id', user!.id)
        .single();
      if (error) {
        const { data: fallback, error: err2 } = await supabase
          .from('users')
          .select('id, nome, telefone, tipo, status, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa')
          .eq('id', user!.id)
          .single();
        if (err2) throw err2;
        return { ...fallback, avatar_url: null };
      }
      return data;
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

  // ── Cancelar corrida (definitivo, com motivo) ──
  const cancelMutation = useMutation({
    mutationFn: async ({ rideId, motivo }: { rideId: string; motivo: string }) => {
      const { error } = await supabase
        .from('corridas')
        .update({
          status: 'nao_realizada' as const,
          observacao_motorista: motivo || null,
        })
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Corrida cancelada', description: 'O motivo foi registrado.' });
      setShowCancelDialog(false);
      setSelectedRide(null);
      setMotivoCancelamento('');
      queryClient.invalidateQueries({ queryKey: ['my-active-rides'] });
    },
    onError: () => {
      toast({ title: 'Erro ao cancelar corrida', variant: 'destructive' });
    },
  });

  // ── Devolver corrida ("Não Pegar" — volta para disponíveis) ──
  const releaseMutation = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({ status: 'aguardando_motorista' as const, motorista_id: null })
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Corrida devolvida', description: 'A corrida voltou para solicitações disponíveis.' });
      queryClient.invalidateQueries({ queryKey: ['pending-rides'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-rides'] });
    },
    onError: () => {
      toast({ title: 'Erro ao devolver corrida', variant: 'destructive' });
    },
  });

  const editAddressMutation = useMutation({
    mutationFn: async ({ rideId, origem, destino, precoReativo }: { rideId: string; origem: string; destino: string; precoReativo: number | null }) => {
      const updates: Record<string, unknown> = {
        origem_editada: origem,
        destino_editado: destino,
        edicao_pendente: true,
        edicao_aprovada: null,
      };
      // Usar preço reativo (do hook) se disponível, senão buscar fresco
      if (precoReativo != null) {
        updates.valor_estimado = precoReativo;
        updates.valor = precoReativo;
      } else {
        await syncCacheFromSupabase();
        const tabelaResult = buscarPrecoTabela(origem, destino);
        if (tabelaResult) {
          updates.valor_estimado = tabelaResult.valor;
          updates.valor = tabelaResult.valor;
        }
      }
      const { error } = await supabase
        .from('corridas')
        .update(updates)
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
    mutationFn: async ({ rideId, valorFinal, obs, rating, comentarioRating, clienteId, motoristaId }: {
      rideId: string; valorFinal: number | null; obs: string;
      rating: number; comentarioRating: string; clienteId: string; motoristaId: string;
    }) => {
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

      // Submit driver's rating of client
      if (rating > 0) {
        await supabase.from('avaliacoes').upsert({
          corrida_id: rideId,
          cliente_id: clienteId,
          motorista_id: motoristaId,
          nota: rating,
          comentario: comentarioRating.trim() || null,
          tipo: 'motorista',
        }, { onConflict: 'corrida_id,tipo' });
      }
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
    // Fallback: valor original da corrida (o hook reativo precoTabelaConcluir será usado na UI)
    setValor(ride.valor_estimado?.toString() || ride.valor?.toString() || '');
    setObservacao(ride.observacao_motorista || '');
    setDriverRating(0);
    setDriverComentario('');
    setShowConcluirDialog(true);
  };

  const handleConcluir = () => {
    if (!selectedRide) return;
    // Usar preço reativo do hook (sempre atualizado via react-query + realtime)
    const valorFinal = precoTabelaConcluir ? precoTabelaConcluir.valor : (valor ? parseFloat(valor.replace(',', '.')) : null);
    if (valorFinal !== null && (isNaN(valorFinal) || valorFinal < 0)) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    completeMutation.mutate({
      rideId: selectedRide.id,
      valorFinal,
      obs: observacao,
      rating: driverRating,
      comentarioRating: driverComentario,
      clienteId: selectedRide.cliente_id,
      motoristaId: user!.id,
    });
  };

  const handleEditSubmit = () => {
    if (!selectedRide || !editOrigem.trim() || !editDestino.trim()) return;
    editAddressMutation.mutate({
      rideId: selectedRide.id,
      origem: editOrigem.trim(),
      destino: editDestino.trim(),
      precoReativo: precoTabelaEdit?.valor ?? null,
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
            {ride.valor_estimado != null && (
              <div className="flex items-center gap-3 ml-4">
                <span className="text-xs font-semibold text-green-400">R$ {Number(ride.valor_estimado).toFixed(2)}</span>
                {ride.preco_regra_aplicada && ride.preco_regra_aplicada.includes('+') && (() => {
                  const cor = (ride.preco_detalhes as any)?.cor_regra || '#8b5cf6';
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: cor, backgroundColor: `${cor}18` }}>
                      {(ride.preco_detalhes as any)?.ajuste_horario || (ride.preco_detalhes as any)?.regra_horario || 'Preço dinâmico'}
                    </span>
                  );
                })()}
                {ride.tem_bagagem && (
                  <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">📦 Bagagem</span>
                )}
              </div>
            )}
            {ride.observacao_cliente && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 mt-1">
                <p className="text-[10px] text-blue-400 font-medium mb-0.5">Observação do cliente:</p>
                <p className="text-xs text-muted-foreground">{ride.observacao_cliente}</p>
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
          {/* Status header */}
          <div className="flex items-center justify-end">
            <Badge className={
              ride.status === 'a_caminho' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              ride.status === 'em_corrida' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              'bg-green-500/20 text-green-400 border-green-500/30'
            }>
              {ride.status === 'aceita' ? 'Aceita' : ride.status === 'a_caminho' ? 'Indo buscar' : ride.status === 'em_corrida' ? 'Em corrida' : 'Em andamento'}
            </Badge>
          </div>

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
            {ride.valor_estimado != null && (
              <div className="flex flex-wrap items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-green-400">R$ {Number(ride.valor_estimado).toFixed(2)}</span>
                {ride.preco_regra_aplicada && ride.preco_regra_aplicada.includes('+') && (() => {
                  const cor = (ride.preco_detalhes as any)?.cor_regra || '#8b5cf6';
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: cor, backgroundColor: `${cor}18` }}>
                      {(ride.preco_detalhes as any)?.ajuste_horario || (ride.preco_detalhes as any)?.regra_horario || 'Preço dinâmico'}
                    </span>
                  );
                })()}
                {ride.tem_bagagem && (
                  <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">📦 Bagagem</span>
                )}
              </div>
            )}
          </div>

          {/* Client observation */}
          {ride.observacao_cliente && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-[10px] text-blue-400 font-medium mb-0.5">Observação do cliente:</p>
              <p className="text-xs text-muted-foreground">{ride.observacao_cliente}</p>
            </div>
          )}

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

          {/* Tracking Status Flow */}
          {ride.status === 'aceita' && (
            <Button
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11"
              onClick={() => rideTracking.startPickup.mutate(ride.id)}
              disabled={rideTracking.startPickup.isPending}
            >
              {rideTracking.startPickup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Estou a caminho do cliente
            </Button>
          )}
          {ride.status === 'a_caminho' && (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
              onClick={() => rideTracking.startTrip.mutate(ride.id)}
              disabled={rideTracking.startTrip.isPending}
            >
              {rideTracking.startTrip.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              Cliente embarcou — Iniciar corrida
            </Button>
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
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              onClick={() => releaseMutation.mutate(ride.id)}
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Não Pegar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => { setSelectedRide(ride); setMotivoCancelamento(''); setShowCancelDialog(true); }}
            >
              <Ban className="w-3.5 h-3.5" />
              Cancelar Corrida
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
        {ride.observacao_motorista && (
          <p className="text-xs text-muted-foreground italic">"{ride.observacao_motorista}"</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <h1 className="text-[clamp(1.5rem,5vw,2rem)] font-extrabold leading-tight">
            Olá, <span className="text-gradient">{profile?.nome || 'Motorista'}</span>
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            {activeCount > 0
              ? `${activeCount} corrida${activeCount > 1 ? 's' : ''} em andamento`
              : 'Pronto para dirigir'}
          </p>
        </motion.div>

        {/* ── Etapa 8: Availability Toggle ── */}
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className={`mb-[4%] transition-all duration-300 ${isAtivo ? 'border-green-500/30 bg-green-500/5' : 'border-border/50 bg-muted/30'}`}>
            <CardContent className="py-3 px-[4%]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isAtivo ? 'bg-green-500/20' : 'bg-muted'}`}>
                    <Power className={`w-5 h-5 transition-colors ${isAtivo ? 'text-green-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isAtivo ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {isAtivo ? 'Disponível' : 'Indisponível'}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {isAtivo && <><MapPinned className="w-3 h-3 text-green-400" /> Localização ativa</>}
                      {!isAtivo && 'Toque para ficar online'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={toggleDisponibilidade}
                  disabled={togglePending}
                  className={`h-10 px-6 rounded-full font-bold text-sm transition-all ${
                    isAtivo
                      ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                      : 'gradient-accent text-white hover:opacity-90'
                  }`}
                  variant="ghost"
                >
                  {togglePending ? <Loader2 className="w-4 h-4 animate-spin" /> : isAtivo ? 'Pausar' : 'Ficar Online'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-[3%] mb-[4%]">
          <Card className="border-accent/20">
            <CardContent className="py-[12%] text-center">
              <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-accent">{pendingCount}</p>
              <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Disponíveis</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="py-[12%] text-center">
              <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-green-400">{activeCount}</p>
              <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Em andamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-[12%] text-center">
              <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold">{completedRides?.length || 0}</p>
              <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Concluídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Rating */}
        {avgRating && (
          <Card className="mb-[4%] border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="py-3 flex items-center justify-between px-[4%]">
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
          <TabsList className="w-full mb-[4%] h-auto min-h-[48px] p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl flex flex-wrap gap-1">
            <TabsTrigger value="disponiveis" className="flex-1 min-w-[70px] gap-1 text-[11px] sm:text-xs rounded-xl h-10 font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.2)]">
              <Car className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Disponíveis</span>
              {pendingCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full gradient-accent text-accent-foreground text-[10px] font-bold shrink-0">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="ativas" className="flex-1 min-w-[70px] gap-1 text-[11px] sm:text-xs rounded-xl h-10 font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.2)]">
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Ativas</span>
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold shrink-0">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 min-w-[70px] gap-1 text-[11px] sm:text-xs rounded-xl h-10 font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.2)]">
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="calcular" className="flex-1 min-w-[70px] gap-1 text-[11px] sm:text-xs rounded-xl h-10 font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.2)]">
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Registrar</span>
            </TabsTrigger>
            <TabsTrigger value="cracha" className="flex-1 min-w-[70px] gap-1 text-[11px] sm:text-xs rounded-xl h-10 font-semibold data-[state=active]:bg-[hsl(45_100%_50%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(45_100%_50%/0.2)]">
              <IdCard className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Crachá</span>
            </TabsTrigger>
          </TabsList>

          {/* AVAILABLE RIDES */}
          <TabsContent value="disponiveis">
            {/* ── Ofertas de Despacho Automático ── */}
            {driverOffers.hasOffers && (
              <div className="mb-4">
                <DriverOffersList
                  offers={driverOffers.offers}
                  onAccept={driverOffers.handleAccept}
                  onDecline={driverOffers.handleDecline}
                  accepting={driverOffers.accepting}
                  declining={driverOffers.declining}
                />
              </div>
            )}
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

          {/* TRIP CALCULATOR */}
          <TabsContent value="calcular">
            <TripCalculator />
          </TabsContent>

          {/* DRIVER BADGE */}
          <TabsContent value="cracha">
            {fullProfile ? (
              <DriverBadge
                profile={fullProfile}
                avgRating={avgRating || null}
                completedCount={completedRides?.length || 0}
              />
            ) : (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
            <div className="relative">
              <label className="text-sm font-medium mb-1.5 block">Nova Origem</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <Input
                  value={editOrigem}
                  onChange={(e) => { setEditOrigem(e.target.value); setShowEditOrigemSugg(true); }}
                  onFocus={() => setShowEditOrigemSugg(true)}
                  onBlur={() => setTimeout(() => setShowEditOrigemSugg(false), 200)}
                  placeholder="Endereço de origem"
                />
              </div>
              {showEditOrigemSugg && filteredEditOrigens.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[hsl(0_0%_10%)] border border-white/[0.08] rounded-2xl shadow-2xl max-h-40 overflow-y-auto">
                  {filteredEditOrigens.slice(0, 12).map(o => (
                    <button key={o} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                      onMouseDown={e => e.preventDefault()} onClick={() => { setEditOrigem(o); setShowEditOrigemSugg(false); }}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="text-sm font-medium mb-1.5 block">Novo Destino</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <Input
                  value={editDestino}
                  onChange={(e) => { setEditDestino(e.target.value); setShowEditDestinoSugg(true); }}
                  onFocus={() => setShowEditDestinoSugg(true)}
                  onBlur={() => setTimeout(() => setShowEditDestinoSugg(false), 200)}
                  placeholder="Endereço de destino"
                />
              </div>
              {showEditDestinoSugg && filteredEditDestinos.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[hsl(0_0%_10%)] border border-white/[0.08] rounded-2xl shadow-2xl max-h-40 overflow-y-auto">
                  {filteredEditDestinos.slice(0, 12).map(d => (
                    <button key={d} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                      onMouseDown={e => e.preventDefault()} onClick={() => { setEditDestino(d); setShowEditDestinoSugg(false); }}>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {precoTabelaEdit && (
              <div className={`${precoTabelaEdit.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-lg p-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableProperties className={`w-4 h-4 ${precoTabelaEdit.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{precoTabelaEdit.estimado ? 'Preço estimado' : 'Preço tabelado'}</p>
                      <p className={`text-lg font-bold ${precoTabelaEdit.estimado ? 'text-amber-400' : 'text-green-400'}`}>R$ {precoTabelaEdit.valor.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                      {precoTabelaEdit.estimado ? 'Média via Centro do Cabo' : `${precoTabelaEdit.origem_tabela} → ${precoTabelaEdit.destino_tabela}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
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

              {/* Value - from table (read-only) */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Valor da Corrida (R$)
                </label>
                {precoTabelaConcluir ? (
                  <div className={`${precoTabelaConcluir.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-lg p-3`}>
                    <div className="flex items-center gap-2">
                      <TableProperties className={`w-4 h-4 ${precoTabelaConcluir.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{precoTabelaConcluir.estimado ? 'Preço estimado (média via Centro do Cabo)' : 'Preço definido pela tabela'}</p>
                        <p className={`text-xl font-bold ${precoTabelaConcluir.estimado ? 'text-amber-400' : 'text-green-400'}`}>R$ {precoTabelaConcluir.valor.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {precoTabelaConcluir.origem_tabela} → {precoTabelaConcluir.destino_tabela}
                    </p>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <p className="text-sm text-yellow-400">Rota sem preço definido na tabela</p>
                    </div>
                    {valor && (
                      <p className="text-lg font-bold mt-1">R$ {parseFloat(valor.replace(',', '.')).toFixed(2)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Driver rates client */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-yellow-400" />
                  Avalie o Passageiro
                </label>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-center">
                    <StarRating value={driverRating} onChange={setDriverRating} size="lg" />
                  </div>
                  {driverRating > 0 && (
                    <Input
                      value={driverComentario}
                      onChange={(e) => setDriverComentario(e.target.value)}
                      placeholder="Comentário sobre o passageiro (opcional)"
                      className="text-sm"
                    />
                  )}
                </div>
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
      {/* ── Cancel Ride Dialog ── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="w-5 h-5" />
              Cancelar Corrida
            </DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-1.5 block">Motivo do cancelamento</label>
            <Textarea
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Passageiro não estava no local, problema no veículo..."
              className="resize-none"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!selectedRide) return;
                cancelMutation.mutate({ rideId: selectedRide.id, motivo: motivoCancelamento.trim() });
              }}
              disabled={cancelMutation.isPending || !motivoCancelamento.trim()}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default DriverDashboard;
