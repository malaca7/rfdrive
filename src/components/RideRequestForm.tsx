import React, { useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Loader2, Check, CheckCircle, Clock,
  Edit3, X, DollarSign, Route, Car, Star, Send, TableProperties, MessageSquare, Phone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import StarRating from '@/components/StarRating';
import { calculateRoute } from '@/lib/route-ai';
import { calcularPreco, salvarHistoricoPreco } from '@/lib/pricing-engine';
import { buscarPrecoTabela } from '@/lib/tabela-preco';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';

interface RouteEstimate {
  distancia_km: number;
  duracao_min: number;
  valor_estimado: number;
}

const RideRequestForm: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showCompletedSummary, setShowCompletedSummary] = useState(true);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [isSendingRating, setIsSendingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [observacaoCliente, setObservacaoCliente] = useState('');
  const destinoRef = useRef<HTMLInputElement>(null);
  const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false);
  const [showDestinoSuggestions, setShowDestinoSuggestions] = useState(false);

  // ── Tabela de preço: lookup em tempo real (reativo) ──
  const precoTabela = usePrecoTabela(origem, destino);

  // ── Autocomplete: all locations bidirectional (reativo) ──
  const allLocations = useAllLocations();

  const filteredOrigens = useMemo(() => {
    if (!origem.trim()) return allLocations;
    const q = origem.toLowerCase();
    return allLocations.filter(o => o.toLowerCase().includes(q));
  }, [origem, allLocations]);

  const filteredDestinos = useMemo(() => {
    if (!destino.trim()) return allLocations;
    const q = destino.toLowerCase();
    return allLocations.filter(d => d.toLowerCase().includes(q));
  }, [destino, allLocations]);

  const { data: activeRide, refetch: refetchActiveRide } = useQuery({
    queryKey: ['active-ride', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('cliente_id', user!.id)
        .in('status', ['nova', 'aguardando_motorista', 'aceita'])
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 3000,
  });

  // ── Fetch motorista info when ride is accepted ──
  const { data: motoristaInfo } = useQuery({
    queryKey: ['motorista-info', activeRide?.motorista_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('nome, telefone, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa')
        .eq('id', activeRide!.motorista_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeRide?.motorista_id && activeRide?.status === 'aceita',
  });

  const { data: lastCompletedRide } = useQuery({
    queryKey: ['last-completed-ride', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .eq('cliente_id', user!.id)
        .eq('status', 'em_analise')
        .order('concluida_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data?.concluida_at) {
        const ago = Date.now() - new Date(data.concluida_at).getTime();
        if (ago < 5 * 60 * 1000) return data;
      }
      return null;
    },
    enabled: !!user && !activeRide,
    refetchInterval: 5000,
  });

  const { data: existingRating } = useQuery({
    queryKey: ['ride-rating', lastCompletedRide?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('corrida_id', lastCompletedRide!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!lastCompletedRide?.id,
  });

  const submitRating = async () => {
    if (!lastCompletedRide || !user || rating === 0 || !lastCompletedRide.motorista_id) return;
    setIsSendingRating(true);
    try {
      const { error } = await supabase.from('avaliacoes').insert({
        corrida_id: lastCompletedRide.id,
        cliente_id: user.id,
        motorista_id: lastCompletedRide.motorista_id,
        nota: rating,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Avaliação enviada!', description: 'Obrigado pelo seu feedback.' });
      setRatingSubmitted(true);
    } catch (_e) {
      toast({ title: 'Erro ao enviar avaliação', variant: 'destructive' });
    } finally {
      setIsSendingRating(false);
    }
  };

  const hasActiveRide = !!activeRide;

  const handleSolicitar = async () => {
    const o = origem.trim();
    const d = destino.trim();
    if (!o || !d) {
      toast({ title: 'Preencha os dois campos', description: 'Informe de onde você sai e para onde vai.', variant: 'destructive' });
      return;
    }
    if (!user || hasActiveRide) return;
    setIsSending(true);
    setErrorMsg('');
    try {
      let distancia_km: number | null = null;
      let valor_estimado: number | null = null;
      let preco_regra_aplicada: string | null = null;
      let preco_detalhes: Record<string, unknown> | null = null;

      // IA local: calcula distância e preço client-side (non-blocking)
      try {
        const routeResult = await calculateRoute(o, d);
        if (routeResult) {
          distancia_km = routeResult.distancia_km;
          valor_estimado = routeResult.valor_estimado;
        }
      } catch {
        // route calc is optional
      }

      // 1) Tabela oficial RF: prioridade máxima
      const tabelaResult = buscarPrecoTabela(o, d);
      if (tabelaResult) {
        valor_estimado = tabelaResult.valor;
        preco_regra_aplicada = 'tabela_rf';
        preco_detalhes = {
          origem_tabela: tabelaResult.origem_tabela,
          destino_tabela: tabelaResult.destino_tabela,
          regiao: tabelaResult.regiao,
          match_exato: tabelaResult.match_exato,
          fonte: 'TabelaRF',
        };
      } else {
        // 2) Motor dinâmico: fallback
        try {
          const precoDinamico = await calcularPreco(o, d);
          if (precoDinamico) {
            valor_estimado = precoDinamico.preco_final;
            preco_regra_aplicada = precoDinamico.origem_regra;
            preco_detalhes = {
              preco_base: precoDinamico.preco_base,
              ajuste: precoDinamico.ajuste_aplicado,
              fallback: precoDinamico.fallback_usado,
              origem_loc: precoDinamico.origem_localidade?.nome,
              destino_loc: precoDinamico.destino_localidade?.nome,
            };
          }
        } catch {
          // fallback silencioso
        }
      }

      // Insert: try full payload, fallback to minimal if columns missing
      let corridaData: { id: string } | null = null;
      const obsCliente = observacaoCliente.trim() || null;
      const fullPayload = {
        cliente_id: user.id,
        origem_texto: o,
        destino_texto: d,
        status: 'aguardando_motorista',
        canal_origem: 'app',
        distancia_km,
        valor_estimado,
        preco_regra_aplicada,
        preco_detalhes,
        observacao_cliente: obsCliente,
      };

      const { data: d1, error: e1 } = await supabase.from('corridas').insert(fullPayload).select('id').single();
      if (e1) {
        // Retry with minimal columns (DB may not have pricing columns yet)
        const { data: d2, error: e2 } = await supabase.from('corridas').insert({
          cliente_id: user.id,
          origem_texto: o,
          destino_texto: d,
          status: 'aguardando_motorista',
          canal_origem: 'app',
          distancia_km,
          valor_estimado,
        }).select('id').single();
        if (e2) throw e2;
        corridaData = d2;
      } else {
        corridaData = d1;
      }

      // Salvar histórico de preço (non-critical)
      if (preco_regra_aplicada && corridaData?.id) {
        try {
          const precoDinamico = await calcularPreco(o, d);
          if (precoDinamico) {
            await salvarHistoricoPreco(corridaData.id, precoDinamico);
          }
        } catch {
          // non-critical
        }
      }

      toast({ title: 'Corrida solicitada!', description: 'Aguardando um motorista aceitar.' });
      setOrigem('');
      setDestino('');
      setObservacaoCliente('');
      setErrorMsg('');
    } catch (_e) {
      const msg = _e instanceof Error ? _e.message : 'Erro desconhecido';
      setErrorMsg(msg);
      toast({ title: 'Erro ao solicitar corrida', description: msg, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const respondToEdit = async (approved: boolean) => {
    if (!activeRide) return;
    const updateData: Record<string, unknown> = {
      edicao_aprovada: approved,
      edicao_pendente: false,
    };
    if (approved) {
      updateData.origem_texto = activeRide.origem_editada;
      updateData.destino_texto = activeRide.destino_editado;
      updateData.origem_editada = null;
      updateData.destino_editado = null;
    }
    const { error } = await supabase
      .from('corridas')
      .update(updateData)
      .eq('id', activeRide.id);
    if (error) {
      toast({ title: 'Erro ao responder', variant: 'destructive' });
    } else {
      toast({ title: approved ? 'Endereço atualizado!' : 'Alteração recusada' });
      refetchActiveRide();
    }
  };

  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelRide = async () => {
    if (!activeRide) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('corridas')
        .update({ status: 'cancelada' })
        .eq('id', activeRide.id)
        .in('status', ['nova', 'aguardando_motorista']);
      if (error) throw error;
      toast({ title: 'Corrida cancelada' });
      refetchActiveRide();
    } catch (_e) {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    } finally {
      setIsCancelling(false);
    }
  };

  if (hasActiveRide) {
    const statusLabel =
      activeRide.status === 'nova' ? 'Processando pedido...' :
      activeRide.status === 'aguardando_motorista' ? 'Aguardando motorista...' :
      'Corrida em andamento';
    const hasEditPending = activeRide.edicao_pendente && activeRide.edicao_aprovada === null;

    return (
      <div className="space-y-4">
        <Card className="border-accent/30">
          <CardContent className="py-6 space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mx-auto mb-3">
                {activeRide.status === 'aceita' ? (
                  <CheckCircle className="w-7 h-7 text-green-400" />
                ) : (
                  <Loader2 className="w-7 h-7 text-accent animate-spin" />
                )}
              </div>
              <h3 className="font-semibold text-lg">
                {activeRide.status === 'nova' ? 'Pedido recebido' :
                 activeRide.status === 'aguardando_motorista' ? 'Corrida solicitada' :
                 'Motorista a caminho'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{statusLabel}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="text-sm font-medium">{activeRide.origem_texto}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="text-sm font-medium">{activeRide.destino_texto}</p>
                </div>
              </div>
              {activeRide.valor_estimado != null && (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Valor estimado</p>
                      <p className="text-base font-bold text-green-400">
                        R$ {Number(activeRide.valor_estimado).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {activeRide.distancia_km != null && (
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-accent" />
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Distância</p>
                        <p className="text-base font-bold">{Number(activeRide.distancia_km).toFixed(1)} km</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* ── Motorista info when ride is accepted ── */}
            {activeRide.status === 'aceita' && motoristaInfo && (
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                    <Car className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{motoristaInfo.nome}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {motoristaInfo.telefone}
                    </p>
                  </div>
                </div>
                {(motoristaInfo.veiculo_marca || motoristaInfo.veiculo_modelo || motoristaInfo.veiculo_cor || motoristaInfo.veiculo_placa) && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Veículo</p>
                    {(motoristaInfo.veiculo_marca || motoristaInfo.veiculo_modelo) && (
                      <p className="text-sm font-medium">
                        {[motoristaInfo.veiculo_marca, motoristaInfo.veiculo_modelo].filter(Boolean).join(' ')}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {motoristaInfo.veiculo_cor && (
                        <span>Cor: <strong className="text-foreground">{motoristaInfo.veiculo_cor}</strong></span>
                      )}
                      {motoristaInfo.veiculo_placa && (
                        <span>Placa: <strong className="text-foreground font-mono">{motoristaInfo.veiculo_placa}</strong></span>
                      )}
                    </div>
                  </div>
                )}
                <a
                  href={`https://wa.me/55${motoristaInfo.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Falar com Motorista via WhatsApp
                </a>
              </div>
            )}
            {hasEditPending && (
              <Card className="border-yellow-500/30 bg-yellow-500/10">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm font-semibold text-yellow-400">Motorista solicita alteração</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nova origem</p>
                        <p className="font-medium">{activeRide.origem_editada}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Novo destino</p>
                        <p className="font-medium">{activeRide.destino_editado}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => respondToEdit(false)}
                    >
                      <X className="w-4 h-4 mr-1" /> Recusar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => respondToEdit(true)}
                    >
                      <Check className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {(activeRide.status === 'nova' || activeRide.status === 'aguardando_motorista') && (
              <Button
                variant="outline"
                onClick={handleCancelRide}
                disabled={isCancelling}
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                {isCancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Cancelar Corrida
              </Button>
            )}
            {activeRide.status === 'aceita' && (
              <p className="text-xs text-muted-foreground text-center">
                Corrida aceita — não é possível cancelar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (lastCompletedRide && showCompletedSummary) {
    return (
      <div className="space-y-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-6 space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="font-semibold text-lg">Corrida Concluída!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {lastCompletedRide.concluida_at && new Date(lastCompletedRide.concluida_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="text-sm font-medium">{lastCompletedRide.origem_texto}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="text-sm font-medium">{lastCompletedRide.destino_texto}</p>
                </div>
              </div>
            </div>
            {lastCompletedRide.valor != null && (
              <div className="text-center bg-muted/50 rounded-lg py-3">
                <p className="text-xs text-muted-foreground">Valor da corrida</p>
                <p className="text-2xl font-bold text-green-400">
                  R$ {Number(lastCompletedRide.valor).toFixed(2)}
                </p>
              </div>
            )}

            {/* Rating section */}
            {lastCompletedRide.motorista_id && !existingRating && !ratingSubmitted ? (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-center">Como foi sua viagem?</p>
                <div className="flex justify-center">
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
                {rating > 0 && (
                  <>
                    <Input
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Deixe um comentário (opcional)"
                      className="text-sm"
                    />
                    <Button
                      onClick={submitRating}
                      disabled={isSendingRating}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    >
                      {isSendingRating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Star className="w-4 h-4 mr-2" />
                      )}
                      Enviar Avaliação
                    </Button>
                  </>
                )}
              </div>
            ) : (existingRating || ratingSubmitted) ? (
              <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Sua avaliação</p>
                <div className="flex justify-center">
                  <StarRating
                    value={existingRating?.nota ?? rating}
                    readOnly
                    size="md"
                  />
                </div>
                {(existingRating?.comentario || comentario) && (
                  <p className="text-xs text-muted-foreground italic">
                    "{existingRating?.comentario || comentario}"
                  </p>
                )}
              </div>
            ) : null}

            <Button className="w-full" onClick={() => setShowCompletedSummary(false)}>
              Solicitar Nova Corrida
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 pb-5 space-y-5">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
              <Navigation className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-xl font-bold">Solicitar Corrida</h2>
            <p className="text-xs text-muted-foreground">
              Informe os dados da sua viagem
            </p>
          </div>

          {/* Origin */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Origem
            </label>
            <Input
              value={origem}
              onChange={(e) => { setOrigem(e.target.value); setErrorMsg(''); setShowOrigemSuggestions(true); }}
              onFocus={() => setShowOrigemSuggestions(true)}
              onBlur={() => setTimeout(() => setShowOrigemSuggestions(false), 200)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setShowOrigemSuggestions(false); destinoRef.current?.focus(); } }}
              placeholder="De onde você sai?"
              className="h-12 text-base"
            />
            {showOrigemSuggestions && filteredOrigens.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredOrigens.slice(0, 15).map(o => (
                  <button
                    key={o}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setOrigem(o); setShowOrigemSuggestions(false); destinoRef.current?.focus(); }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              Destino
            </label>
            <Input
              ref={destinoRef}
              value={destino}
              onChange={(e) => { setDestino(e.target.value); setErrorMsg(''); setShowDestinoSuggestions(true); }}
              onFocus={() => setShowDestinoSuggestions(true)}
              onBlur={() => setTimeout(() => setShowDestinoSuggestions(false), 200)}
              onKeyDown={(e) => { if (e.key === 'Enter' && origem.trim() && destino.trim()) { setShowDestinoSuggestions(false); handleSolicitar(); } }}
              placeholder="Para onde vai?"
              className="h-12 text-base"
            />
            {showDestinoSuggestions && filteredDestinos.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredDestinos.slice(0, 15).map(d => (
                  <button
                    key={d}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setDestino(d); setShowDestinoSuggestions(false); }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Observation */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              Observação <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              value={observacaoCliente}
              onChange={(e) => setObservacaoCliente(e.target.value)}
              placeholder="Ponto de referência, número da casa, instruções..."
              className="resize-none text-sm min-h-[60px]"
              rows={2}
            />
          </div>

          {/* ── Price preview from table ── */}
          <AnimatePresence>
            {precoTabela && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`${precoTabela.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-lg p-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableProperties className={`w-4 h-4 ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{precoTabela.estimado ? 'Preço estimado' : 'Preço tabelado'}</p>
                      <p className={`text-xl font-bold ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`}>R$ {precoTabela.valor.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">
                      {precoTabela.estimado ? 'Média via Centro do Cabo' : precoTabela.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                      {precoTabela.origem_tabela} → {precoTabela.destino_tabela}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive"
              >
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <Button
            onClick={handleSolicitar}
            disabled={!origem.trim() || !destino.trim() || isSending || hasActiveRide}
            className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
          >
            {isSending ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Solicitando...</>
            ) : (
              <><Send className="w-5 h-5 mr-2" />Solicitar Corrida</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RideRequestForm;