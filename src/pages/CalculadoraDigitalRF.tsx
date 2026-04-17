import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation, Copy, Check, Clock, ArrowRight, ArrowLeft,
  TableProperties, Zap, MessageCircle, Car, Package,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { openExternal, copyToClipboard } from '@/lib/native-helpers';
import { calcularPreco, getConfigTarifas, type PricingResult, type ConfigTarifas } from '@/lib/pricing-engine';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';

const STEPS = [
  { label: 'Rota', icon: '📍' },
  { label: 'Valor', icon: '💰' },
  { label: 'Enviar', icon: '📲' },
] as const;

const CalculadoraDigitalRF: React.FC = () => {
  const { toast } = useToast();
  const { nomePlataforma } = usePlatformConfig();

  const [etapa, setEtapa] = useState(0);
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false);
  const [showDestinoSuggestions, setShowDestinoSuggestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mensagemGerada, setMensagemGerada] = useState('');
  const destinoRef = useRef<HTMLInputElement>(null);

  // ── Tabela de preço ──
  const precoTabela = usePrecoTabela(origem, destino);
  const dynamicAdj = useDynamicAdjustment();

  const { data: configTarifas } = useQuery<ConfigTarifas | null>({
    queryKey: ['config-tarifas-calc'],
    queryFn: () => getConfigTarifas(),
    staleTime: 10_000,
  });

  const origemTrim = origem.trim();
  const destinoTrim = destino.trim();
  const { data: precoDinamico } = useQuery<PricingResult | null>({
    queryKey: ['preco-dinamico', origemTrim, destinoTrim],
    queryFn: () => calcularPreco(origemTrim, destinoTrim),
    enabled: !!origemTrim && !!destinoTrim,
    staleTime: 10_000,
  });

  // ── Autocomplete ──
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

  // ── Valor final ──
  const { valorFinal, isTarifaMinima } = useMemo(() => {
    let valor = 0;
    if (precoDinamico) {
      valor = precoDinamico.preco_final;
      if (!precoDinamico.regra_horario && dynamicAdj) valor = dynamicAdj.aplicar(valor);
    } else if (precoTabela) {
      valor = precoTabela.valor;
      if (dynamicAdj) valor = dynamicAdj.aplicar(valor);
    } else {
      return { valorFinal: null, isTarifaMinima: false };
    }
    if (temBagagem) valor += (configTarifas?.taxa_bagagem ?? 5);
    const minima = configTarifas?.tarifa_minima ?? 0;
    const isMin = minima > 0 && valor < minima;
    if (isMin) valor = minima;
    return { valorFinal: Math.round(valor * 100) / 100, isTarifaMinima: isMin };
  }, [precoDinamico, precoTabela, dynamicAdj, temBagagem, configTarifas]);

  const temPreco = !!(precoDinamico || precoTabela);

  // ── Gerar mensagem ──
  const gerarMensagem = () => {
    const o = origem.trim();
    const d = destino.trim();
    if (!o || !d) return '';

    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR');
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let msg = `🚗 *VIAGENS - ${nomePlataforma}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `📍 *Origem:* ${o}\n`;
    msg += `🏁 *Destino:* ${d}\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (valorFinal != null) {
      // Valor base da corrida (sem adicionais de horário e bagagem)
      const valorCorrida = precoTabela?.valor ?? (precoDinamico?.preco_final ?? 0);
      const taxaBagagem = configTarifas?.taxa_bagagem ?? 5;
      msg += `💰 Valor Corrida: R$ ${valorCorrida.toFixed(2).replace('.', ',')} \n`;
      if (dynamicAdj) {
        const ajusteValor = dynamicAdj.aplicar(valorCorrida) - valorCorrida;
        msg += `_🌙 +R$ ${ajusteValor.toFixed(2).replace('.', ',')} ${dynamicAdj.regra.nome}_\n`;
      }
      if (temBagagem) msg += `_🛒 +R$ ${taxaBagagem.toFixed(2).replace('.', ',')} Adicional Bagagem/Feira_\n`;
      if (isTarifaMinima) msg += `_⚠️ Tarifa mínima aplicada_\n`;
      msg += `\n`;
      msg += `💵 *Total: R$ ${valorFinal.toFixed(2).replace('.', ',')}*\n`;
    }
    msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 ${dataStr} às ${horaStr} \n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_Calculadora Digital - ${nomePlataforma}_`;

    setMensagemGerada(msg);
    return msg;
  };

  const copiarMensagem = async () => {
    const msg = mensagemGerada || gerarMensagem();
    if (!msg) return;
    const ok = await copyToClipboard(msg);
    if (ok) {
      setCopied(true);
      toast({ title: 'Mensagem copiada!' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const enviarWhatsApp = () => {
    const msg = mensagemGerada || gerarMensagem();
    if (!msg) return;
    const encoded = encodeURIComponent(msg);
    openExternal(`https://api.whatsapp.com/send?text=${encoded}`);
  };

  const podeAvancar = etapa === 0 ? (!!origemTrim && !!destinoTrim) : etapa === 1 ? temPreco : false;

  const avancar = () => {
    if (etapa === 0 && !origemTrim) { toast({ title: 'Informe a origem', variant: 'destructive' }); return; }
    if (etapa === 0 && !destinoTrim) { toast({ title: 'Informe o destino', variant: 'destructive' }); return; }
    if (etapa < 2) {
      if (etapa === 1) gerarMensagem();
      setEtapa(e => e + 1);
    }
  };

  const voltar = () => {
    if (etapa > 0) setEtapa(e => e - 1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full gradient-accent flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">{nomePlataforma}</h1>
            <p className="text-[10px] text-white/50">Calculadora Digital</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((step, i) => (
            <React.Fragment key={i}>
              <button
                type="button"
                onClick={() => { if (i < etapa) setEtapa(i); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  i === etapa
                    ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/30'
                    : i < etapa
                      ? 'bg-accent/20 text-accent cursor-pointer'
                      : 'bg-white/[0.04] text-white/30'
                }`}
              >
                <span>{step.icon}</span>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 rounded-full ${i < etapa ? 'bg-accent/40' : 'bg-white/[0.06]'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ═══════════ ETAPA 1: Origem e Destino ═══════════ */}
        <AnimatePresence mode="wait">
          {etapa === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="rounded-2xl bg-white/[0.03] border-white/[0.06]">
                <CardContent className="pt-5 pb-4 px-4 space-y-4">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
                      <Navigation className="w-6 h-6 text-accent" />
                    </div>
                    <h2 className="text-lg font-bold">Para onde vai?</h2>
                    <p className="text-xs text-white/50">Escolha a origem e o destino</p>
                  </div>

                  {/* Origem */}
                  <div className="space-y-1.5 relative">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      Origem
                    </label>
                    <Input
                      value={origem}
                      onChange={(e) => { setOrigem(e.target.value); setShowOrigemSuggestions(true); setMensagemGerada(''); }}
                      onFocus={() => setShowOrigemSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowOrigemSuggestions(false), 200)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setShowOrigemSuggestions(false); destinoRef.current?.focus(); } }}
                      placeholder="De onde sai?"
                      className="h-12 text-base bg-white/[0.04] border-white/[0.08]"
                    />
                    {showOrigemSuggestions && filteredOrigens.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-[hsl(0_0%_10%)] border border-white/[0.08] rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                        {filteredOrigens.slice(0, 15).map(o => (
                          <button
                            key={o}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setOrigem(o); setShowOrigemSuggestions(false); setMensagemGerada(''); destinoRef.current?.focus(); }}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Destino */}
                  <div className="space-y-1.5 relative">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                      Destino
                    </label>
                    <Input
                      ref={destinoRef}
                      value={destino}
                      onChange={(e) => { setDestino(e.target.value); setShowDestinoSuggestions(true); setMensagemGerada(''); }}
                      onFocus={() => setShowDestinoSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowDestinoSuggestions(false), 200)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && podeAvancar) { setShowDestinoSuggestions(false); avancar(); } }}
                      placeholder="Para onde vai?"
                      className="h-12 text-base bg-white/[0.04] border-white/[0.08]"
                    />
                    {showDestinoSuggestions && filteredDestinos.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-[hsl(0_0%_10%)] border border-white/[0.08] rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                        {filteredDestinos.slice(0, 15).map(d => (
                          <button
                            key={d}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setDestino(d); setShowDestinoSuggestions(false); setMensagemGerada(''); }}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={avancar}
                    disabled={!podeAvancar}
                    className="w-full h-12 rounded-2xl text-base font-bold btn-themed"
                  >
                    Calcular Valor <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ═══════════ ETAPA 2: Valor + Bagagem ═══════════ */}
          {etapa === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="rounded-2xl bg-white/[0.03] border-white/[0.06]">
                <CardContent className="pt-5 pb-4 px-4 space-y-4">
                  {/* Resumo da rota */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-white/70 truncate">{origem}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-white/70 truncate">{destino}</span>
                    </div>
                  </div>

                  {/* Bagagem */}
                  <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                    <input
                      type="checkbox"
                      id="temBagagemCalc"
                      checked={temBagagem}
                      onChange={(e) => { setTemBagagem(e.target.checked); setMensagemGerada(''); }}
                      className="w-5 h-5 rounded border-white/[0.15] bg-white/[0.05] text-accent focus:ring-accent"
                    />
                    <label htmlFor="temBagagemCalc" className="text-sm cursor-pointer">
                      <span className="font-medium">Levando Feira ou Bagagem?</span>
                      <span className="text-white/50"> (+R$ {(configTarifas?.taxa_bagagem ?? 5).toFixed(2).replace('.', ',')})</span>
                    </label>
                  </div>

                  {/* Price preview */}
                  {(precoDinamico || precoTabela) ? (
                    <div className={`${
                      precoDinamico
                        ? 'bg-blue-500/10 border-blue-500/20'
                        : precoTabela?.estimado
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-green-500/10 border-green-500/20'
                    } border rounded-xl p-4`}>
                      <div className="space-y-2">
                        {precoDinamico ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-blue-400" />
                                <div>
                                  <p className="text-[10px] text-white/50">Preço dinâmico</p>
                                  <p className="text-[clamp(1.3rem,4vw,1.6rem)] font-bold text-blue-400">
                                    R$ {precoDinamico.preco_base.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-white/50">
                                  {precoDinamico.regra_horario
                                    ? precoDinamico.ajuste_aplicado
                                    : dynamicAdj ? dynamicAdj.label : 'Sem ajuste horário'}
                                </p>
                                <p className="text-[10px] text-white/50 truncate max-w-[140px]">
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
                                    <span className="text-xs text-white/50">{_regra?.nome}</span>
                                  </div>
                                  <span className="text-sm font-bold" style={{ color: _cor }}>
                                    {_regra?.tipo_ajuste === 'percentual'
                                      ? `+${_regra.valor_ajuste}%`
                                      : `+R$ ${_regra?.valor_ajuste.toFixed(2)}`}
                                  </span>
                                </div>
                              );
                            })()}
                          </>
                        ) : precoTabela ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TableProperties className={`w-4 h-4 ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                                <div>
                                  <p className="text-[10px] text-white/50">
                                    {precoTabela.estimado ? 'Preço estimado' : 'Preço tabelado'}
                                  </p>
                                  <p className={`text-[clamp(1.3rem,4vw,1.6rem)] font-bold ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                                    R$ {precoTabela.valor.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-white/50">
                                  {precoTabela.estimado ? 'Média via Centro do Cabo' : precoTabela.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                                </p>
                              </div>
                            </div>

                            {dynamicAdj && (() => {
                              const _cor = dynamicAdj.regra.cor || '#8b5cf6';
                              return (
                                <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: `${_cor}15`, border: `1px solid ${_cor}30` }}>
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" style={{ color: _cor }} />
                                    <span className="text-xs text-white/50">{dynamicAdj.regra.nome}</span>
                                  </div>
                                  <span className="text-sm font-bold" style={{ color: _cor }}>
                                    {dynamicAdj.regra.tipo_ajuste === 'percentual'
                                      ? `+${dynamicAdj.regra.valor_ajuste}%`
                                      : `+R$ ${dynamicAdj.regra.valor_ajuste.toFixed(2)}`}
                                  </span>
                                </div>
                              );
                            })()}
                          </>
                        ) : null}
                        {temBagagem && (
                          <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-orange-400 text-xs">📦</span>
                              <span className="text-xs text-white/50">Taxa Feira/Bagagem</span>
                            </div>
                            <span className="text-sm font-bold text-orange-400">+R$ {(configTarifas?.taxa_bagagem ?? 5).toFixed(2)}</span>
                          </div>
                        )}
                        {isTarifaMinima && (
                          <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-400 text-xs">⚠️</span>
                              <span className="text-xs text-white/50">Tarifa mínima aplicada</span>
                            </div>
                            <span className="text-sm font-bold text-yellow-400">R$ {(configTarifas?.tarifa_minima ?? 0).toFixed(2)}</span>
                          </div>
                        )}
                        {valorFinal != null && (temBagagem || dynamicAdj || precoDinamico?.regra_horario || isTarifaMinima) && (
                          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                            <span className="text-sm font-medium">Total da viagem</span>
                            <span className={`text-lg font-bold ${precoDinamico ? 'text-blue-400' : precoTabela?.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                              R$ {valorFinal.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-white/30 text-sm">
                      Nenhum preço encontrado para esta rota
                    </div>
                  )}

                  {/* Navegar */}
                  <div className="flex gap-2">
                    <Button onClick={voltar} variant="outline" className="h-11 rounded-2xl border-white/[0.1] hover:bg-white/[0.05] px-4">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                    </Button>
                    <Button
                      onClick={avancar}
                      disabled={!temPreco}
                      className="flex-1 h-11 rounded-2xl text-base font-bold btn-themed"
                    >
                      Gerar Mensagem <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ═══════════ ETAPA 3: Mensagem + Enviar ═══════════ */}
          {etapa === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="rounded-2xl bg-white/[0.03] border-white/[0.06]">
                <CardContent className="pt-5 pb-4 px-4 space-y-4">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#25D366]/10 mx-auto">
                      <MessageCircle className="w-6 h-6 text-[#25D366]" />
                    </div>
                    <h2 className="text-lg font-bold">Mensagem Pronta</h2>
                    <p className="text-xs text-white/50">Envie no grupo de motoristas</p>
                  </div>

                  {/* Prévia */}
                  <pre className="text-xs text-white/70 whitespace-pre-wrap font-sans leading-relaxed bg-white/[0.02] rounded-xl p-3 border border-white/[0.04] max-h-64 overflow-y-auto">
                    {mensagemGerada}
                  </pre>

                  {/* Botões */}
                  <div className="space-y-2.5">
                    <Button
                      onClick={enviarWhatsApp}
                      className="w-full h-12 rounded-2xl text-base font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg shadow-[#25D366]/30 transition-all"
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Enviar pelo WhatsApp
                    </Button>

                    <Button
                      onClick={copiarMensagem}
                      variant="outline"
                      className="w-full h-11 rounded-2xl text-sm font-semibold border-white/[0.1] hover:bg-white/[0.05]"
                    >
                      {copied ? (
                        <><Check className="w-4 h-4 mr-2 text-green-400" />Copiado!</>
                      ) : (
                        <><Copy className="w-4 h-4 mr-2" />Copiar Mensagem</>
                      )}
                    </Button>

                    <Button
                      onClick={() => { setEtapa(0); setOrigem(''); setDestino(''); setTemBagagem(false); setMensagemGerada(''); }}
                      variant="ghost"
                      className="w-full h-10 rounded-2xl text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                    >
                      Nova Consulta
                    </Button>
                  </div>

                  <Button onClick={voltar} variant="outline" className="w-full h-10 rounded-2xl border-white/[0.1] hover:bg-white/[0.05] text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-center py-4 space-y-2">
          <button
            onClick={() => { window.location.hash = '/'; }}
            className="text-[11px] text-white/30 hover:text-[hsl(45_100%_50%)] transition-colors flex items-center gap-1.5 mx-auto"
          >
            🔑 Acessar Painel
          </button>
          <button
            onClick={() => { window.location.hash = '/'; }}
            className="text-[11px] text-white/30 hover:text-white/50 transition-colors flex items-center gap-1.5 mx-auto"
          >
            ← Sair
          </button>
          <p className="text-[10px] text-white/25">
            {nomePlataforma} © {new Date().getFullYear()} — Calculadora Digital
          </p>
          <p className="text-[10px] text-white/25">
            ・desenvolvido por <span className="font-bold">malaca</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalculadoraDigitalRF;
