import React, { useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation, Loader2, Clock,
  Send, TableProperties, MessageSquare, Zap, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateRoute } from '@/lib/route-ai';
import { calcularPreco, salvarHistoricoPreco, getConfigTarifas, getActiveTimeRule, applyTimeAdjustment, invalidatePricingCache, type PricingResult, type ConfigTarifas } from '@/lib/pricing-engine';
import { buscarPrecoTabela, syncCacheFromSupabase } from '@/lib/tabela-preco';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';

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
  const [errorMsg, setErrorMsg] = useState('');
  const [observacaoCliente, setObservacaoCliente] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const destinoRef = useRef<HTMLInputElement>(null);
  const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false);
  const [showDestinoSuggestions, setShowDestinoSuggestions] = useState(false);

  // -- Tabela de preço: lookup em tempo real (reativo) --
  const precoTabela = usePrecoTabela(origem, destino);

  // -- Regra de horário dinâmica (noturno, madrugada, etc.) --
  const dynamicAdj = useDynamicAdjustment();

  // -- Configuração global de tarifas --
  const { data: configTarifas } = useQuery<ConfigTarifas | null>({
    queryKey: ['config-tarifas-form'],
    queryFn: () => getConfigTarifas(),
    staleTime: 10_000,
  });

  // -- Motor dinâmico: preço reativo via localidades + precos_rotas + regras_horario --
  const origemTrim = origem.trim();
  const destinoTrim = destino.trim();
  const { data: precoDinamico } = useQuery<PricingResult | null>({
    queryKey: ['preco-dinamico', origemTrim, destinoTrim],
    queryFn: () => calcularPreco(origemTrim, destinoTrim),
    enabled: !!origemTrim && !!destinoTrim,
    staleTime: 10_000,
  });

  // -- Autocomplete: all locations bidirectional (reativo) --
  const allLocations = useAllLocations();

  const filteredOrigens = useMemo(() => {
    if (!origem.trim()) return allLocations.slice(0, 30);
    const q = normalizeText(origem);
    const terms = q.split(' ').filter(t => t.length > 0);
    return allLocations.filter(o => {
      const n = normalizeText(o);
      return terms.every(t => n.includes(t));
    });
  }, [origem, allLocations]);

  const filteredDestinos = useMemo(() => {
    if (!destino.trim()) return allLocations.slice(0, 30);
    const q = normalizeText(destino);
    const terms = q.split(' ').filter(t => t.length > 0);
    return allLocations.filter(d => {
      const n = normalizeText(d);
      return terms.every(t => n.includes(t));
    });
  }, [destino, allLocations]);

  const handleSolicitar = async () => {
    const o = origem.trim();
    const d = destino.trim();
    if (!o || !d) {
      toast({ title: 'Preencha os dois campos', description: 'Informe de onde você sai e para onde vai.', variant: 'destructive' });
      return;
    }
    if (!user) return;
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

      // 1) Motor dinâmico: prioridade máxima (usa localidades + precos_rotas + regras_horario do admin)
      let motorDinamicoAplicouRegra = false;
      try {
        const precoDinamicoResult = await calcularPreco(o, d);
        if (precoDinamicoResult) {
          valor_estimado = precoDinamicoResult.preco_final;
          preco_regra_aplicada = precoDinamicoResult.origem_regra;
          motorDinamicoAplicouRegra = !!precoDinamicoResult.regra_horario;
          preco_detalhes = {
            preco_base: precoDinamicoResult.preco_base,
            ajuste: precoDinamicoResult.ajuste_aplicado,
            fallback: precoDinamicoResult.fallback_usado,
            origem_loc: precoDinamicoResult.origem_localidade?.nome,
            destino_loc: precoDinamicoResult.destino_localidade?.nome,
          };
          if (precoDinamicoResult.regra_horario) {
            preco_regra_aplicada += `+${precoDinamicoResult.regra_horario.nome}`;
            preco_detalhes.regra_horario = precoDinamicoResult.regra_horario.nome;
            preco_detalhes.cor_regra = precoDinamicoResult.regra_horario.cor || null;
          }
        }
      } catch {
        // dynamic engine is optional
      }

      // 2) Tabela oficial RF: fallback se motor dinâmico não encontrou
      if (!preco_regra_aplicada) {
        await syncCacheFromSupabase(); // Garantir dados frescos da tabela
        const tabelaResult = buscarPrecoTabela(o, d);
        if (tabelaResult) {
          valor_estimado = tabelaResult.valor;
          preco_regra_aplicada = 'tabela_rf';
          preco_detalhes = {
            origem_tabela: tabelaResult.origem_tabela,
            destino_tabela: tabelaResult.destino_tabela,
            regiao: tabelaResult.regiao,
            match_exato: tabelaResult.match_exato,
            fonte: 'Supabase',
          };
        }
      }

      // 3) Aplicar regra de horário dinâmica se nenhuma fonte já a aplicou
      if (valor_estimado != null && !motorDinamicoAplicouRegra) {
        try {
          invalidatePricingCache();
          const regraAtiva = await getActiveTimeRule();
          if (regraAtiva) {
            const precoBase = valor_estimado;
            valor_estimado = Math.round(applyTimeAdjustment(precoBase, regraAtiva) * 100) / 100;
            preco_regra_aplicada = `${preco_regra_aplicada || 'route_ai'}+${regraAtiva.nome}`;
            preco_detalhes = {
              ...preco_detalhes,
              preco_base_antes_ajuste: precoBase,
              ajuste_horario: regraAtiva.tipo_ajuste === 'fixo' ? `+R$${regraAtiva.valor_ajuste.toFixed(2)} ${regraAtiva.nome}` : `+${regraAtiva.valor_ajuste}% ${regraAtiva.nome}`,
              regra_horario: regraAtiva.nome,
              cor_regra: regraAtiva.cor || null,
            };
          }
        } catch {
          if (dynamicAdj) {
            const precoBase = valor_estimado;
            valor_estimado = dynamicAdj.aplicar(precoBase);
            preco_regra_aplicada = `${preco_regra_aplicada || 'route_ai'}+${dynamicAdj.regra.nome}`;
            preco_detalhes = {
              ...preco_detalhes,
              preco_base_antes_ajuste: precoBase,
              ajuste_horario: dynamicAdj.label,
              regra_horario: dynamicAdj.regra.nome,
              cor_regra: dynamicAdj.regra.cor || null,
            };
          }
        }
      }

      // Adicionar taxa de bagagem se aplicável
      const taxaBagagemValor = configTarifas?.taxa_bagagem ?? 5.00;
      const taxaBagagem = temBagagem ? taxaBagagemValor : 0;
      if (taxaBagagem > 0) {
        valor_estimado = (valor_estimado || 0) + taxaBagagem;
      }

      // Aplicar tarifa mínima global
      const tarifaMinima = configTarifas?.tarifa_minima ?? 0;
      if (tarifaMinima > 0 && valor_estimado != null && valor_estimado < tarifaMinima) {
        valor_estimado = tarifaMinima;
      }

      // Insert: try full payload, fallback to minimal if columns missing
      let corridaData: { id: string } | null = null;
      const obsCliente = observacaoCliente.trim() || null;
      const fullPayload = {
        cliente_id: user.id,
        origem_texto: o,
        destino_texto: d,
        status: 'aprovada' as const,
        distancia_km,
        valor_estimado,
        preco_regra_aplicada,
        preco_detalhes,
        observacao_cliente: obsCliente,
        tem_bagagem: temBagagem,
      };

      const { data: d1, error: e1 } = await supabase.from('corridas').insert(fullPayload).select('id').single();
      if (e1) {
        // Retry with minimal columns (DB may not have pricing columns yet)
        const { data: d2, error: e2 } = await supabase.from('corridas').insert({
          cliente_id: user.id,
          origem_texto: o,
          destino_texto: d,
          status: 'aprovada',
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
          const precoDin = await calcularPreco(o, d);
          if (precoDin) {
            await salvarHistoricoPreco(corridaData.id, precoDin);
          }
        } catch {
          // non-critical
        }
      }

      toast({ title: 'Viagem registrada!', description: 'Sua corrida foi registrada com sucesso.' });
      setOrigem('');
      setDestino('');
      setObservacaoCliente('');
      setTemBagagem(false);
      setErrorMsg('');
    } catch (_e) {
      const msg = _e instanceof Error ? _e.message : 'Erro desconhecido';
      setErrorMsg(msg);
      toast({ title: 'Erro ao registrar viagem', description: msg, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-[3%]">
      <Card className="rounded-2xl">
        <CardContent className="pt-[5%] pb-[4%] px-[4%] space-y-[3.5%]">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
              <Navigation className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold">Solicitar Corrida</h2>
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
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                {filteredOrigens.slice(0, 15).map(o => (
                  <button
                    key={o}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
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
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                {filteredDestinos.slice(0, 15).map(d => (
                  <button
                    key={d}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
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

          {/* Baggage checkbox */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-2xl">
            <input
              type="checkbox"
              id="temBagagem"
              checked={temBagagem}
              onChange={(e) => setTemBagagem(e.target.checked)}
              className="w-5 h-5 rounded border-border bg-muted/50 text-accent focus:ring-accent"
            />
            <label htmlFor="temBagagem" className="text-sm cursor-pointer">
              <span className="font-medium">Levando Feira ou Bagagem?</span>
              <span className="text-muted-foreground"> (+R$ {(configTarifas?.taxa_bagagem ?? 5).toFixed(2).replace('.', ',')})</span>
            </label>
          </div>

          {/* -- Price preview: dinâmico > tabela RF -- */}
          <AnimatePresence>
            {(precoDinamico || precoTabela) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`${
                  precoDinamico
                    ? 'bg-blue-500/10 border-blue-500/20'
                    : precoTabela?.estimado
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : 'bg-green-500/10 border-green-500/20'
                } border rounded-xl p-[4%]`}
              >
                <div className="space-y-2">
                  {precoDinamico ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-blue-400" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">
                              Preço dinâmico
                            </p>
                            <p className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold text-blue-400">
                              R$ {precoDinamico.preco_base.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">
                            {precoDinamico.regra_horario
                              ? precoDinamico.ajuste_aplicado
                              : dynamicAdj
                                ? dynamicAdj.label
                                : 'Sem ajuste horário'}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                            {precoDinamico.origem_localidade?.nome} → {precoDinamico.destino_localidade?.nome}
                          </p>
                        </div>
                      </div>
                      {(precoDinamico.regra_horario || dynamicAdj) && (() => {
                        const _regra = precoDinamico.regra_horario || dynamicAdj?.regra;
                        const _cor = _regra?.cor || '#8b5cf6';
                        return (
                          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: `${_cor}15`, border: `1px solid ${_cor}30` }}>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" style={{ color: _cor }} />
                              <span className="text-xs text-muted-foreground">
                                {_regra?.nome}
                              </span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: _cor }}>
                              {_regra?.tipo_ajuste === 'percentual'
                                ? `+${_regra.valor_ajuste}%`
                                : `+R$ ${_regra?.valor_ajuste.toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })()}
                      {(precoDinamico.preco_base !== precoDinamico.preco_final || (!precoDinamico.regra_horario && dynamicAdj)) && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Base</span>
                          <span className="line-through">R$ {precoDinamico.preco_base.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  ) : precoTabela ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TableProperties className={`w-4 h-4 ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                          <div>
                            <p className="text-[10px] text-muted-foreground">
                              {precoTabela.estimado ? 'Preço estimado' : 'Preço tabelado'}
                            </p>
                            <p className={`text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                              R$ {precoTabela.valor.toFixed(2)}
                            </p>
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
                      {dynamicAdj && (() => {
                        const _cor = dynamicAdj.regra.cor || '#8b5cf6';
                        return (
                          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: `${_cor}15`, border: `1px solid ${_cor}30` }}>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" style={{ color: _cor }} />
                              <span className="text-xs text-muted-foreground">{dynamicAdj.regra.nome}</span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: _cor }}>
                              {dynamicAdj.regra.tipo_ajuste === 'percentual'
                                ? `+${dynamicAdj.regra.valor_ajuste}%`
                                : `+R$ ${dynamicAdj.regra.valor_ajuste.toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })()}
                      {dynamicAdj && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Base</span>
                          <span className="line-through">R$ {precoTabela.valor.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  ) : null}
                  {temBagagem && (
                    <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs">🧳</span>
                        <span className="text-xs text-muted-foreground">Taxa Feira/Bagagem</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">+R$ {(configTarifas?.taxa_bagagem ?? 5).toFixed(2)}</span>
                    </div>
                  )}
                  {(() => {
                    let rawTotal = precoDinamico
                      ? ((!precoDinamico.regra_horario && dynamicAdj) ? dynamicAdj.aplicar(precoDinamico.preco_final) : precoDinamico.preco_final)
                      : precoTabela
                        ? (dynamicAdj ? dynamicAdj.aplicar(precoTabela.valor) : precoTabela.valor)
                        : 0;
                    if (temBagagem) rawTotal += (configTarifas?.taxa_bagagem ?? 5);
                    const minima = configTarifas?.tarifa_minima ?? 0;
                    const usaMinima = minima > 0 && rawTotal > 0 && rawTotal < minima;
                    const valorFinal = usaMinima ? minima : rawTotal;
                    const showTotal = temBagagem || dynamicAdj || precoDinamico?.regra_horario || usaMinima;

                    if (!showTotal) return null;
                    return (
                      <>
                        <div className="flex items-center justify-between border-t border-border pt-2">
                          <span className="text-sm font-medium">Total da viagem</span>
                          <div className="flex items-center gap-2">
                            {usaMinima && (
                              <span className="text-xs text-muted-foreground line-through">R$ {rawTotal.toFixed(2)}</span>
                            )}
                            <span className={`text-lg font-bold ${
                              usaMinima ? 'text-yellow-400' : precoDinamico ? 'text-blue-400' : precoTabela?.estimado ? 'text-amber-400' : 'text-green-400'
                            }`}>
                              R$ {valorFinal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {usaMinima && (
                          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            <span className="text-xs text-yellow-400">Tarifa mínima aplicada</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
            disabled={!origem.trim() || !destino.trim() || isSending}
            className="w-full h-12 rounded-2xl text-base font-bold btn-themed"
          >
            {isSending ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Registrando...</>
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
