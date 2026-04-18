import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import AppShell from '@/components/AppShell';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, MapPin, DollarSign, CheckCircle, Loader2, Clock,
  MessageSquare, ChevronRight, TableProperties, AlertTriangle, Send,
  Copy, Check, Phone, User,
} from 'lucide-react';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas } from '@/lib/pricing-engine';
import { useToast } from '@/hooks/use-toast';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { openExternal, copyToClipboard } from '@/lib/native-helpers';

const MotoristaViagens: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { nomePlataforma } = usePlatformConfig();
  const queryClient = useQueryClient();
  const allLocations = useAllLocations();
  const destinoRef = useRef<HTMLInputElement>(null);

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [showOrigemSugg, setShowOrigemSugg] = useState(false);
  const [showDestinoSugg, setShowDestinoSugg] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showClienteInfo, setShowClienteInfo] = useState(false);

  const filteredOrigens = useMemo(() => {
    if (!origem.trim()) return allLocations;
    const q = normalizeText(origem);
    return allLocations.filter(o => normalizeText(o).includes(q));
  }, [origem, allLocations]);

  const filteredDestinos = useMemo(() => {
    if (!destino.trim()) return allLocations;
    const q = normalizeText(destino);
    return allLocations.filter(d => normalizeText(d).includes(q));
  }, [destino, allLocations]);

  const preco = usePrecoTabela(origem, destino);
  const dynamicAdj = useDynamicAdjustment();

  const { data: configTarifas } = useQuery<ConfigTarifas | null>({
    queryKey: ['config-tarifas-driver'],
    queryFn: () => getConfigTarifas(),
    staleTime: 10_000,
  });

  const taxaBagagemValor = configTarifas?.taxa_bagagem ?? 5;

  const totalValue = useMemo(() => {
    if (!preco) return 0;
    let total = preco.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima > 0 && total < minima) total = minima;
    return Math.round(total * 100) / 100;
  }, [preco, dynamicAdj, temBagagem, taxaBagagemValor, configTarifas]);

  const isTarifaMinima = useMemo(() => {
    if (!preco) return false;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima <= 0) return false;
    let total = preco.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    return total < minima;
  }, [preco, dynamicAdj, temBagagem, taxaBagagemValor, configTarifas]);

  const rawTotalValue = useMemo(() => {
    if (!preco) return 0;
    let total = preco.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    return Math.round(total * 100) / 100;
  }, [preco, dynamicAdj, temBagagem, taxaBagagemValor]);

  // ── Quote message ──
  const quoteMensagem = useMemo(() => {
    if (!preco || !origem.trim() || !destino.trim()) return '';
    const hasAdicionais = dynamicAdj || temBagagem;
    const lines: string[] = [
      `─────────────────────`,
      `  🚘 *${nomePlataforma}*`,
      `  _Orçamento de Viagem_`,
      `─────────────────────`,
    ];
    if (clienteNome.trim()) {
      lines.push(``, `👤 *Cliente:* ${clienteNome.trim()}`);
    }
    lines.push(``, `📍 *Origem:* ${origem.trim()}`, `🏁 *Destino:* ${destino.trim()}`);
    lines.push(``);
    if (hasAdicionais) {
      lines.push(`💰 *Detalhamento:*`);
      lines.push(`   Tarifa ${preco.estimado ? '(estimada)' : 'tabelada'}: R$ ${preco.valor.toFixed(2).replace('.', ',')}`);
      if (dynamicAdj) {
        const ajusteValor = dynamicAdj.aplicar(preco.valor) - preco.valor;
        lines.push(`   ⏰ ${dynamicAdj.regra.nome}: +R$ ${ajusteValor.toFixed(2).replace('.', ',')}`);
      }
      if (temBagagem) lines.push(`   📦 Feira/Bagagem: +R$ ${taxaBagagemValor.toFixed(2).replace('.', ',')}`);
      lines.push(`   ─────────────────`);
      lines.push(`   ✅ *Total: R$ ${totalValue.toFixed(2).replace('.', ',')}*`);
    } else {
      lines.push(`✅ *Valor: R$ ${totalValue.toFixed(2).replace('.', ',')}*${preco.estimado ? ' _(estimado)_' : ''}`);
    }
    if (observacao.trim()) lines.push(``, `📝 *Obs:* ${observacao.trim()}`);
    if (clienteNome.trim()) lines.push(``);
    lines.push(``, `─────────────────────`, `_${nomePlataforma} • Transporte com confiança_`);
    return lines.join('\n');
  }, [preco, origem, destino, clienteNome, observacao, totalValue, dynamicAdj, temBagagem, taxaBagagemValor]);

  const handleCopy = async () => {
    if (!quoteMensagem) return;
    const ok = await copyToClipboard(quoteMensagem);
    if (ok) {
      setCopied(true);
      toast({ title: 'Copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  // ── Registrar viagem como realizada ──
  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!preco || !user) throw new Error('Dados incompletos');
      const concluidaAt = new Date().toISOString();
      const { error } = await supabase.from('corridas').insert({
        cliente_id: user.id,
        motorista_id: user.id,
        origem_texto: origem.trim(),
        destino_texto: destino.trim(),
        valor: totalValue,
        valor_estimado: totalValue,
        status: 'em_analise',
        observacao_motorista: observacao.trim() || null,
        concluida_at: concluidaAt,
        tem_bagagem: temBagagem || null,
        preco_regra_aplicada: preco.estimado ? 'estimado' : 'tabela',
        preco_detalhes: {
          origem_tabela: preco.origem_tabela,
          destino_tabela: preco.destino_tabela,
          valor_base: preco.valor,
          cliente_nome: clienteNome.trim() || null,
          cliente_telefone: clienteTelefone.trim() || null,
          ...(dynamicAdj ? {
            ajuste_horario: dynamicAdj.label,
            regra_horario: dynamicAdj.regra.nome,
            cor_regra: (dynamicAdj.regra as any).cor || '#8b5cf6',
          } : {}),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Viagem registrada!', description: 'Aguardando aprovação do administrador.' });
      setOrigem('');
      setDestino('');
      setObservacao('');
      setTemBagagem(false);
      setClienteNome('');
      setClienteTelefone('');
      setShowRegistrar(false);
      setShowClienteInfo(false);
      queryClient.invalidateQueries({ queryKey: ['minhas-viagens-registradas'] });
      queryClient.invalidateQueries({ queryKey: ['meu-desempenho'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao registrar viagem', description: err.message, variant: 'destructive' });
    },
  });

  // ── Viagens registradas recentes ──
  const { data: minhasViagens } = useQuery({
    queryKey: ['minhas-viagens-registradas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, valor, status, concluida_at, created_at')
        .eq('motorista_id', user!.id)
        .eq('status', 'em_analise')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleClear = () => {
    setOrigem(''); setDestino(''); setObservacao('');
    setTemBagagem(false); setClienteNome(''); setClienteTelefone('');
    setShowRegistrar(false); setShowClienteInfo(false);
  };

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto space-y-[3%]">
        {/* Calculator */}
        <Card className="rounded-2xl">
          <CardContent className="pt-[5%] pb-[4%] px-[4%] space-y-[3.5%]">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
                <Calculator className="w-6 h-6 text-accent" />
              </div>
              <h2 className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold">Registrar Viagem</h2>
              <p className="text-xs text-muted-foreground">Registre viagens e faça orçamentos</p>
            </div>

            {/* Origem */}
            <div className="space-y-1.5 relative">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Origem
              </label>
              <Input
                value={origem}
                onChange={e => { setOrigem(e.target.value); setShowOrigemSugg(true); }}
                onFocus={() => setShowOrigemSugg(true)}
                onBlur={() => setTimeout(() => setShowOrigemSugg(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter') { setShowOrigemSugg(false); destinoRef.current?.focus(); } }}
                placeholder="De onde sai?"
                className="h-12 text-base"
              />
              {showOrigemSugg && filteredOrigens.length > 0 && origem.trim() && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredOrigens.slice(0, 15).map(loc => (
                    <button key={loc} type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setOrigem(loc); setShowOrigemSugg(false); destinoRef.current?.focus(); }}>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destino */}
            <div className="space-y-1.5 relative">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" /> Destino
              </label>
              <Input
                ref={destinoRef}
                value={destino}
                onChange={e => { setDestino(e.target.value); setShowDestinoSugg(true); }}
                onFocus={() => setShowDestinoSugg(true)}
                onBlur={() => setTimeout(() => setShowDestinoSugg(false), 200)}
                placeholder="Para onde vai?"
                className="h-12 text-base"
              />
              {showDestinoSugg && filteredDestinos.length > 0 && destino.trim() && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredDestinos.slice(0, 15).map(loc => (
                    <button key={loc} type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setDestino(loc); setShowDestinoSugg(false); }}>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                Observação <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Horário, ponto de referência..." className="resize-none text-sm min-h-[60px]" rows={2} />
            </div>

            {/* Bagagem */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <input type="checkbox" id="temBagagemViagem" checked={temBagagem} onChange={e => setTemBagagem(e.target.checked)} className="w-5 h-5 rounded border-border text-accent focus:ring-accent" />
              <label htmlFor="temBagagemViagem" className="text-sm cursor-pointer">
                <span className="font-medium">Feira ou Bagagem?</span>
                <span className="text-muted-foreground"> (+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')})</span>
              </label>
            </div>

            {/* Price preview */}
            <AnimatePresence>
              {preco && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className={`${preco.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-xl p-[4%]`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TableProperties className={`w-3.5 h-3.5 ${preco.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                        <div>
                          <p className="text-[10px] text-muted-foreground">{preco.estimado ? 'Preço estimado' : 'Preço tabelado'}</p>
                          <p className={`text-sm font-medium ${preco.estimado ? 'text-amber-400/80' : 'text-green-400/80'}`}>
                            R$ {preco.valor.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">
                          {preco.estimado ? 'Média via Centro do Cabo' : preco.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {preco.origem_tabela} → {preco.destino_tabela}
                        </p>
                      </div>
                    </div>
                    {dynamicAdj && (
                      <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs text-muted-foreground">{dynamicAdj.regra.nome}</span>
                        </div>
                        <span className="text-sm font-bold text-purple-400">
                          {dynamicAdj.regra.tipo_ajuste === 'fixo'
                            ? `+R$ ${dynamicAdj.regra.valor_ajuste.toFixed(2).replace('.', ',')}`
                            : `+${dynamicAdj.regra.valor_ajuste}%`}
                        </span>
                      </div>
                    )}
                    {temBagagem && (
                      <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400 text-xs">📦</span>
                          <span className="text-xs text-muted-foreground">Taxa Feira/Bagagem</span>
                        </div>
                        <span className="text-sm font-bold text-orange-400">R$ {taxaBagagemValor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    {isTarifaMinima && (
                      <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span className="text-xs text-yellow-400">Tarifa mínima aplicada</span>
                      </div>
                    )}
                    {/* Valor total em destaque */}
                    <div className="border-t border-border pt-3 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Valor Total</span>
                        <div className="flex items-center gap-2">
                          {isTarifaMinima && (
                            <span className="text-xs text-muted-foreground line-through">R$ {rawTotalValue.toFixed(2).replace('.', ',')}</span>
                          )}
                          <span className={`text-2xl font-extrabold ${isTarifaMinima ? 'text-yellow-400' : preco.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                            R$ {totalValue.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!preco && origem.trim() && destino.trim() && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-sm text-red-400">Rota não encontrada na tabela</p>
                <p className="text-[10px] text-muted-foreground">Verifique origem e destino</p>
              </div>
            )}

            {(origem || destino) && (
              <Button variant="ghost" size="sm" className="text-xs w-full" onClick={handleClear}>
                Limpar campos
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Send Quote + Register Trip */}
        <AnimatePresence>
          {preco && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              <Card className="rounded-2xl">
                <CardContent className="pt-[5%] pb-[4%] px-[4%] space-y-[3.5%]">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 mx-auto">
                      <Send className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-bold">Enviar Orçamento</h3>
                  </div>

                  {/* Toggle info do cliente */}
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <input type="checkbox" id="showClienteInfo" checked={showClienteInfo} onChange={e => setShowClienteInfo(e.target.checked)} className="w-5 h-5 rounded border-border text-accent focus:ring-accent" />
                    <label htmlFor="showClienteInfo" className="text-sm cursor-pointer">
                      <span className="font-medium">Adicionar informação do cliente</span>
                    </label>
                  </div>

                  <AnimatePresence>
                    {showClienteInfo && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-muted-foreground" /> Cliente
                            </label>
                            <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome" className="h-10" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Telefone
                            </label>
                            <Input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} placeholder="(81) 9xxxx-xxxx" className="h-10" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mensagem do orçamento */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Mensagem do Orçamento</p>
                    <div className="text-xs whitespace-pre-wrap leading-relaxed bg-muted/20 rounded-lg p-3 max-h-[100px] overflow-y-auto">
                      {quoteMensagem}
                    </div>
                  </div>

                  <Button className="w-full gap-2 h-11 rounded-xl font-semibold" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar Orçamento'}
                  </Button>

                  <Separator />

                  {/* Registrar como realizada */}
                  {!showRegistrar ? (
                    <Button
                      className="w-full gap-2 h-12 rounded-xl font-bold text-base btn-themed"
                      onClick={() => setShowRegistrar(true)}
                    >
                      <CheckCircle className="w-5 h-5" />
                      Registrar Viagem como Realizada
                    </Button>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 space-y-2">
                        <p className="text-sm font-bold text-accent flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Confirmar Registro
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A viagem será enviada para aprovação do administrador antes de ser contabilizada.
                        </p>

                        <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-xs">
                          <p><span className="text-muted-foreground">Origem:</span> {origem}</p>
                          <p><span className="text-muted-foreground">Destino:</span> {destino}</p>
                          <p><span className="text-muted-foreground">Valor:</span> <span className="text-green-400 font-bold">R$ {totalValue.toFixed(2).replace('.', ',')}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowRegistrar(false)}>Cancelar</Button>
                        <Button
                          className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white font-bold"
                          onClick={() => registrarMutation.mutate()}
                          disabled={registrarMutation.isPending}
                        >
                          {registrarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Confirmar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viagens registradas */}
        {minhasViagens && minhasViagens.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              Viagens em Análise
            </h3>
            <div className="space-y-2">
              {minhasViagens.map(ride => (
                <Card key={ride.id} className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(ride.concluida_at || ride.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        {ride.valor != null && (
                          <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
                            R$ {ride.valor.toFixed(2).replace('.', ',')}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 text-[10px]">
                          ⏳ Em Análise
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-xs truncate">{ride.origem_texto}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span className="text-xs truncate">{ride.destino_texto}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaViagens;
