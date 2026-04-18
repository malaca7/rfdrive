import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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
  Phone, Star, User, Shield, Clock, ChevronRight, TableProperties,
  Camera, Loader2, ZoomIn, ZoomOut, AlertTriangle, Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas } from '@/lib/pricing-engine';
import { useToast } from '@/hooks/use-toast';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { openExternal, copyToClipboard, downloadImage } from '@/lib/native-helpers';

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
  const { nomePlataforma, siglaPlataforma, slogan } = usePlatformConfig();
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
  const tarifaMesmoBairro = configTarifas?.tarifa_mesmo_bairro ?? 10;

  // Override preco.valor for mesmo_bairro with configured value
  const precoEfetivo = useMemo(() => {
    if (!preco) return null;
    if (preco.mesmo_bairro) return { ...preco, valor: tarifaMesmoBairro };
    return preco;
  }, [preco, tarifaMesmoBairro]);

  const totalValue = useMemo(() => {
    if (!precoEfetivo) return 0;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    // Aplicar tarifa mínima
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima > 0 && total < minima) total = minima;
    return Math.round(total * 100) / 100;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, configTarifas]);

  const isTarifaMinima = useMemo(() => {
    if (!precoEfetivo) return false;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima <= 0) return false;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    return total < minima;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, configTarifas]);

  const rawTotalValue = useMemo(() => {
    if (!precoEfetivo) return 0;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    return Math.round(total * 100) / 100;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor]);

  const quoteMensagem = useMemo(() => {
    if (!precoEfetivo || !origem.trim() || !destino.trim()) return '';
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
      lines.push(`   Tarifa ${precoEfetivo.mesmo_bairro ? '(mesmo bairro)' : precoEfetivo.estimado ? '(estimada)' : 'tabelada'}: R$ ${precoEfetivo.valor.toFixed(2).replace('.', ',')}`);
      if (dynamicAdj) {
        const ajuste = dynamicAdj.aplicar(precoEfetivo.valor) - precoEfetivo.valor;
        lines.push(`   ⏰ ${dynamicAdj.regra.nome}: +R$ ${ajuste.toFixed(2).replace('.', ',')}`);
      }
      if (temBagagem) lines.push(`   📦 Feira/Bagagem: +R$ ${taxaBagagemValor.toFixed(2).replace('.', ',')}`);
      lines.push(`   ─────────────────`);
      lines.push(`   ✅ *Total: R$ ${totalValue.toFixed(2).replace('.', ',')}*`);
    } else {
      lines.push(`✅ *Valor: R$ ${totalValue.toFixed(2).replace('.', ',')}*${precoEfetivo.mesmo_bairro ? ' _(mesmo bairro)_' : precoEfetivo.estimado ? ' _(estimado)_' : ''}`);
    }
    if (observacao.trim()) lines.push(``, `📝 *Obs:* ${observacao.trim()}`);
    lines.push(``, `─────────────────────`, `_${siglaPlataforma} • ${slogan}_`);
    return lines.join('\n');
  }, [precoEfetivo, origem, destino, clienteNome, observacao, totalValue, dynamicAdj, temBagagem, taxaBagagemValor, nomePlataforma, siglaPlataforma, slogan]);

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

  const handleSendQuote = () => {
    if (!precoEfetivo) return;
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
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Observação <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Horário, referência..."
              className="resize-none text-sm min-h-[80px]"
              rows={3}
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
            {precoEfetivo && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`${precoEfetivo.mesmo_bairro ? 'bg-blue-500/10 border-blue-500/20' : precoEfetivo.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-xl p-[4%]`}
              >
                <div className="space-y-2">
                  {/* Preço base - valor da viagem sem adicionais */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableProperties className={`w-3.5 h-3.5 ${precoEfetivo.mesmo_bairro ? 'text-blue-400' : precoEfetivo.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          {precoEfetivo.mesmo_bairro ? 'Mesmo bairro' : precoEfetivo.estimado ? 'Preço estimado' : 'Preço tabelado'}
                        </p>
                        <p className={`text-sm font-medium ${precoEfetivo.mesmo_bairro ? 'text-blue-400/80' : precoEfetivo.estimado ? 'text-amber-400/80' : 'text-green-400/80'}`}>
                          R$ {precoEfetivo.valor.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">
                        {precoEfetivo.mesmo_bairro ? 'Viagem pro mesmo bairro' : precoEfetivo.estimado ? 'Média via Centro do Cabo' : precoEfetivo.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                      </p>
                      {!precoEfetivo.mesmo_bairro && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {precoEfetivo.origem_tabela} → {precoEfetivo.destino_tabela}
                        </p>
                      )}
                    </div>
                  </div>
                  {precoEfetivo.mesmo_bairro && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs text-blue-400">Viagem pro mesmo bairro — tarifa fixa R$ {precoEfetivo.valor.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {/* Adicionais */}
                  {dynamicAdj && (
                    <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-muted-foreground">{dynamicAdj.regra.nome}</span>
                      </div>
                      <span className="text-sm font-bold text-purple-400">
                        +R$ {(dynamicAdj.aplicar(precoEfetivo.valor) - precoEfetivo.valor).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  {temBagagem && (
                    <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs">📦</span>
                        <span className="text-xs text-muted-foreground">Feira/Bagagem</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')}</span>
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
                        <span className={`text-2xl font-extrabold ${isTarifaMinima ? 'text-yellow-400' : precoEfetivo.mesmo_bairro ? 'text-blue-400' : precoEfetivo.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                          R$ {totalValue.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!precoEfetivo && origem.trim() && destino.trim() && (
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
        {precoEfetivo && (
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
                  <h3 className="text-sm font-bold">Orçamento</h3>
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
                      placeholder="(00) 00000-0000"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Mensagem do orçamento */}
                <div className="bg-muted/20 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Mensagem</p>
                  <div className="text-xs whitespace-pre-wrap leading-relaxed max-h-[100px] overflow-y-auto">
                    {quoteMensagem}
                  </div>
                </div>

                <Button
                  className="w-full gap-2 h-12 rounded-xl font-bold text-base"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  {copied ? 'Copiado!' : 'Copiar Orçamento'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════
// Driver Badge / Credential Card — Canvas-based (v3)
// Gold gradient design inspired by professional driver cards.
// ═══════════════════════════════════════════════

function loadImageAny(src: string): Promise<HTMLImageElement | null> {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = () => resolve(null);
      img2.src = src;
    };
    img.src = src;
  });
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, halfW: number, halfH: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  ctx.closePath();
}

function drawCarOnCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 300, h / 120);
  // Body
  ctx.beginPath();
  ctx.moveTo(45, 72); ctx.lineTo(55, 42);
  ctx.bezierCurveTo(58, 35, 65, 28, 75, 25); ctx.lineTo(155, 20);
  ctx.bezierCurveTo(170, 18, 190, 22, 205, 30); ctx.lineTo(240, 50);
  ctx.bezierCurveTo(250, 55, 260, 62, 265, 68); ctx.lineTo(270, 72);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  // Roof
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(85, 42); ctx.lineTo(95, 22);
  ctx.bezierCurveTo(100, 16, 115, 12, 140, 12); ctx.lineTo(175, 14);
  ctx.bezierCurveTo(190, 16, 200, 22, 205, 30); ctx.lineTo(215, 48);
  ctx.bezierCurveTo(195, 40, 160, 38, 130, 38);
  ctx.bezierCurveTo(105, 38, 90, 40, 85, 42);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.globalAlpha = 1;
  // Window
  ctx.beginPath();
  ctx.moveTo(92, 40); ctx.lineTo(100, 24);
  ctx.bezierCurveTo(104, 18, 118, 15, 140, 15); ctx.lineTo(172, 16);
  ctx.bezierCurveTo(186, 18, 196, 24, 200, 30); ctx.lineTo(208, 45);
  ctx.bezierCurveTo(190, 40, 160, 38, 135, 38);
  ctx.bezierCurveTo(112, 38, 98, 39, 92, 40);
  ctx.closePath(); ctx.fillStyle = 'rgba(150,200,255,0.35)'; ctx.fill();
  // Bottom strip
  ctx.globalAlpha = 0.9; ctx.fillStyle = color;
  ctx.fillRect(35, 72, 245, 6); ctx.globalAlpha = 1;
  // Headlight
  ctx.beginPath(); ctx.ellipse(262, 65, 8, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,200,0.9)'; ctx.fill();
  // Taillight
  ctx.beginPath(); ctx.ellipse(48, 65, 6, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,50,50,0.7)'; ctx.fill();
  // Wheels
  for (const wx of [215, 85]) {
    ctx.beginPath(); ctx.arc(wx, 80, 18, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, 80, 12, 0, Math.PI * 2); ctx.fillStyle = '#333'; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, 80, 5, 0, Math.PI * 2); ctx.fillStyle = '#555'; ctx.fill();
  }
  // Shine
  ctx.beginPath();
  ctx.moveTo(60, 55); ctx.quadraticCurveTo(150, 44, 250, 57);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.2; ctx.stroke();
  // Handle
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(140, 50, 14, 3);
  ctx.restore();
}

export const DriverBadge: React.FC<DriverToolsProps> = ({ profile, avgRating, completedCount }) => {
  const { toast } = useToast();
  const { nomePlataforma } = usePlatformConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasVehicle = profile.veiculo_marca || profile.veiculo_placa;

  const carColor = useMemo(() => {
    const corMap: Record<string, string> = {
      'preto': '#222', 'preta': '#222', 'black': '#222',
      'branco': '#f0f0f0', 'branca': '#f0f0f0', 'white': '#f0f0f0',
      'prata': '#c0c0c0', 'silver': '#c0c0c0',
      'cinza': '#808080', 'grey': '#808080', 'gray': '#808080',
      'vermelho': '#cc2222', 'vermelha': '#cc2222', 'red': '#cc2222',
      'azul': '#2255cc', 'blue': '#2255cc',
      'verde': '#228833', 'green': '#228833',
      'amarelo': '#ddaa00', 'amarela': '#ddaa00', 'yellow': '#ddaa00',
      'marrom': '#6b3a1f', 'brown': '#6b3a1f', 'bege': '#c8ad7f',
      'dourado': '#b8860b', 'dourada': '#b8860b', 'gold': '#b8860b',
      'vinho': '#5c1a2a', 'bordo': '#5c1a2a',
      'laranja': '#dd6600', 'orange': '#dd6600',
      'rosa': '#cc5599', 'pink': '#cc5599',
    };
    const n = (profile.veiculo_cor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return corMap[n] || '#c0c0c0';
  }, [profile.veiculo_cor]);

  const drawBadge = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 840;
    const H = 640;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
    const GOLD1 = '#f5d442';    // amarelo dourado
    const GOLD2 = '#c9a227';    // dourado escuro
    const BORDER = 8;

    // ══ 1) Background image (or fallback gradient) ══
    try {
      const bgImg = await loadImageAny(`${import.meta.env.BASE_URL}badge-bg.png`);
      if (bgImg) {
        // Cover: fill canvas, crop center
        const imgRatio = bgImg.width / bgImg.height;
        const canvasRatio = W / H;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
        if (imgRatio > canvasRatio) {
          sw = bgImg.height * canvasRatio;
          sx = (bgImg.width - sw) / 2;
        } else {
          sh = bgImg.width / canvasRatio;
          sy = (bgImg.height - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
      } else {
        throw new Error('no img');
      }
    } catch {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#3a3a3a');
      bgGrad.addColorStop(0.3, '#2a2a2a');
      bgGrad.addColorStop(0.6, '#1a1a1a');
      bgGrad.addColorStop(1, '#0d0d0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // ══ THICK GOLD GRADIENT BORDER ══
    const borderGradOuter = ctx.createLinearGradient(0, 0, W, H);
    borderGradOuter.addColorStop(0, GOLD1);
    borderGradOuter.addColorStop(0.5, '#ffe066');
    borderGradOuter.addColorStop(1, GOLD2);
    ctx.save();
    ctx.strokeStyle = borderGradOuter;
    ctx.lineWidth = BORDER;
    ctx.strokeRect(BORDER / 2, BORDER / 2, W - BORDER, H - BORDER);
    ctx.restore();

    // ═══════════════════════════════════════
    // LEFT SIDE — Driver Info
    // ═══════════════════════════════════════
    const LC = W / 4 + 4; // ~214

    // Decorative diamonds (behind avatar)
    ctx.save();
    drawDiamond(ctx, LC, 270, 320, 320);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    drawDiamond(ctx, LC, 260, 260, 260);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.restore();

    // Diamond avatar frame
    const avCX = LC;
    const avCY = 270;
    const diamHalf = 180;

    // Gold diamond border
    ctx.save();
    ctx.shadowColor = 'rgba(245,212,66,0.4)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 5;
    drawDiamond(ctx, avCX, avCY, diamHalf + 12, diamHalf + 12);
    const borderGrad = ctx.createLinearGradient(avCX, avCY - diamHalf - 12, avCX, avCY + diamHalf + 12);
    borderGrad.addColorStop(0, GOLD1);
    borderGrad.addColorStop(1, GOLD2);
    ctx.fillStyle = borderGrad;
    ctx.fill();
    ctx.restore();

    // Clip diamond for avatar
    ctx.save();
    drawDiamond(ctx, avCX, avCY, diamHalf, diamHalf);
    ctx.clip();
    ctx.fillStyle = '#333';
    ctx.fillRect(avCX - diamHalf, avCY - diamHalf, diamHalf * 2, diamHalf * 2);

    let avatarLoaded = false;
    if (profile.avatar_url) {
      try {
        const avImg = await loadImageAny(profile.avatar_url);
        if (avImg) {
          const ar = avImg.width / avImg.height;
          const size = diamHalf * 2;
          let dw = size, dh = size;
          if (ar > 1) dw = size * ar; else dh = size / ar;
          ctx.drawImage(avImg, avCX - dw / 2, avCY - dh / 2, dw, dh);
          avatarLoaded = true;
        }
      } catch { /* fallback */ }
    }
    if (!avatarLoaded) {
      try {
        const animalUrl = getAnimalAvatarUrl(profile.id || profile.nome || 'driver');
        const animalImg = await loadImageAny(animalUrl);
        if (animalImg) {
          const size = diamHalf * 2;
          ctx.drawImage(animalImg, avCX - size / 2, avCY - size / 2, size, size);
          avatarLoaded = true;
        }
      } catch { /* fallback */ }
    }
    if (!avatarLoaded) {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(avCX, avCY - 18, 32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(avCX - 46, avCY + 50);
      ctx.bezierCurveTo(avCX - 46, avCY + 18, avCX - 36, avCY + 12, avCX, avCY + 12);
      ctx.bezierCurveTo(avCX + 36, avCY + 12, avCX + 46, avCY + 18, avCX + 46, avCY + 50);
      ctx.stroke();
    }
    ctx.restore();

    // Driver name — gold gradient (BIGGER)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const firstName = (profile.nome || '').split(' ')[0].toUpperCase();
    ctx.font = `800 52px ${FONT}`;
    const nameGrad = ctx.createLinearGradient(LC - 180, 0, LC + 180, 0);
    nameGrad.addColorStop(0, GOLD1);
    nameGrad.addColorStop(0.5, '#ffe066');
    nameGrad.addColorStop(1, GOLD2);
    ctx.fillStyle = nameGrad;
    ctx.fillText(firstName, LC, 530);

    // Subtitle — bigger
    ctx.font = `400 22px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Motorista Credenciado', LC, 564);



    // ═══════════════════════════════════════
    // RIGHT SIDE — Vehicle Info
    // ═══════════════════════════════════════
    const RC = 3 * W / 4 - 4; // ~626

    if (hasVehicle) {
      // Car photo — BIGGER
      const carCenterY = 256;
      let carDrawn = false;
      if (profile.veiculo_foto) {
        try {
          const carImg = await loadImageAny(profile.veiculo_foto);
          if (carImg) {
            const maxCW = 420, maxCH = 260;
            const ratio = Math.min(maxCW / carImg.width, maxCH / carImg.height);
            const cw = carImg.width * ratio, ch = carImg.height * ratio;
            const cx = RC - cw / 2, cy = carCenterY - ch / 2;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 24;
            ctx.shadowOffsetY = 10;
            ctx.drawImage(carImg, cx, cy, cw, ch);
            ctx.restore();
            carDrawn = true;
          }
        } catch { /* fallback illustration */ }
      }
      if (!carDrawn) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;
        drawCarOnCanvas(ctx, RC - 200, carCenterY - 60, 400, 170, carColor);
        ctx.restore();
      }

      // Vehicle name (marca + modelo) — BIGGER gold gradient
      const vehName = [profile.veiculo_marca, profile.veiculo_modelo].filter(Boolean).join(' ').toUpperCase();
      ctx.textAlign = 'center';
      ctx.font = `700 26px ${FONT}`;
      const vehGrad = ctx.createLinearGradient(RC - 150, 0, RC + 150, 0);
      vehGrad.addColorStop(0, GOLD1);
      vehGrad.addColorStop(1, GOLD2);
      ctx.fillStyle = vehGrad;
      ctx.fillText(vehName, RC, 426);

      // Vehicle color — BIGGER
      if (profile.veiculo_cor) {
        ctx.font = `400 20px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(profile.veiculo_cor.toUpperCase(), RC, 456);
      }

      // Mercosul plate — BIGGER
      if (profile.veiculo_placa) {
        const plateText = profile.veiculo_placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const plateW = 280;
        const plateH = 88;
        const plateX = RC - plateW / 2;
        const plateY = profile.veiculo_cor ? 482 : 472;
        const plateR = 6;

        // Plate background (white)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 5;
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateW, plateH, plateR);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // Blue top band (Mercosul)
        const bandH = 22;
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateW, bandH, [plateR, plateR, 0, 0]);
        ctx.fillStyle = '#003399';
        ctx.fill();

        // "BRASIL" text in blue band
        ctx.textAlign = 'center';
        ctx.font = `700 12px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('BRASIL', RC, plateY + 16);

        // Mercosul logo dots
        const logoX = plateX + 22;
        const logoY2 = plateY + 11;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
          ctx.moveTo(logoX + Math.cos(a) * 6, logoY2 + Math.sin(a) * 6);
          ctx.arc(logoX + Math.cos(a) * 6, logoY2 + Math.sin(a) * 6, 1.5, 0, Math.PI * 2);
        }
        ctx.fillStyle = '#ffcc00';
        ctx.fill();

        // Plate characters — BIGGER
        ctx.textAlign = 'center';
        ctx.font = `800 46px "FE-Schrift", "Segoe UI", ${FONT}`;
        ctx.fillStyle = '#1a1a1a';
        let displayPlate = plateText;
        if (plateText.length === 7) {
          displayPlate = plateText.slice(0, 3) + '-' + plateText.slice(3);
        }
        const charStartX = plateX + 18;
        const charY = plateY + bandH + 47;
        const charSpacing = (plateW - 36) / (displayPlate.length > 0 ? displayPlate.length : 1);
        for (let i = 0; i < displayPlate.length; i++) {
          const cx = charStartX + i * charSpacing + charSpacing / 2;
          ctx.fillStyle = '#1a1a1a';
          ctx.fillText(displayPlate[i], cx, charY);
        }
      }
    }

    // ══ TOP BAR (rendered last to overlay everything) ══
    const topBarH = 60;
    ctx.fillStyle = '#111111';
    ctx.fillRect(BORDER, BORDER, W - BORDER * 2, topBarH);
    // Gold line at bottom of top bar
    const goldLine = ctx.createLinearGradient(100, 0, W - 100, 0);
    goldLine.addColorStop(0, 'transparent');
    goldLine.addColorStop(0.3, GOLD1);
    goldLine.addColorStop(0.7, GOLD2);
    goldLine.addColorStop(1, 'transparent');
    ctx.fillStyle = goldLine;
    ctx.fillRect(BORDER, BORDER + topBarH - 2, W - BORDER * 2, 2);

    // RF + MOBILIDADE COM EXCELÊNCIA
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tbCY = BORDER + topBarH / 2;
    ctx.font = `italic 900 30px ${FONT}`;
    ctx.fillStyle = GOLD1;
    ctx.fillText('R', 28, tbCY);
    const rW = ctx.measureText('R').width;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('F', 28 + rW, tbCY);
    const rfW = rW + ctx.measureText('F').width;

    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.letterSpacing = '2px';
    ctx.fillText('MOBILIDADE COM EXCELÊNCIA', 28 + rfW + 14, tbCY);
    ctx.letterSpacing = '0px';

    // Small stars right-aligned in top bar
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const sx = W - 28 - (4 - i) * 16 - 8;
      drawStarShape(ctx, sx, tbCY, 6, 2.5);
      ctx.fillStyle = GOLD1;
      ctx.fill();
    }

    // ══ ADMINISTRADOR — centered, overlays everything ══
    const isAdmin = profile.tipo === 'admin';
    if (isAdmin) {
      const badgeText = 'ADMINISTRADOR';
      ctx.font = `800 22px ${FONT}`;
      const badgeW = ctx.measureText(badgeText).width + 44;
      const badgeH = 36;
      const badgeX = W / 2 - badgeW / 2;
      const badgeY = BORDER + topBarH + 30;

      ctx.save();
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(59,130,246,0.15)';
      ctx.beginPath();
      ctx.roundRect(badgeX - 4, badgeY - 4, badgeW + 8, badgeH + 8, 8);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 20;
      const badgeFill = ctx.createLinearGradient(badgeX, 0, badgeX + badgeW, 0);
      badgeFill.addColorStop(0, '#1e40af');
      badgeFill.addColorStop(0.5, '#2563eb');
      badgeFill.addColorStop(1, '#1e40af');
      ctx.fillStyle = badgeFill;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText(badgeText, W / 2, badgeY + badgeH / 2);
      ctx.textBaseline = 'alphabetic';
    }

    // ══ Re-draw border on top ══
    ctx.save();
    const borderGradTop = ctx.createLinearGradient(0, 0, W, H);
    borderGradTop.addColorStop(0, GOLD1);
    borderGradTop.addColorStop(0.5, '#ffe066');
    borderGradTop.addColorStop(1, GOLD2);
    ctx.strokeStyle = borderGradTop;
    ctx.lineWidth = BORDER;
    ctx.strokeRect(BORDER / 2, BORDER / 2, W - BORDER, H - BORDER);
    ctx.restore();
  }, [profile, hasVehicle, carColor, avgRating]);

  useEffect(() => { drawBadge(); }, [drawBadge]);

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
      const file = new File([blob], 'cracha-rf-drive.png', { type: 'image/png' });

      // Native share — sends image only, no text
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch { /* user cancelled */ }
      }

      // Fallback: download image then open WhatsApp to attach manually
      await downloadImage(blob, 'cracha-rf-drive.png');
      toast({ title: 'Crachá salvo! Abra o WhatsApp e envie a imagem.' });
    } catch {
      toast({ title: 'Erro ao gerar crachá', variant: 'destructive' });
    }
  }, [toast]);

  const handleDownload = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
      await downloadImage(blob, 'cracha-rf-drive.png');
      toast({ title: 'Crachá salvo com sucesso!' });
    } catch {
      toast({ title: 'Erro ao baixar crachá', variant: 'destructive' });
    }
  }, [toast]);

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto',
          display: 'block',
          borderRadius: '0px',
        }}
      />
      <div className="flex flex-col gap-2 max-w-[420px] mx-auto">
        <Button
          className="w-full h-11 rounded-xl gap-2 font-semibold text-base"
          onClick={handleDownload}
        >
          <Download className="w-5 h-5" />
          Baixar Crachá
        </Button>
      </div>
    </div>
  );
};
