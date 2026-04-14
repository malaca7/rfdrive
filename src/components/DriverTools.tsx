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
  Car, Phone, Star, User, Shield, Clock, MessageSquare, ChevronRight, TableProperties,
  Camera, Loader2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas } from '@/lib/pricing-engine';
import { useToast } from '@/hooks/use-toast';

// ── Crop helper: canvas-based crop to blob ──
async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const size = 400;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to blob failed'))),
      'image/jpeg', 0.85,
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
    staleTime: 60_000,
  });

  const taxaBagagemValor = configTarifas?.taxa_bagagem ?? 5;

  const totalValue = useMemo(() => {
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
                        <p className={`text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold ${preco.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                          R$ {totalValue.toFixed(2)}
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
                    <span className="text-lg font-bold text-green-400">R$ {totalValue.toFixed(2)}</span>
                  </div>
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
        backgroundColor: '#000000',
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
        `✅ ${completedCount} corridas`,
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

  // Hidden file input
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
            background: '#000000',
            borderRadius: '16px',
            border: '1.5px solid #d4af37',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            position: 'relative' as const,
            overflow: 'hidden',
          }}
        >


          {/* Gold corner accents */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '60px', height: '60px',
            background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, transparent 60%)',
            borderRadius: '16px 0 0 0',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, right: 0, width: '60px', height: '60px',
            background: 'linear-gradient(315deg, rgba(212,175,55,0.12) 0%, transparent 60%)',
            borderRadius: '0 0 16px 0',
          }} />

          {/* Content wrapper (above background) */}
          <div style={{ position: 'relative' as const, zIndex: 1, padding: '20px' }}>

            {/* Top: Logo + Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                  RF Drive
                </div>
                <div style={{ fontSize: '9px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase' as const, letterSpacing: '2px' }}>
                  Motorista Credenciado
                </div>
              </div>
            </div>

            {/* Gold divider */}
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #d4af37, #b8941f, transparent)', marginBottom: '14px', opacity: 0.5 }} />

            {/* Driver row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                border: '2px solid #d4af37', overflow: 'hidden',
                background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(212,175,55,0.15)',
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', lineHeight: '1.2' }}>
                  {profile.nome}
                </div>
                <div style={{ fontSize: '11px', color: '#a0a0a0', marginTop: '2px' }}>
                  {profile.telefone}
                </div>
              </div>
            </div>

            {/* Vehicle section: big car image + info/plate */}
            {hasVehicle && (
              <div style={{ marginBottom: '12px' }}>
                {/* Large car image */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.06) 0%, transparent 70%)',
                  borderRadius: '12px',
                  padding: '8px 0',
                  marginBottom: '10px',
                }}>
                  <img
                    src={`https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&make=${encodeURIComponent(profile.veiculo_marca || '')}&modelFamily=${encodeURIComponent(profile.veiculo_modelo || '')}&paintId=pspc0001&angle=01&width=800`}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      width: '100%', maxHeight: '140px', objectFit: 'contain',
                      filter: 'brightness(1.15) drop-shadow(0 4px 16px rgba(212,175,55,0.25))',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                {/* Info + plate row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#d4af37', lineHeight: '1.2' }}>
                      {[profile.veiculo_marca, profile.veiculo_modelo].filter(Boolean).join(' ')}
                    </div>
                    {profile.veiculo_cor && (
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                        {profile.veiculo_cor}
                      </div>
                    )}
                  </div>

                  {/* Mercosul plate */}
                  {profile.veiculo_placa && (
                    <div style={{
                      width: '140px', flexShrink: 0,
                      background: '#ffffff',
                      borderRadius: '5px',
                      border: '2px solid #ccc',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>
                      {/* Blue top strip (Mercosul) */}
                      <div style={{
                        background: 'linear-gradient(90deg, #003399, #0044aa)',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '0 6px',
                      }}>
                        <div style={{
                          width: '10px', height: '7px', borderRadius: '1px',
                          background: '#009c3b', position: 'relative' as const, overflow: 'hidden', flexShrink: 0,
                        }}>
                          <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(0deg)',
                            width: '8px', height: '5px',
                            background: '#ffdf00',
                            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                          }} />
                        </div>
                        <span style={{ fontSize: '6px', fontWeight: '700', color: '#ffffff', letterSpacing: '1px' }}>
                          BRASIL
                        </span>
                      </div>
                      <div style={{ padding: '2px 0 4px', textAlign: 'center' as const }}>
                        <span style={{
                          fontSize: '22px', fontWeight: '900', color: '#1a1a1a',
                          fontFamily: "'FE-Schrift', 'Roboto Condensed', 'Arial Narrow', monospace",
                          letterSpacing: '2px', lineHeight: '1',
                        }}>
                          {profile.veiculo_placa}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <div style={{
                background: profile.status === 'ativo' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${profile.status === 'ativo' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '20px',
                padding: '4px 16px',
                fontSize: '11px',
                fontWeight: '700',
                color: profile.status === 'ativo' ? '#4ade80' : '#ef4444',
                letterSpacing: '0.5px',
              }}>
                {profile.status === 'ativo' ? '● Ativo' : '● ' + profile.status}
              </div>
            </div>

            {/* Bottom gold line + ID */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)', marginBottom: '8px' }} />
              <div style={{ textAlign: 'center' as const }}>
                <span style={{ fontSize: '8px', color: '#6b6040', fontFamily: 'monospace', letterSpacing: '1.5px' }}>
                  ID {profile.id.slice(0, 8).toUpperCase()}
                </span>
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
            {avatarUrl ? 'Trocar Foto' : 'Adicionar Foto'}
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
