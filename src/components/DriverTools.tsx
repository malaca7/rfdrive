import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Calculator, MapPin, Navigation, DollarSign, Send, Check, Copy,
  Car, Phone, Star, User, Shield, Clock, MessageSquare, ChevronRight, TableProperties,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
interface DriverProfile {
  id: string;
  nome: string;
  telefone: string;
  tipo: string;
  status: string;
  veiculo_marca?: string | null;
  veiculo_modelo?: string | null;
  veiculo_cor?: string | null;
  veiculo_placa?: string | null;
}

interface DriverToolsProps {
  profile: DriverProfile;
  avgRating: { avg: number; count: number } | null;
  completedCount: number;
}

// ═══════════════════════════════════════════════
// Trip Calculator
// ═══════════════════════════════════════════════
export const TripCalculator: React.FC<{
  onSendQuote?: (data: { origem: string; destino: string; valor: number; mensagem: string }) => void;
}> = ({ onSendQuote }) => {
  const { toast } = useToast();
  const allLocations = useAllLocations();

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [showOrigemSugg, setShowOrigemSugg] = useState(false);
  const [showDestinoSugg, setShowDestinoSugg] = useState(false);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const [copied, setCopied] = useState(false);
  const destinoRef = useRef<HTMLInputElement>(null);

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

  const totalValue = useMemo(() => {
    if (!preco) return 0;
    let total = preco.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += 5;
    return Math.round(total * 100) / 100;
  }, [preco, dynamicAdj, temBagagem]);

  const quoteMensagem = useMemo(() => {
    if (!preco || !origem.trim() || !destino.trim()) return '';
    const lines = [
      `🚗 *Orçamento RF Drive*`,
      ``,
      `📍 *Origem:* ${origem.trim()}`,
      `📍 *Destino:* ${destino.trim()}`,
      `💰 *Valor:* R$ ${totalValue.toFixed(2)}`,
      preco.estimado ? `_(valor estimado)_` : '',
    ];
    if (dynamicAdj) lines.push(`⏰ ${dynamicAdj.label}`);
    if (temBagagem) lines.push(`📦 Taxa feira/bagagem: +R$ 5,00`);
    lines.push(``);
    if (clienteNome.trim()) lines.push(`👤 *Cliente:* ${clienteNome.trim()}`);
    if (observacao.trim()) lines.push(`📝 *Obs:* ${observacao.trim()}`);
    lines.push(``, `_Consulta feita pela Tabela RF Drive_`);
    return lines.filter(Boolean).join('\n');
  }, [preco, origem, destino, clienteNome, observacao, totalValue, dynamicAdj, temBagagem]);

  const handleCopy = async () => {
    if (!quoteMensagem) return;
    try {
      await navigator.clipboard.writeText(quoteMensagem);
      setCopied(true);
      toast({ title: 'Copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleWhatsApp = () => {
    if (!quoteMensagem) return;
    const phone = clienteTelefone.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(quoteMensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(quoteMensagem)}`;
    window.open(url, '_blank');
  };

  const handleSendQuote = () => {
    if (!preco) return;
    onSendQuote?.({ origem: origem.trim(), destino: destino.trim(), valor: totalValue, mensagem: quoteMensagem });
    toast({ title: 'Orçamento enviado!' });
  };

  const handleClear = () => {
    setOrigem('');
    setDestino('');
    setClienteNome('');
    setClienteTelefone('');
    setObservacao('');
    setTemBagagem(false);
  };

  return (
    <div className="space-y-[3%]">
      <Card className="rounded-2xl">
        <CardContent className="pt-[5%] pb-[4%] px-[4%] space-y-[3.5%]">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
              <Calculator className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold">Calcular Viagem</h2>
            <p className="text-xs text-muted-foreground">
              Consulte o valor e envie o orçamento
            </p>
          </div>

          {/* Origem */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Origem
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
                  <button
                    key={loc}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setOrigem(loc); setShowOrigemSugg(false); destinoRef.current?.focus(); }}
                  >
                    {loc}
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
              onChange={e => { setDestino(e.target.value); setShowDestinoSugg(true); }}
              onFocus={() => setShowDestinoSugg(true)}
              onBlur={() => setTimeout(() => setShowDestinoSugg(false), 200)}
              placeholder="Para onde vai?"
              className="h-12 text-base"
            />
            {showDestinoSugg && filteredDestinos.length > 0 && destino.trim() && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredDestinos.slice(0, 15).map(loc => (
                  <button
                    key={loc}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setDestino(loc); setShowDestinoSugg(false); }}
                  >
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
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Horário, ponto de referência..."
              className="resize-none text-sm min-h-[60px]"
              rows={2}
            />
          </div>

          {/* Bagagem */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="temBagagemCalc"
              checked={temBagagem}
              onChange={e => setTemBagagem(e.target.checked)}
              className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
            />
            <label htmlFor="temBagagemCalc" className="text-sm cursor-pointer">
              <span className="font-medium">Feira ou Bagagem?</span>
              <span className="text-muted-foreground"> (+R$ 5,00)</span>
            </label>
          </div>

          {/* Price preview */}
          <AnimatePresence>
            {preco && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`${preco.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-xl p-[4%]`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableProperties className={`w-4 h-4 ${preco.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          {preco.estimado ? 'Preço estimado' : 'Preço tabelado'}
                        </p>
                        <p className={`text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold ${preco.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                          R$ {preco.valor.toFixed(2)}
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
                        {dynamicAdj.regra.tipo_ajuste === 'percentual'
                          ? `+${dynamicAdj.regra.valor_ajuste}%`
                          : `+R$ ${dynamicAdj.regra.valor_ajuste.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  {temBagagem && (
                    <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs">📦</span>
                        <span className="text-xs text-muted-foreground">Taxa Feira/Bagagem</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">R$ 5,00</span>
                    </div>
                  )}
                  {(dynamicAdj || temBagagem) && (
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="text-sm font-medium">Total</span>
                      <span className={`text-lg font-bold ${preco.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                        R$ {totalValue.toFixed(2)}
                      </span>
                    </div>
                  )}
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

      {/* Send Quote */}
      <AnimatePresence>
        {preco && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <Card className="rounded-2xl">
              <CardContent className="pt-[5%] pb-[4%] px-[4%] space-y-[3.5%]">
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 mx-auto">
                    <Send className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-bold">Enviar Orçamento</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      Cliente
                    </label>
                    <Input
                      value={clienteNome}
                      onChange={e => setClienteNome(e.target.value)}
                      placeholder="Nome (opcional)"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      Telefone
                    </label>
                    <Input
                      value={clienteTelefone}
                      onChange={e => setClienteTelefone(e.target.value)}
                      placeholder="(81) 9xxxx-xxxx"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-muted/30 rounded-xl p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                  {quoteMensagem}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline" className="flex-1 gap-1.5 h-11 rounded-xl font-semibold"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                  <Button
                    className="flex-1 gap-1.5 h-11 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
                    onClick={handleWhatsApp}
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════
// Driver Badge / Credential Card
// ═══════════════════════════════════════════════
export const DriverBadge: React.FC<DriverToolsProps> = ({ profile, avgRating, completedCount }) => {
  const { toast } = useToast();
  const badgeRef = useRef<HTMLDivElement>(null);
  const hasVehicle = profile.veiculo_marca || profile.veiculo_placa;

  const handleShare = async () => {
    if (!badgeRef.current) return;
    
    try {
      const canvas = await html2canvas(badgeRef.current, {
        scale: 2,
        backgroundColor: '#1a1a1a',
        logging: false,
      });
      
      const imageDataUrl = canvas.toDataURL('image/png');
      
      // Tentar compartilhar como imagem
      if (navigator.share) {
        // Converter para blob para compartilhamento nativo
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'cracha-rf-drive.png', { type: 'image/png' });
        
        try {
          await navigator.share({
            title: 'RF Drive - Crachá',
            files: [file],
          });
          return;
        } catch {
          // Se compartilhamento de arquivos não funcionar, fallback para texto
        }
      }
      
      // Fallback: baixar imagem ou copiar para clipboard
      const link = document.createElement('a');
      link.href = imageDataUrl;
      link.download = 'cracha-rf-drive.png';
      link.click();
      
      toast({ title: 'Crachá baixado!' });
    } catch {
      // Fallback para texto se html2canvas falhar
      const text = [
        `🚗 RF Drive - Motorista Credenciado`,
        `👤 ${profile.nome}`,
        `📱 ${profile.telefone}`,
        hasVehicle ? `🚘 ${profile.veiculo_marca || ''} ${profile.veiculo_modelo || ''} - ${profile.veiculo_cor || ''} (${profile.veiculo_placa || ''})` : '',
        avgRating ? `⭐ ${avgRating.avg}/5 (${avgRating.count} avaliações)` : '',
        `✅ ${completedCount} corridas concluídas`,
      ].filter(Boolean).join('\n');

      if (navigator.share) {
        try {
          await navigator.share({ title: 'RF Drive - Crachá', text });
        } catch {
          await navigator.clipboard.writeText(text);
          toast({ title: 'Crachá copiado!' });
        }
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Crachá copiado!' });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Badge Card */}
      <Card className="border-accent/30 overflow-hidden">
        {/* Header stripe */}
        <div className="h-2 gradient-accent" />

        <CardContent className="pt-6 pb-6 space-y-5">
          {/* Logo + Title */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight">RF Drive</h2>
            <p className="text-xs text-muted-foreground">Motorista Credenciado</p>
          </div>

          <Separator />

          {/* Driver info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <User className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">{profile.nome}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {profile.telefone}
                </p>
              </div>
            </div>

            {/* Vehicle */}
            {hasVehicle ? (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-accent" /> Veículo
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {profile.veiculo_marca && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Marca / Modelo</p>
                      <p className="text-sm font-medium">
                        {profile.veiculo_marca} {profile.veiculo_modelo || ''}
                      </p>
                    </div>
                  )}
                  {profile.veiculo_cor && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cor</p>
                      <p className="text-sm font-medium">{profile.veiculo_cor}</p>
                    </div>
                  )}
                  {profile.veiculo_placa && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Placa</p>
                      <p className="text-sm font-mono font-bold">{profile.veiculo_placa}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-yellow-400">Veículo não cadastrado</p>
                <p className="text-[10px] text-muted-foreground">Solicite ao admin para adicionar</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-lg font-extrabold text-green-400">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground">Corridas</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                {avgRating ? (
                  <>
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-extrabold text-yellow-400">{avgRating.avg}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{avgRating.count} aval.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold text-muted-foreground">—</p>
                    <p className="text-[10px] text-muted-foreground">Sem aval.</p>
                  </>
                )}
              </div>
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <Badge
                  variant={profile.status === 'ativo' ? 'outline' : 'destructive'}
                  className="text-[10px] px-1.5"
                >
                  {profile.status === 'ativo' ? '✅ Ativo' : '🚫 ' + profile.status}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1">Status</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* ID */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">ID do Motorista</p>
            <p className="text-xs font-mono text-muted-foreground/70">{profile.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Share button */}
      <Button
        className="w-full gap-2"
        variant="outline"
        onClick={handleShare}
      >
        <Send className="w-4 h-4" />
        Compartilhar Crachá
      </Button>
    </div>
  );
};
