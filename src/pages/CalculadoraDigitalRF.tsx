import React, { useState, useRef, useMemo } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Copy, Check, Clock, Send,
  TableProperties, Zap, AlertTriangle, MessageCircle, Car,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calcularPreco, getConfigTarifas, getActiveTimeRule, applyTimeAdjustment, type PricingResult, type ConfigTarifas } from '@/lib/pricing-engine';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';

const CalculadoraDigitalRF: React.FC = () => {
  const { toast } = useToast();

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [observacao, setObservacao] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const [passageiros, setPassageiros] = useState('1');
  const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false);
  const [showDestinoSuggestions, setShowDestinoSuggestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mensagemGerada, setMensagemGerada] = useState('');
  const destinoRef = useRef<HTMLInputElement>(null);

  // ── Tabela de preço: lookup reativo ──
  const precoTabela = usePrecoTabela(origem, destino);

  // ── Regra de horário dinâmica ──
  const dynamicAdj = useDynamicAdjustment();

  // ── Configuração global de tarifas ──
  const { data: configTarifas } = useQuery<ConfigTarifas | null>({
    queryKey: ['config-tarifas-calc'],
    queryFn: () => getConfigTarifas(),
    staleTime: 10_000,
  });

  // ── Motor dinâmico ──
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

  // ── Calcula valor final para exibição ──
  const valorFinal = useMemo(() => {
    let valor = 0;
    if (precoDinamico) {
      valor = precoDinamico.preco_final;
      if (!precoDinamico.regra_horario && dynamicAdj) valor = dynamicAdj.aplicar(valor);
    } else if (precoTabela) {
      valor = precoTabela.valor;
      if (dynamicAdj) valor = dynamicAdj.aplicar(valor);
    } else {
      return null;
    }
    if (temBagagem) valor += (configTarifas?.taxa_bagagem ?? 5);
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima > 0 && valor < minima) valor = minima;
    return Math.round(valor * 100) / 100;
  }, [precoDinamico, precoTabela, dynamicAdj, temBagagem, configTarifas]);

  // ── Gerar mensagem WhatsApp ──
  const gerarMensagem = () => {
    const o = origem.trim();
    const d = destino.trim();
    if (!o || !d) {
      toast({ title: 'Preencha origem e destino', variant: 'destructive' });
      return;
    }

    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR');
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let msg = `🚗 *SOLICITAÇÃO DE CORRIDA - RF Driver*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (nomeCliente.trim()) msg += `👤 *Cliente:* ${nomeCliente.trim()}\n`;
    if (telefoneCliente.trim()) msg += `📱 *Telefone:* ${telefoneCliente.trim()}\n`;
    msg += `📍 *Origem:* ${o}\n`;
    msg += `🏁 *Destino:* ${d}\n`;
    if (parseInt(passageiros) > 1) msg += `👥 *Passageiros:* ${passageiros}\n`;
    if (temBagagem) msg += `📦 *Bagagem/Feira:* Sim\n`;
    if (observacao.trim()) msg += `💬 *Obs:* ${observacao.trim()}\n`;
    msg += `\n`;
    if (valorFinal != null) {
      msg += `💰 *Valor: R$ ${valorFinal.toFixed(2).replace('.', ',')}*\n`;
      if (dynamicAdj) {
        msg += `⏰ ${dynamicAdj.label}\n`;
      }
      if (temBagagem) {
        msg += `📦 +R$ ${(configTarifas?.taxa_bagagem ?? 5).toFixed(2).replace('.', ',')} (bagagem)\n`;
      }
    }
    msg += `\n📅 ${dataStr} às ${horaStr}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_Calculadora Digital RF Driver_`;

    setMensagemGerada(msg);
    return msg;
  };

  const copiarMensagem = () => {
    const msg = mensagemGerada || gerarMensagem();
    if (!msg) return;
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      toast({ title: 'Mensagem copiada!' });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const enviarWhatsApp = () => {
    const msg = mensagemGerada || gerarMensagem();
    if (!msg) return;
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E06616] to-[#ff8a3d] flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">RF Driver</h1>
            <p className="text-[10px] text-white/50">Calculadora Digital</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Form Card */}
        <Card className="rounded-2xl bg-white/[0.03] border-white/[0.06]">
          <CardContent className="pt-5 pb-4 px-4 space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E06616]/10 mx-auto">
                <Navigation className="w-6 h-6 text-[#E06616]" />
              </div>
              <h2 className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold">Calculadora de Corrida</h2>
              <p className="text-xs text-white/50">
                Calcule o valor e envie pelo WhatsApp
              </p>
            </div>

            {/* Nome do cliente */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                👤 Nome <span className="text-xs text-white/40 font-normal">(opcional)</span>
              </label>
              <Input
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Nome do passageiro"
                className="h-11 text-base bg-white/[0.04] border-white/[0.08]"
              />
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                📱 Telefone <span className="text-xs text-white/40 font-normal">(opcional)</span>
              </label>
              <Input
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(e.target.value)}
                placeholder="(81) 99999-9999"
                className="h-11 text-base bg-white/[0.04] border-white/[0.08]"
              />
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
                <div className="w-2.5 h-2.5 rounded-full bg-[#E06616]" />
                Destino
              </label>
              <Input
                ref={destinoRef}
                value={destino}
                onChange={(e) => { setDestino(e.target.value); setShowDestinoSuggestions(true); setMensagemGerada(''); }}
                onFocus={() => setShowDestinoSuggestions(true)}
                onBlur={() => setTimeout(() => setShowDestinoSuggestions(false), 200)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowDestinoSuggestions(false); }}
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

            {/* Passageiros */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                👥 Passageiros
              </label>
              <div className="flex gap-2">
                {['1', '2', '3', '4'].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPassageiros(n)}
                    className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all ${
                      passageiros === n
                        ? 'bg-[#E06616] text-white shadow-lg shadow-[#E06616]/30'
                        : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                💬 Observação <span className="text-xs text-white/40 font-normal">(opcional)</span>
              </label>
              <Textarea
                value={observacao}
                onChange={(e) => { setObservacao(e.target.value); setMensagemGerada(''); }}
                placeholder="Ponto de referência, instruções..."
                className="resize-none text-sm min-h-[60px] bg-white/[0.04] border-white/[0.08]"
                rows={2}
              />
            </div>

            {/* Bagagem */}
            <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <input
                type="checkbox"
                id="temBagagemCalc"
                checked={temBagagem}
                onChange={(e) => { setTemBagagem(e.target.checked); setMensagemGerada(''); }}
                className="w-5 h-5 rounded border-white/[0.15] bg-white/[0.05] text-[#E06616] focus:ring-[#E06616]"
              />
              <label htmlFor="temBagagemCalc" className="text-sm cursor-pointer">
                <span className="font-medium">Levando Feira ou Bagagem?</span>
                <span className="text-white/50"> (+R$ {(configTarifas?.taxa_bagagem ?? 5).toFixed(2).replace('.', ',')})</span>
              </label>
            </div>

            {/* ── Price preview ── */}
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
                  } border rounded-xl p-4`}
                >
                  <div className="space-y-2">
                    {precoDinamico ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="text-[10px] text-white/50">Preço dinâmico</p>
                              <p className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold text-blue-400">
                                R$ {(() => {
                                  let v = precoDinamico.preco_final;
                                  if (!precoDinamico.regra_horario && dynamicAdj) v = dynamicAdj.aplicar(v);
                                  return v.toFixed(2);
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-white/50">
                              {precoDinamico.regra_horario
                                ? precoDinamico.ajuste_aplicado
                                : dynamicAdj
                                  ? dynamicAdj.label
                                  : 'Sem ajuste horário'}
                            </p>
                            <p className="text-[10px] text-white/50 truncate max-w-[160px]">
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
                              <p className={`text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold ${precoTabela.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                                R$ {(() => {
                                  let v = precoTabela.valor;
                                  if (dynamicAdj) v = dynamicAdj.aplicar(v);
                                  return v.toFixed(2);
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-white/50">
                              {precoTabela.estimado ? 'Média via Centro do Cabo' : precoTabela.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                            </p>
                            <p className="text-[10px] text-white/50 truncate max-w-[160px]">
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
                    {/* Total */}
                    {valorFinal != null && (temBagagem || dynamicAdj || precoDinamico?.regra_horario) && (
                      <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                        <span className="text-sm font-medium">Total da viagem</span>
                        <span className={`text-lg font-bold ${precoDinamico ? 'text-blue-400' : precoTabela?.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                          R$ {valorFinal.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botões de ação */}
            <div className="space-y-2.5 pt-1">
              <Button
                onClick={() => { gerarMensagem(); enviarWhatsApp(); }}
                disabled={!origem.trim() || !destino.trim()}
                className="w-full h-12 rounded-2xl text-base font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg shadow-[#25D366]/30 transition-all"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Enviar pelo WhatsApp
              </Button>

              <Button
                onClick={() => { gerarMensagem(); copiarMensagem(); }}
                disabled={!origem.trim() || !destino.trim()}
                variant="outline"
                className="w-full h-11 rounded-2xl text-sm font-semibold border-white/[0.1] hover:bg-white/[0.05]"
              >
                {copied ? (
                  <><Check className="w-4 h-4 mr-2 text-green-400" />Copiado!</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" />Copiar Mensagem</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview da mensagem */}
        <AnimatePresence>
          {mensagemGerada && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Card className="rounded-2xl bg-white/[0.03] border-white/[0.06]">
                <CardContent className="pt-4 pb-3 px-4 space-y-2">
                  <p className="text-xs font-medium text-white/40">Prévia da mensagem</p>
                  <pre className="text-xs text-white/70 whitespace-pre-wrap font-sans leading-relaxed bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                    {mensagemGerada}
                  </pre>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-white/25">
            RF Driver © {new Date().getFullYear()} — Calculadora Digital
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalculadoraDigitalRF;
