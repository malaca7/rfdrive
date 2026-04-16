import React, { useState, useMemo, useRef, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Calculator, MapPin, Navigation, DollarSign, Send, Check, Copy,
  Phone, Star, User, Shield, Clock, MessageSquare, ChevronRight, TableProperties,
  Camera, Loader2, ZoomIn, ZoomOut, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas } from '@/lib/pricing-engine';
import { useToast } from '@/hooks/use-toast';

// ── Crop helper: canvas-based crop to blob ──
async function getCroppedBlob(imageSrc: string, crop: Area, outputSize = 400): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const aspect = crop.width / crop.height;
  const w = outputSize;
  const h = Math.round(outputSize / aspect);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to blob failed'))),
      'image/png', 1,
    );
  });
}

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
interface DriverProfile {
  id: string;
  nome: string;
  telefone: string;
  tipo: string;
  status: string;
  avatar_url?: string | null;
  veiculo_foto?: string | null;
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
    // Aplicar tarifa mínima
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

  const quoteMensagem = useMemo(() => {
    if (!preco || !origem.trim() || !destino.trim()) return '';
    const lines = [
      `🚗 *Orçamento RF Drive*`,
      ``,
      `📍 *Origem:* ${origem.trim()}`,
      `📍 *Destino:* ${destino.trim()}`,
      ``,
      `💰 *Detalhamento do valor:*`,
      `   Tarifa base: R$ ${preco.valor.toFixed(2)}${preco.estimado ? ' _(estimado)_' : ''}`,
    ];
    if (dynamicAdj) {
      const ajusteValor = dynamicAdj.aplicar(preco.valor) - preco.valor;
      lines.push(`   ⏰ ${dynamicAdj.regra.nome}: +R$ ${ajusteValor.toFixed(2)} (${dynamicAdj.regra.valor_ajuste}%)`);
    }
    if (temBagagem) lines.push(`   📦 Feira/Bagagem: +R$ ${taxaBagagemValor.toFixed(2)}`);
    lines.push(`   ─────────────────`);
    lines.push(`   *Total: R$ ${totalValue.toFixed(2)}*`);
    lines.push(``);
    if (clienteNome.trim()) lines.push(`👤 *Cliente:* ${clienteNome.trim()}`);
    if (observacao.trim()) lines.push(`📝 *Obs:* ${observacao.trim()}`);
    lines.push(``, `_Consulta feita pela Tabela RF Drive_`);
    return lines.filter(Boolean).join('\n');
  }, [preco, origem, destino, clienteNome, observacao, totalValue, dynamicAdj, temBagagem, taxaBagagemValor]);

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
              <span className="text-muted-foreground"> (+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')})</span>
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
                        <p className={`text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold ${isTarifaMinima ? 'text-yellow-400' : preco.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                          R$ {totalValue.toFixed(2)}
                        </p>
                        {isTarifaMinima && (
                          <p className="text-xs text-muted-foreground line-through">R$ {rawTotalValue.toFixed(2)}</p>
                        )}
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
                        +{dynamicAdj.regra.valor_ajuste}%
                      </span>
                    </div>
                  )}
                  {dynamicAdj && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tarifa base</span>
                      <span className="line-through">R$ {preco.valor.toFixed(2)}</span>
                    </div>
                  )}
                  {temBagagem && (
                    <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs">📦</span>
                        <span className="text-xs text-muted-foreground">Taxa Feira/Bagagem</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">R$ {taxaBagagemValor.toFixed(2)}</span>
                    </div>
                  )}
                  {(dynamicAdj || temBagagem || isTarifaMinima) && (
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="text-sm font-medium">Total</span>
                      <div className="flex items-center gap-2">
                        {isTarifaMinima && (
                          <span className="text-xs text-muted-foreground line-through">R$ {rawTotalValue.toFixed(2)}</span>
                        )}
                        <span className={`text-lg font-bold ${isTarifaMinima ? 'text-yellow-400' : preco.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                          R$ {totalValue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  {isTarifaMinima && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      <span className="text-xs text-yellow-400">Tarifa mínima aplicada</span>
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

                {/* Detalhamento visual */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Detalhamento</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tarifa base{preco.estimado ? ' (estimado)' : ''}</span>
                    <span className="font-medium">R$ {preco.valor.toFixed(2)}</span>
                  </div>
                  {dynamicAdj && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {dynamicAdj.regra.nome}
                        <span className="text-[10px] text-muted-foreground">({dynamicAdj.regra.tipo_ajuste === 'percentual' ? `${dynamicAdj.regra.valor_ajuste}%` : 'fixo'})</span>
                      </span>
                      <span className="font-medium text-purple-400">+R$ {(dynamicAdj.aplicar(preco.valor) - preco.valor).toFixed(2)}</span>
                    </div>
                  )}
                  {temBagagem && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-400 flex items-center gap-1.5">
                        <span>📦</span> Feira/Bagagem
                      </span>
                      <span className="font-medium text-orange-400">+R$ {taxaBagagemValor.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <div className="flex items-center gap-2">
                      {isTarifaMinima && (
                        <span className="text-xs text-muted-foreground line-through">R$ {rawTotalValue.toFixed(2)}</span>
                      )}
                      <span className={`text-lg font-bold ${isTarifaMinima ? 'text-yellow-400' : 'text-green-400'}`}>R$ {totalValue.toFixed(2)}</span>
                    </div>
                  </div>
                  {isTarifaMinima && (
                    <div className="flex items-center gap-2 mt-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                      <span className="text-[10px] text-yellow-400">Tarifa mínima aplicada</span>
                    </div>
                  )}
                </div>

                {/* Preview WhatsApp */}
                <details className="group">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">Ver mensagem do WhatsApp</summary>
                  <div className="mt-2 bg-muted/20 rounded-lg p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {quoteMensagem}
                  </div>
                </details>

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
// Driver Badge / Credential Card (compact, black, image-ready)
// ═══════════════════════════════════════════════
export const DriverBadge: React.FC<DriverToolsProps> = ({ profile, avgRating, completedCount }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const badgeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasVehicle = profile.veiculo_marca || profile.veiculo_placa;

  // ── Avatar crop state ──
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione uma imagem', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande (máx. 10MB)', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!rawImage || !croppedArea) return;
    setUploading(true);
    try {
      // Avatar upload (square, JPEG)
      const blob = await getCroppedBlob(rawImage, croppedArea);
      const filePath = `avatars/${profile.id}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        setAvatarUrl(publicUrl);

        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', profile.id);
        queryClient.invalidateQueries({ queryKey: ['driver-full-profile'] });

        toast({ title: 'Foto atualizada!' });
      setShowCropDialog(false);
      setRawImage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar foto';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    if (!badgeRef.current) return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(badgeRef.current, {
        scale: 3,
        backgroundColor: '#0a0a0a',
        logging: false,
        useCORS: true,
      });

      const imageDataUrl = canvas.toDataURL('image/png');

      if (navigator.share) {
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'cracha-rf-drive.png', { type: 'image/png' });

        try {
          await navigator.share({ title: 'RF Drive - Crachá', files: [file] });
          return;
        } catch { /* fallback below */ }
      }

      const link = document.createElement('a');
      link.href = imageDataUrl;
      link.download = 'cracha-rf-drive.png';
      link.click();
      toast({ title: 'Crachá baixado!' });
    } catch {
      const text = [
        `🚗 RF Drive - Motorista Credenciado`,
        `👤 ${profile.nome}`,
        `📱 ${profile.telefone}`,
        hasVehicle ? `🚘 ${[profile.veiculo_marca, profile.veiculo_modelo].filter(Boolean).join(' ')} • ${profile.veiculo_cor || ''} • ${profile.veiculo_placa || ''}` : '',
        avgRating ? `⭐ ${avgRating.avg}/5 (${avgRating.count} avaliações)` : '',
      ].filter(Boolean).join('\n');

      try {
        if (navigator.share) {
          await navigator.share({ title: 'RF Drive', text });
        } else {
          await navigator.clipboard.writeText(text);
          toast({ title: 'Crachá copiado!' });
        }
      } catch {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Crachá copiado!' });
      }
    }
  };

  // Hidden file inputs
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileSelect}
    />
  );

  return (
    <>
      {fileInput}
      <div className="space-y-3">
        {/* ── Badge Card (captured as image) ── */}
        <div
          ref={badgeRef}
          style={{
            background: 'linear-gradient(165deg, #141414 0%, #0a0a0a 50%, #111111 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(224,102,22,0.25)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            position: 'relative' as const,
            overflow: 'hidden',
            width: '420px',
            maxWidth: '100%',
            aspectRatio: '3 / 4',
            margin: '0 auto',
          }}
        >
          {/* ── Subtle orange glow top ── */}
          <div style={{
            position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)',
            width: '120%', height: '60%',
            background: 'radial-gradient(ellipse, rgba(224,102,22,0.08) 0%, transparent 70%)',
          }} />
          {/* ── Thin top accent line ── */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px',
            background: 'linear-gradient(90deg, transparent, #E06616, transparent)',
            borderRadius: '0 0 2px 2px',
          }} />

          {/* ── Content ── */}
          <div style={{
            position: 'relative' as const, zIndex: 1,
            display: 'flex', flexDirection: 'column' as const,
            height: '100%', padding: '6% 5% 5%',
          }}>

            {/* ══ HEADER: Logo + Tipo ══ */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '5%',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{
                  fontSize: 'clamp(28px, 8vw, 38px)', fontWeight: '900', color: '#E06616',
                  letterSpacing: '-1px', lineHeight: '1', fontStyle: 'italic',
                }}>R</span>
                <span style={{
                  fontSize: 'clamp(28px, 8vw, 38px)', fontWeight: '900', color: '#ffffff',
                  letterSpacing: '-1px', lineHeight: '1', fontStyle: 'italic',
                }}>F</span>
                <span style={{
                  fontSize: 'clamp(9px, 2.5vw, 12px)', fontWeight: '500', color: 'rgba(255,255,255,0.4)',
                  marginLeft: '6px', letterSpacing: '2px', textTransform: 'uppercase' as const,
                }}>DRIVE</span>
              </div>
              {/* Status pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: profile.status === 'ativo'
                  ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${profile.status === 'ativo' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: '20px', padding: '4px 12px',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: profile.status === 'ativo' ? '#4ade80' : '#ef4444',
                  boxShadow: profile.status === 'ativo' ? '0 0 8px rgba(74,222,128,0.6)' : 'none',
                }} />
                <span style={{
                  fontSize: '10px', fontWeight: '700',
                  color: profile.status === 'ativo' ? '#4ade80' : '#ef4444',
                  letterSpacing: '0.5px', textTransform: 'uppercase' as const,
                }}>
                  {profile.status === 'ativo' ? 'Ativo' : profile.status}
                </span>
              </div>
            </div>

            {/* ══ AVATAR (centered, prominent) ══ */}
            <div style={{
              display: 'flex', justifyContent: 'center', marginBottom: '4%',
            }}>
              <div style={{
                width: 'clamp(90px, 28%, 120px)', aspectRatio: '1',
                borderRadius: '50%',
                border: '3px solid #E06616',
                overflow: 'hidden', background: '#1a1a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(224,102,22,0.15), 0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E06616" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
            </div>

            {/* ══ DRIVER NAME + ROLE ══ */}
            <div style={{ textAlign: 'center' as const, marginBottom: '5%' }}>
              <div style={{
                fontSize: 'clamp(20px, 5.5vw, 28px)', fontWeight: '800', color: '#ffffff',
                textTransform: 'uppercase' as const, letterSpacing: '1.5px', lineHeight: '1.15',
              }}>
                {profile.nome}
              </div>
              <div style={{
                fontSize: 'clamp(10px, 2.8vw, 13px)', fontWeight: '600',
                color: '#E06616', marginTop: '4px',
                letterSpacing: '3px', textTransform: 'uppercase' as const,
              }}>
                {profile.tipo === 'admin' ? 'Administrador' : 'Motorista Credenciado'}
              </div>
            </div>

            {/* ══ DIVIDER ══ */}
            <div style={{
              height: '1px', margin: '0 8%',
              background: 'linear-gradient(90deg, transparent, rgba(224,102,22,0.4), transparent)',
            }} />

            {/* ══ VEHICLE IMAGE ══ */}
            {hasVehicle && (() => {
              // Map Brazilian car color names to imagin.studio paint IDs
              const corMap: Record<string, string> = {
                'preto': 'pspc0029', 'preta': 'pspc0029', 'black': 'pspc0029',
                'branco': 'pspc0001', 'branca': 'pspc0001', 'white': 'pspc0001',
                'prata': 'pspc0022', 'silver': 'pspc0022',
                'cinza': 'pspc0032', 'cinzento': 'pspc0032', 'grey': 'pspc0032', 'gray': 'pspc0032',
                'vermelho': 'pspc0015', 'vermelha': 'pspc0015', 'red': 'pspc0015',
                'azul': 'pspc0012', 'blue': 'pspc0012',
                'verde': 'pspc0005', 'green': 'pspc0005',
                'amarelo': 'pspc0004', 'amarela': 'pspc0004', 'yellow': 'pspc0004',
                'marrom': 'pspc0031', 'brown': 'pspc0031', 'bege': 'pspc0031', 'beige': 'pspc0031',
                'dourado': 'pspc0025', 'dourada': 'pspc0025', 'gold': 'pspc0025',
                'vinho': 'pspc0017', 'bordo': 'pspc0017', 'burgundy': 'pspc0017',
                'laranja': 'pspc0021', 'orange': 'pspc0021',
                'rosa': 'pspc0020', 'pink': 'pspc0020',
              };
              const corNorm = (profile.veiculo_cor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              const paintId = corMap[corNorm] || 'pspc0029';
              const carUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&make=${encodeURIComponent(profile.veiculo_marca || '')}&modelFamily=${encodeURIComponent(profile.veiculo_modelo || '')}&paintId=${paintId}&angle=01&width=900&zoomType=fullscreen`;
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '2% 0', flex: '1 1 auto', minHeight: 0,
                }}>
                  <img
                    src={carUrl}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      width: '90%', maxHeight: '130px', objectFit: 'contain',
                      filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              );
            })()}

            {/* ══ VEHICLE NAME ══ */}
            {hasVehicle && (
              <div style={{
                textAlign: 'center' as const, marginBottom: '2%',
              }}>
                <span style={{
                  fontSize: 'clamp(11px, 3vw, 14px)', fontWeight: '700', color: 'rgba(255,255,255,0.7)',
                  textTransform: 'uppercase' as const, letterSpacing: '2px',
                }}>
                  {[profile.veiculo_marca, profile.veiculo_modelo].filter(Boolean).join(' ')}
                </span>
                {profile.veiculo_cor && (
                  <span style={{
                    fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: '500', color: 'rgba(255,255,255,0.35)',
                    marginLeft: '8px', letterSpacing: '1px', textTransform: 'uppercase' as const,
                  }}>
                    {profile.veiculo_cor}
                  </span>
                )}
              </div>
            )}

            {/* ══ MERCOSUL PLATE (PROMINENT) ══ */}
            {profile.veiculo_placa && (
              <div style={{
                display: 'flex', justifyContent: 'center', marginBottom: '5%', marginTop: '2%',
              }}>
                <div style={{
                  width: '200px',
                  background: '#ffffff',
                  borderRadius: '5px',
                  border: '2.5px solid #c0c0c0',
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 30px rgba(224,102,22,0.1)',
                  transform: 'perspective(600px) rotateX(2deg)',
                }}>
                  {/* Blue top strip */}
                  <div style={{
                    background: 'linear-gradient(180deg, #003da5, #002d80)',
                    height: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 10px',
                  }}>
                    {/* BR flag */}
                    <div style={{
                      width: '14px', height: '10px', borderRadius: '1px',
                      background: '#009c3b', position: 'relative' as const, overflow: 'hidden', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        width: '10px', height: '7px', background: '#ffdf00',
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                      }} />
                    </div>
                    <span style={{
                      fontSize: '8px', fontWeight: '800', color: '#ffffff',
                      letterSpacing: '3px',
                    }}>
                      BRASIL
                    </span>
                    {/* MERCOSUL emblem */}
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '50%',
                      border: '1.5px solid rgba(255,255,255,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '6px', color: 'rgba(255,255,255,0.8)', fontWeight: '800',
                    }}>M</div>
                  </div>
                  {/* Plate number */}
                  <div style={{
                    padding: '4px 0 8px', textAlign: 'center' as const, background: '#ffffff',
                  }}>
                    <span style={{
                      fontSize: '34px', fontWeight: '900', color: '#1a1a1a',
                      fontFamily: "'FE-Schrift', 'Roboto Condensed', 'Arial Narrow', monospace",
                      letterSpacing: '4px', lineHeight: '1',
                    }}>
                      {profile.veiculo_placa}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ══ STATS ROW ══ */}
            {avgRating && (
              <div style={{
                display: 'flex', justifyContent: 'center', marginBottom: '4%',
              }}>
                <div style={{ textAlign: 'center' as const }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#E06616" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
                      {avgRating.avg}
                    </span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginLeft: '2px' }}>
                      ({avgRating.count})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ══ FOOTER: RF MOBILIDADE COM EXCELÊNCIA ══ */}
            <div style={{
              background: 'linear-gradient(135deg, #E06616, #c85510)',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              marginTop: 'auto',
            }}>
              <div style={{
                fontSize: 'clamp(16px, 4.5vw, 22px)', fontWeight: '900', color: '#ffffff',
                letterSpacing: '-0.5px', fontStyle: 'italic', lineHeight: '1',
              }}>
                <span>R</span><span>F</span>
              </div>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.3)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start' }}>
                <div style={{
                  fontSize: 'clamp(7px, 2vw, 10px)', fontWeight: '800', color: '#ffffff',
                  letterSpacing: '2.5px', textTransform: 'uppercase' as const, lineHeight: '1.4',
                }}>
                  MOBILIDADE COM EXCELÊNCIA
                </div>
                <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <svg key={i} width="7" height="7" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>

          </div>{/* end content wrapper */}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl gap-2 font-semibold"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-4 h-4" />
            {avatarUrl ? 'Trocar Foto' : 'Minha Foto'}
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl gap-2 font-semibold"
            onClick={handleShare}
          >
            <Send className="w-4 h-4" />
            Compartilhar
          </Button>
        </div>
      </div>

      {/* ── Crop Dialog ── */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="w-5 h-5 text-accent" />
              Recortar Foto
            </DialogTitle>
            <DialogDescription>
              Arraste e ajuste o zoom para enquadrar seu rosto
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full aspect-square bg-black">
            {rawImage && (
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          {/* Zoom control */}
          <div className="flex items-center gap-3 px-4 pb-2">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-2 accent-accent"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          <div className="flex gap-2 p-4 pt-0">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => { setShowCropDialog(false); setRawImage(null); }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCropConfirm}
              disabled={uploading}
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
