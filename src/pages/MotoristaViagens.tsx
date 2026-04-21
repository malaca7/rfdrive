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
  Copy, Check, Phone, User, Users, ShoppingCart, FileText, Route, Download, X,
} from 'lucide-react';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas } from '@/lib/pricing-engine';
import { useToast } from '@/hooks/use-toast';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { openExternal, copyToClipboard } from '@/lib/native-helpers';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { logPlatformActivity } from '@/lib/activity-log';
import { useGerarRecibo } from '@/hooks/useGerarRecibo';
import jsPDF from 'jspdf';

const MotoristaViagens: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { gerarReciboFromRide, temRecibo } = useGerarRecibo();
  const { nomePlataforma, siglaPlataforma, slogan, logoUrl, razaoSocial, cnpjEmpresa, nomeFantasia } = usePlatformConfig();
  const queryClient = useQueryClient();
  const allLocations = useAllLocations();
  const origemRef = useRef<HTMLInputElement>(null);
  const destinoRef = useRef<HTMLInputElement>(null);

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [showOrigemSugg, setShowOrigemSugg] = useState(false);
  const [showDestinoSugg, setShowDestinoSugg] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const [porteAnimal, setPorteAnimal] = useState<'none' | 'pequeno' | 'medio'>('none');
  const [carro6Lugares, setCarro6Lugares] = useState(false);
  const [paradaTipo, setParadaTipo] = useState<'none' | 'trajeto' | 'comum' | 'desvio'>('none');
  const [showParadaOptions, setShowParadaOptions] = useState(false);
  const [showAnimalOptions, setShowAnimalOptions] = useState(false);
  const [showTempoEspera, setShowTempoEspera] = useState(false);
  const [minutosEspera, setMinutosEspera] = useState(0);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showOrcamento, setShowOrcamento] = useState(false);
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
  const valorMinutoEspera = configTarifas?.valor_minuto_espera ?? 0.5;
  const tarifaMesmoBairro = configTarifas?.tarifa_mesmo_bairro ?? 10;
  const taxaCarro6Tipo = configTarifas?.taxa_carro_6_tipo ?? 'fixo';
  const taxaCarro6Valor = configTarifas?.taxa_carro_6_valor ?? 0;
  const taxaParadaTrajeto = (configTarifas as any)?.taxa_parada_trajeto ?? 3;
  const taxaParadaComum = (configTarifas as any)?.taxa_parada_comum ?? 5;
  const taxaParadaDesvio = (configTarifas as any)?.taxa_parada_desvio ?? 7;
  const taxaAnimalPequeno = (configTarifas as any)?.taxa_animal_pequeno ?? 5;
  const taxaAnimalMedio = (configTarifas as any)?.taxa_animal_medio ?? 7;
  const paradaValor = paradaTipo === 'trajeto' ? taxaParadaTrajeto : paradaTipo === 'comum' ? taxaParadaComum : paradaTipo === 'desvio' ? taxaParadaDesvio : 0;
  const paradaLabel = paradaTipo === 'trajeto'
    ? 'Parada no Trajeto'
    : paradaTipo === 'comum'
      ? 'Parada Comum'
      : paradaTipo === 'desvio'
        ? 'Parada desviando trajeto'
        : '';
  const taxaAnimalValor = porteAnimal === 'pequeno' ? taxaAnimalPequeno : porteAnimal === 'medio' ? taxaAnimalMedio : 0;
  const taxaAnimalLabel = porteAnimal === 'pequeno' ? 'Animal Pequeno Porte' : porteAnimal === 'medio' ? 'Animal Médio Porte' : '';
  const taxaEsperaValor = Math.max(0, minutosEspera) * valorMinutoEspera;

  // Override preco.valor for mesmo_bairro with configured value
  const precoEfetivo = useMemo(() => {
    if (!preco) return null;
    if (preco.mesmo_bairro) return { ...preco, valor: tarifaMesmoBairro };
    return preco;
  }, [preco, tarifaMesmoBairro]);

  const carro6Adicional = carro6Lugares && taxaCarro6Valor > 0
    ? (taxaCarro6Tipo === 'percentual' ? (precoEfetivo?.valor || 0) * (taxaCarro6Valor / 100) : taxaCarro6Valor)
    : 0;

  const totalValue = useMemo(() => {
    if (!precoEfetivo) return 0;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    if (taxaAnimalValor > 0) total += taxaAnimalValor;
    if (carro6Lugares && taxaCarro6Valor > 0) {
      total += taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
    }
    if (paradaValor > 0) total += paradaValor;
    if (taxaEsperaValor > 0) total += taxaEsperaValor;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima > 0 && total < minima) total = minima;
    return Math.round(total * 100) / 100;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, taxaAnimalValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, paradaValor, taxaEsperaValor, configTarifas]);

  const isTarifaMinima = useMemo(() => {
    if (!precoEfetivo) return false;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima <= 0) return false;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    if (taxaAnimalValor > 0) total += taxaAnimalValor;
    if (carro6Lugares && taxaCarro6Valor > 0) {
      total += taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
    }
    if (paradaValor > 0) total += paradaValor;
    if (taxaEsperaValor > 0) total += taxaEsperaValor;
    return total < minima;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, taxaAnimalValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, paradaValor, taxaEsperaValor, configTarifas]);

  const rawTotalValue = useMemo(() => {
    if (!precoEfetivo) return 0;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    if (taxaAnimalValor > 0) total += taxaAnimalValor;
    if (carro6Lugares && taxaCarro6Valor > 0) {
      total += taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
    }
    if (paradaValor > 0) total += paradaValor;
    if (taxaEsperaValor > 0) total += taxaEsperaValor;
    return Math.round(total * 100) / 100;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, taxaAnimalValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, paradaValor, taxaEsperaValor]);

  // ── Quote message ──
  const quoteMensagem = useMemo(() => {
    if (!precoEfetivo || !origem.trim() || !destino.trim()) return '';
    const hasAdicionais = dynamicAdj || temBagagem || taxaAnimalValor > 0 || carro6Lugares || paradaValor > 0 || taxaEsperaValor > 0;
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
        const ajusteValor = dynamicAdj.aplicar(precoEfetivo.valor) - precoEfetivo.valor;
        lines.push(`   ⏰ ${dynamicAdj.regra.nome}: +R$ ${ajusteValor.toFixed(2).replace('.', ',')}`);
      }
      if (temBagagem) lines.push(`   📦 Feira/Bagagem: +R$ ${taxaBagagemValor.toFixed(2).replace('.', ',')}`);
      if (taxaAnimalValor > 0) lines.push(`   🐾 ${taxaAnimalLabel}: +R$ ${taxaAnimalValor.toFixed(2).replace('.', ',')}`);
      if (carro6Lugares && taxaCarro6Valor > 0) {
        const c6add = taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
        lines.push(`   🚐 Carro 6 lugares: +R$ ${c6add.toFixed(2).replace('.', ',')}`);
      }
      if (paradaValor > 0) {
        lines.push(`   🛑 ${paradaLabel}: +R$ ${paradaValor.toFixed(2).replace('.', ',')}`);
      }
      if (taxaEsperaValor > 0) {
        lines.push(`   ⏱️ Tempo de espera (${minutosEspera} min): +R$ ${taxaEsperaValor.toFixed(2).replace('.', ',')}`);
      }
      lines.push(`   ─────────────────`);
      lines.push(`   ✅ *Total: R$ ${totalValue.toFixed(2).replace('.', ',')}*`);
    } else {
      lines.push(`✅ *Valor: R$ ${totalValue.toFixed(2).replace('.', ',')}*${precoEfetivo.mesmo_bairro ? ' _(mesmo bairro)_' : precoEfetivo.estimado ? ' _(estimado)_' : ''}`);
    }
    if (observacao.trim()) lines.push(``, `📝 *Obs:* ${observacao.trim()}`);
    if (clienteNome.trim()) lines.push(``);
    lines.push(``, `─────────────────────`, `_${siglaPlataforma} • ${slogan}_`);
    return lines.join('\n');
  }, [precoEfetivo, origem, destino, clienteNome, observacao, totalValue, dynamicAdj, temBagagem, taxaBagagemValor, taxaAnimalValor, taxaAnimalLabel, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, paradaValor, paradaLabel, taxaEsperaValor, minutosEspera, nomePlataforma, siglaPlataforma, slogan]);

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

  // ── Generate unique token for digital validation ──
  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [4, 4, 4, 4];
    return segments.map(len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')).join('-');
  };

  // ── Load image as base64 for jsPDF ──
  const loadImageForPDF = (url: string): Promise<HTMLImageElement | null> => {
    return new Promise(resolve => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // ── Gerar Recibo PDF e enviar WhatsApp ──
  const handleGerarRecibo = async () => {
    if (!precoEfetivo) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const margin = 18;
    const contentW = W - margin * 2;
    let y = 0;

    const now = new Date();
    const dataFormatada = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const recNum = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const token = generateToken();

    // ══ Header Bar (dark) ══
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 48, 'F');

    // Try to add logo
    let logoLoaded = false;
    let logoImg: HTMLImageElement | null = null;
    if (logoUrl) {
      try {
        logoImg = await loadImageForPDF(logoUrl);
        if (logoImg) {
          doc.addImage(logoImg, 'PNG', margin, 8, 28, 28);
          logoLoaded = true;
        }
      } catch { /* fallback to text */ }
    }

    const textStartX = logoLoaded ? margin + 34 : margin;
    // Nome Fantasia em destaque
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text((nomeFantasia || nomePlataforma).toUpperCase(), textStartX, 18);
    // Razão Social + CNPJ pequeno abaixo
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    if (razaoSocial) {
      doc.text(razaoSocial, textStartX, 24);
    }
    const cnpjLine = cnpjEmpresa ? `CNPJ: ${cnpjEmpresa}` : '';
    if (cnpjLine) {
      doc.text(cnpjLine, textStartX, razaoSocial ? 29 : 24);
    }
    // Slogan
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(slogan || 'Transporte executivo', textStartX, razaoSocial && cnpjLine ? 34 : razaoSocial || cnpjLine ? 29 : 24);

    // Right side: receipt info
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${recNum}`, W - margin, 14, { align: 'right' });
    doc.text(`${dataFormatada}`, W - margin, 20, { align: 'right' });
    doc.text(`${horaFormatada}`, W - margin, 26, { align: 'right' });
    // Token badge
    doc.setFillColor(99, 102, 241);
    const tokenText = `TOKEN: ${token}`;
    doc.setFontSize(6);
    const tokenW = doc.getTextWidth(tokenText) + 6;
    doc.roundedRect(W - margin - tokenW, 33, tokenW, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(tokenText, W - margin - tokenW / 2, 38, { align: 'center' });

    // Accent line below header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 48, W, 1.2, 'F');

    // ══ Watermark (logo as semi-transparent background) ══
    if (logoImg) {
      const wmSize = 120;
      const wmX = (W - wmSize) / 2;
      const wmY = (297 - wmSize) / 2;
      doc.saveGraphicsState();
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.04 }));
      doc.addImage(logoImg, 'PNG', wmX, wmY, wmSize, wmSize);
      doc.restoreGraphicsState();
    }

    y = 58;

    // ══ Title ══
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE SERVIÇO DE TRANSPORTE', W / 2, y, { align: 'center' });
    y += 3;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.6);
    doc.line(W / 2 - 45, y, W / 2 + 45, y);
    y += 10;

    // ══ Driver & Vehicle Info ══
    if (driverProfile) {
      doc.setFillColor(248, 250, 252);
      const driverH = 20;
      doc.roundedRect(margin, y, contentW, driverH, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, driverH, 2, 2, 'S');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text('PRESTADOR DO SERVIÇO', margin + 5, y + 6);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(driverProfile.nome || '—', margin + 5, y + 13);
      if (driverProfile.telefone) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(driverProfile.telefone, margin + 5, y + 18);
      }
      // Vehicle info on right side
      const veiculoName = [driverProfile.veiculo_marca, driverProfile.veiculo_modelo].filter(Boolean).join(' ');
      const veiculoDetails = [driverProfile.veiculo_cor, driverProfile.veiculo_placa ? `Placa: ${driverProfile.veiculo_placa}` : ''].filter(Boolean).join(' • ');
      if (veiculoName) {
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.text('VEÍCULO', W - margin - 5, y + 6, { align: 'right' });
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        doc.text(veiculoName, W - margin - 5, y + 13, { align: 'right' });
        if (veiculoDetails) {
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(veiculoDetails, W - margin - 5, y + 18, { align: 'right' });
        }
      }
      y += driverH + 6;
    }

    // ══ Client Info ══
    if (clienteNome.trim() || clienteTelefone.trim()) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, 20, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, 20, 2, 2, 'S');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text('CONTRATANTE', margin + 5, y + 6);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(clienteNome.trim() || '—', margin + 5, y + 14);
      if (clienteTelefone.trim()) {
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(clienteTelefone.trim(), W - margin - 5, y + 14, { align: 'right' });
      }
      y += 26;
    }

    // ══ Route ══
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 28, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 28, 2, 2, 'S');

    // Origin
    doc.setFillColor(34, 197, 94);
    doc.circle(margin + 8, y + 8, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('ORIGEM', margin + 14, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(origem.trim(), margin + 14, y + 12);

    // Dotted line between
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin + 8, y + 14, margin + 8, y + 17);
    doc.setLineDashPattern([], 0);

    // Destination
    doc.setFillColor(99, 102, 241);
    doc.circle(margin + 8, y + 22, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINO', margin + 14, y + 20);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(destino.trim(), margin + 14, y + 26);
    y += 34;

    // ══ Fare Breakdown ══
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('DETALHAMENTO DE VALORES', margin, y);
    y += 5;

    // Table header
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIÇÃO', margin + 4, y + 5);
    doc.text('VALOR (R$)', W - margin - 4, y + 5, { align: 'right' });
    y += 7;

    // Rows
    const rows: { desc: string; valor: string; color?: [number, number, number] }[] = [];
    const tipoTarifa = precoEfetivo.mesmo_bairro ? 'Tarifa (mesmo bairro)' : precoEfetivo.estimado ? 'Tarifa estimada' : 'Tarifa tabelada';
    rows.push({ desc: tipoTarifa, valor: precoEfetivo.valor.toFixed(2).replace('.', ','), color: [99, 102, 241] });
    if (!precoEfetivo.mesmo_bairro) {
      rows.push({ desc: `   Ref: ${precoEfetivo.origem_tabela} → ${precoEfetivo.destino_tabela}`, valor: '' });
    }
    if (dynamicAdj) {
      const ajusteValor = dynamicAdj.aplicar(precoEfetivo.valor) - precoEfetivo.valor;
      rows.push({ desc: `Ajuste horário: ${dynamicAdj.regra.nome}`, valor: `+${ajusteValor.toFixed(2).replace('.', ',')}`, color: [139, 92, 246] });
    }
    if (temBagagem) {
      rows.push({ desc: 'Taxa Feira/Bagagem', valor: `+${taxaBagagemValor.toFixed(2).replace('.', ',')}`, color: [234, 88, 12] });
    }
    if (taxaAnimalValor > 0) {
      rows.push({ desc: `Taxa ${taxaAnimalLabel}`, valor: `+${taxaAnimalValor.toFixed(2).replace('.', ',')}`, color: [34, 197, 94] });
    }
    if (carro6Lugares && taxaCarro6Valor > 0) {
      const c6add = taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
      rows.push({ desc: `Carro 6 lugares (${taxaCarro6Tipo === 'percentual' ? `${taxaCarro6Valor}%` : 'fixo'})`, valor: `+${c6add.toFixed(2).replace('.', ',')}`, color: [14, 165, 233] });
    }
    if (paradaValor > 0) {
      rows.push({ desc: paradaLabel, valor: `+${paradaValor.toFixed(2).replace('.', ',')}`, color: [239, 68, 68] });
    }
    if (taxaEsperaValor > 0) {
      rows.push({ desc: `Tempo de espera (${minutosEspera} min)`, valor: `+${taxaEsperaValor.toFixed(2).replace('.', ',')}`, color: [245, 158, 11] });
    }
    if (isTarifaMinima) {
      rows.push({ desc: 'Ajuste tarifa mínima', valor: `→ ${totalValue.toFixed(2).replace('.', ',')}`, color: [234, 179, 8] });
    }

    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, 6.5, 'F');
      }
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      if (row.color) {
        doc.setFillColor(row.color[0], row.color[1], row.color[2]);
        doc.circle(margin + 5, y + 3.2, 1.6, 'F');
        doc.text(row.desc, margin + 10, y + 4.5);
      } else {
        doc.text(row.desc, margin + 4, y + 4.5);
      }
      if (row.valor) {
        doc.text(row.valor, W - margin - 4, y + 4.5, { align: 'right' });
      }
      y += 6.5;
    });

    // ══ Total ══
    y += 2;
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL', margin + 6, y + 9);
    doc.setFontSize(16);
    doc.text(`R$ ${totalValue.toFixed(2).replace('.', ',')}`, W - margin - 6, y + 10, { align: 'right' });
    y += 22;

    // ══ Observation ══
    if (observacao.trim()) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const obsLines = doc.splitTextToSize(observacao.trim(), contentW - 8);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, obsLines.length * 4.5 + 5, 2, 2, 'F');
      doc.text(obsLines, margin + 4, y + 4);
      y += obsLines.length * 4.5 + 10;
    }

    // ══ Digital Signature Section ══
    y += 2;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 26, 2, 2, 'F');
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 26, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setTextColor(99, 102, 241);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURA DIGITAL', margin + 5, y + 6);
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.text(`Token de Validação: ${token}`, margin + 5, y + 12);
    doc.text(`Emitido por: ${razaoSocial || nomePlataforma}`, margin + 5, y + 17);
    doc.text(`Data/Hora: ${dataFormatada} às ${horaFormatada}`, margin + 5, y + 22);
    // Checkmark badge — draw manually (✓ doesn't render in jsPDF)
    doc.setFillColor(34, 197, 94);
    doc.circle(W - margin - 10, y + 13, 5, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.8);
    const cx2 = W - margin - 10, cy2 = y + 13;
    doc.line(cx2 - 2.5, cy2, cx2 - 0.5, cy2 + 2);
    doc.line(cx2 - 0.5, cy2 + 2, cx2 + 3, cy2 - 2);
    doc.setFontSize(5);
    doc.setTextColor(34, 197, 94);
    doc.text('VALIDADO', W - margin - 10, y + 22, { align: 'center' });
    y += 32;

    // ══ Emission info ══
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emissão: ${dataFormatada} às ${horaFormatada}`, margin, y);
    y += 4;
    doc.text('Este documento é um comprovante válido de serviço de transporte prestado.', margin, y);
    y += 4;
    doc.text('A autenticidade pode ser verificada pelo token de validação acima.', margin, y);
    y += 10;

    // ══ Signature lines ══
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 68, y);
    doc.line(W - margin - 68, y, W - margin, y);
    y += 4;
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Prestador do serviço', margin + 34, y, { align: 'center' });
    doc.text('Contratante', W - margin - 34, y, { align: 'center' });

    // ══ Footer ══
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 287, W, 10, 'F');
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 287, W, 0.8, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${siglaPlataforma} • ${slogan}`, W / 2, 293, { align: 'center' });

    // ── Save to Supabase (mandatory before sharing) ──
    try {
      const basePayload = {
        motorista_id: user!.id,
        numero: recNum,
        token,
        cliente_nome: clienteNome.trim() || null,
        cliente_telefone: clienteTelefone.trim() || null,
        origem: origem.trim(),
        destino: destino.trim(),
        valor_total: totalValue,
        detalhes: {
          valor_base: precoEfetivo.valor,
          tipo_tarifa: tipoTarifa,
          ajuste_horario: dynamicAdj ? dynamicAdj.regra.nome : null,
          taxa_bagagem: temBagagem ? taxaBagagemValor : null,
          taxa_animal: taxaAnimalValor > 0 ? taxaAnimalValor : null,
          porte_animal: porteAnimal !== 'none' ? porteAnimal : null,
          carro_6: carro6Lugares ? carro6Adicional : null,
          carro_6_tipo: carro6Lugares ? taxaCarro6Tipo : null,
          carro_6_config: carro6Lugares ? taxaCarro6Valor : null,
          parada_tipo: paradaTipo !== 'none' ? paradaTipo : null,
          parada_valor: paradaValor > 0 ? paradaValor : null,
          tempo_espera_minutos: minutosEspera > 0 ? minutosEspera : null,
          tempo_espera_valor: taxaEsperaValor > 0 ? taxaEsperaValor : null,
          tarifa_minima: isTarifaMinima,
          observacao_motorista: observacao.trim() || null,
          data_emissao: now.toISOString(),
        },
      };

      const fullPayload = {
        ...basePayload,
        status: 'ativo',
      };

      let saveError: any = null;

      const firstTry = await (supabase as any)
        .from('recibos')
        .insert(fullPayload);
      saveError = firstTry.error;

      // Fallback para schema legado sem coluna "status"
      if (saveError?.code === 'PGRST204' || saveError?.code === '42703') {
        const legacyTry = await (supabase as any)
          .from('recibos')
          .insert(basePayload);
        saveError = legacyTry.error;
      }

      if (saveError) {
        const desc = saveError?.code === '42P01'
          ? 'A tabela recibos não existe no banco. Rode a migration de recibos.'
          : 'O recibo precisa ser salvo no banco antes do compartilhamento.';

        toast({
          title: 'Falha ao registrar recibo',
          description: desc,
          variant: 'destructive',
        });
        return;
      }
    } catch (e: any) {
      toast({
        title: 'Falha ao registrar recibo',
        description: e?.message || 'Verifique a tabela de recibos e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    // ── Share PDF ──
    try {
      const pdfBlob = doc.output('blob');
      const filename = `recibo-${recNum}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
        const saved = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({ title: `Recibo ${recNum}`, url: saved.uri });
      } else if (navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], filename, { type: 'application/pdf' })] })) {
        await navigator.share({ files: [new File([pdfBlob], filename, { type: 'application/pdf' })], title: `Recibo ${recNum}` });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Recibo gerado!', description: `Token: ${token}` });
    } catch {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `recibo-${recNum}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Recibo salvo!', description: `Token: ${token}` });
    }
  };

  // ── Registrar viagem como realizada ──
  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!precoEfetivo || !user) throw new Error('Dados incompletos');
      const concluidaAt = new Date().toISOString();
      const { data: createdRide, error } = await supabase.from('corridas').insert({
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
        preco_regra_aplicada: precoEfetivo.mesmo_bairro ? 'mesmo_bairro' : precoEfetivo.estimado ? 'estimado' : 'tabela',
        preco_detalhes: {
          origem_tabela: precoEfetivo.origem_tabela,
          destino_tabela: precoEfetivo.destino_tabela,
          valor_base: precoEfetivo.valor,
          cliente_nome: clienteNome.trim() || null,
          cliente_telefone: clienteTelefone.trim() || null,
          ...(dynamicAdj ? {
            ajuste_horario: dynamicAdj.label,
            regra_horario: dynamicAdj.regra.nome,
            cor_regra: (dynamicAdj.regra as any).cor || '#8b5cf6',
          } : {}),
          ...(carro6Lugares ? { carro_6_lugares: true } : {}),
          ...(paradaValor > 0 ? { parada_tipo: paradaTipo, parada_valor: paradaValor } : {}),
          ...(taxaEsperaValor > 0 ? { tempo_espera_minutos: minutosEspera, tempo_espera_valor: taxaEsperaValor } : {}),
        },
      }).select('id').single();
      if (error) throw error;

      await logPlatformActivity({
        userId: user.id,
        action: 'registrar_viagem',
        category: 'corridas',
        entity: 'corridas',
        entityId: createdRide?.id || null,
        details: {
          origem: origem.trim(),
          destino: destino.trim(),
          valor: totalValue,
          status: 'em_analise',
        },
      });
    },
    onSuccess: () => {
      toast({ title: 'Viagem registrada!', description: 'Aguardando aprovação do administrador.' });
      setOrigem('');
      setDestino('');
      setObservacao('');
      setTemBagagem(false);
      setPorteAnimal('none');
      setShowAnimalOptions(false);
      setCarro6Lugares(false);
      setParadaTipo('none');
      setShowParadaOptions(false);
      setMinutosEspera(0);
      setShowTempoEspera(false);
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

  // ── Perfil completo do motorista (veículo) ──
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile-full', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleClear = () => {
    setOrigem(''); setDestino(''); setObservacao('');
    setTemBagagem(false); setPorteAnimal('none'); setShowAnimalOptions(false); setClienteNome(''); setClienteTelefone('');
    setParadaTipo('none'); setShowParadaOptions(false);
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
                ref={origemRef}
                value={origem}
                onChange={e => { setOrigem(e.target.value); setShowOrigemSugg(true); }}
                onFocus={() => setShowOrigemSugg(true)}
                onBlur={() => setTimeout(() => setShowOrigemSugg(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter') { setShowOrigemSugg(false); destinoRef.current?.focus(); } }}
                placeholder="De onde sai?"
                className="h-12 text-base pr-10"
              />
              {origem.trim() && (
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setOrigem(''); setShowOrigemSugg(false); origemRef.current?.focus(); }}
                  className="absolute right-3 top-[39px] -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Limpar origem"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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
                className="h-12 text-base pr-10"
              />
              {destino.trim() && (
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setDestino(''); setShowDestinoSugg(false); destinoRef.current?.focus(); }}
                  className="absolute right-3 top-[39px] -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Limpar destino"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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

            {/* Taxas extras */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!origem.trim() || !destino.trim()}
                onClick={() => setTemBagagem(!temBagagem)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  temBagagem ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-muted/30 border border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  temBagagem ? 'bg-orange-500/20 text-orange-400' : 'bg-muted/40 text-muted-foreground/40'
                }`}>
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-semibold leading-tight text-center ${temBagagem ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  Feira/Bagagem
                </span>
                <span className="text-[9px] text-muted-foreground/70">+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')}</span>
              </button>

              <button
                type="button"
                disabled={!origem.trim() || !destino.trim()}
                onClick={() => setShowAnimalOptions(v => !v)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  porteAnimal !== 'none' ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-muted/30 border border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-lg ${
                  porteAnimal !== 'none' ? 'bg-emerald-500/20' : 'bg-muted/40'
                }`}>
                  🐶
                </div>
                <span className={`text-[10px] font-semibold leading-tight text-center ${porteAnimal !== 'none' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  Animal
                </span>
                <span className="text-[9px] text-muted-foreground/70">{porteAnimal === 'none' ? 'Selecionar' : `+R$ ${taxaAnimalValor.toFixed(2).replace('.', ',')}`}</span>
              </button>

              {taxaCarro6Valor > 0 && (
                <button
                  type="button"
                  disabled={!origem.trim() || !destino.trim()}
                  onClick={() => setCarro6Lugares(!carro6Lugares)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    carro6Lugares ? 'bg-cyan-500/15 border border-cyan-500/30' : 'bg-muted/30 border border-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-lg ${
                    carro6Lugares ? 'bg-cyan-500/20' : 'bg-muted/40'
                  }`}>
                    🪑
                  </div>
                  <span className={`text-[10px] font-semibold leading-tight text-center ${carro6Lugares ? 'text-cyan-400' : 'text-muted-foreground'}`}>
                    Carro 6 Lugares
                  </span>
                  <span className="text-[9px] text-muted-foreground/70">+{taxaCarro6Tipo === 'percentual' ? `${taxaCarro6Valor}%` : `R$ ${taxaCarro6Valor.toFixed(2).replace('.', ',')}`}</span>
                </button>
              )}

              <button
                type="button"
                disabled={!origem.trim() || !destino.trim()}
                onClick={() => setShowParadaOptions(v => !v)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  paradaTipo !== 'none' ? 'bg-red-500/15 border border-red-500/30' : 'bg-muted/30 border border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  paradaTipo !== 'none' ? 'bg-red-500/20 text-red-400' : 'bg-muted/40 text-muted-foreground/40'
                }`}>
                  <Route className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-semibold leading-tight text-center ${paradaTipo !== 'none' ? 'text-red-400' : 'text-muted-foreground'}`}>
                  Paradas
                </span>
                <span className="text-[9px] text-muted-foreground/70">{paradaTipo === 'none' ? 'Selecionar' : `+R$ ${paradaValor.toFixed(2).replace('.', ',')}`}</span>
              </button>

              <button
                type="button"
                disabled={!origem.trim() || !destino.trim()}
                onClick={() => setShowTempoEspera(v => !v)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  minutosEspera > 0 ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-muted/30 border border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  minutosEspera > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-muted/40 text-muted-foreground/40'
                }`}>
                  <Clock className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-semibold leading-tight text-center ${minutosEspera > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  Tempo de espera
                </span>
                <span className="text-[9px] text-muted-foreground/70">{minutosEspera > 0 ? `${minutosEspera} min` : `R$ ${valorMinutoEspera.toFixed(2)}/min`}</span>
              </button>
            </div>

            <AnimatePresence>
              {showParadaOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="grid grid-cols-3 gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setParadaTipo((prev) => (prev === 'trajeto' ? 'none' : 'trajeto'));
                      setShowParadaOptions(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${paradaTipo === 'trajeto' ? 'border-blue-400/40 bg-blue-500/10 text-blue-400' : 'border-border bg-muted/20 text-muted-foreground'}`}
                  >
                    <span className="text-base">🛣️</span>
                    <span className="text-[10px] leading-tight text-center">Parada no Trajeto</span>
                    <span className="text-[9px]">R$ {taxaParadaTrajeto.toFixed(2).replace('.', ',')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParadaTipo((prev) => (prev === 'comum' ? 'none' : 'comum'));
                      setShowParadaOptions(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${paradaTipo === 'comum' ? 'border-orange-400/40 bg-orange-500/10 text-orange-400' : 'border-border bg-muted/20 text-muted-foreground'}`}
                  >
                    <span className="text-base">⏸️</span>
                    <span className="text-[10px] leading-tight text-center">Parada Comum</span>
                    <span className="text-[9px]">R$ {taxaParadaComum.toFixed(2).replace('.', ',')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParadaTipo((prev) => (prev === 'desvio' ? 'none' : 'desvio'));
                      setShowParadaOptions(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${paradaTipo === 'desvio' ? 'border-red-400/40 bg-red-500/10 text-red-400' : 'border-border bg-muted/20 text-muted-foreground'}`}
                  >
                    <span className="text-base">↪️</span>
                    <span className="text-[10px] leading-tight text-center">Parada desviando trajeto</span>
                    <span className="text-[9px]">R$ {taxaParadaDesvio.toFixed(2).replace('.', ',')}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showAnimalOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="grid grid-cols-2 gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPorteAnimal((prev) => (prev === 'pequeno' ? 'none' : 'pequeno'));
                      setShowAnimalOptions(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${porteAnimal === 'pequeno' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400' : 'border-border bg-muted/20 text-muted-foreground'}`}
                  >
                    <span className="text-base">🐕</span>
                    <span className="text-[10px] leading-tight text-center">Pequeno Porte</span>
                    <span className="text-[9px]">R$ {taxaAnimalPequeno.toFixed(2).replace('.', ',')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPorteAnimal((prev) => (prev === 'medio' ? 'none' : 'medio'));
                      setShowAnimalOptions(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${porteAnimal === 'medio' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400' : 'border-border bg-muted/20 text-muted-foreground'}`}
                  >
                    <span className="text-base">🐕‍🦺</span>
                    <span className="text-[10px] leading-tight text-center">Médio Porte</span>
                    <span className="text-[9px]">R$ {taxaAnimalMedio.toFixed(2).replace('.', ',')}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showTempoEspera && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2"
                >
                  <p className="text-xs text-amber-400 font-medium">Tempo de espera</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={minutosEspera}
                      onChange={(e) => setMinutosEspera(Math.max(0, Number(e.target.value || 0)))}
                      className="h-9"
                      placeholder="Minutos"
                    />
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      R$ {valorMinutoEspera.toFixed(2).replace('.', ',')}/min
                    </Badge>
                  </div>
                  {taxaEsperaValor > 0 && (
                    <p className="text-xs text-amber-300">Total espera: R$ {taxaEsperaValor.toFixed(2).replace('.', ',')}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Price preview */}
            <AnimatePresence>
              {precoEfetivo && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className={`${precoEfetivo.mesmo_bairro ? 'bg-blue-500/10 border-blue-500/20' : precoEfetivo.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-xl p-[4%]`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TableProperties className={`w-3.5 h-3.5 ${precoEfetivo.mesmo_bairro ? 'text-blue-400' : precoEfetivo.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                        <div>
                          <p className="text-[10px] text-muted-foreground">{precoEfetivo.mesmo_bairro ? 'Mesmo bairro' : precoEfetivo.estimado ? 'Preço estimado' : 'Preço tabelado'}</p>
                          <p className={`text-sm font-medium ${precoEfetivo.mesmo_bairro ? 'text-blue-400/80' : precoEfetivo.estimado ? 'text-amber-400/80' : 'text-green-400/80'}`}>
                            R$ {precoEfetivo.valor.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">
                          {precoEfetivo.mesmo_bairro ? 'Viagem pro mesmo bairro' : precoEfetivo.estimado ? 'Calculado por IA (rota sem ligacao direta)' : precoEfetivo.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                        </p>
                        {!precoEfetivo.mesmo_bairro && (
                          <>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                              {precoEfetivo.origem_tabela} → {precoEfetivo.destino_tabela}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {precoEfetivo.origem_regiao || '—'} → {precoEfetivo.destino_regiao || '—'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {precoEfetivo.estimado && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-amber-300 font-semibold">Valor calculado pela IA do sistema</p>
                          <p className="text-[11px] text-amber-200/90">Se o preço nao condizer com a realidade, verifique com um administrador.</p>
                        </div>
                      </div>
                    )}
                    {precoEfetivo.mesmo_bairro && (
                      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs text-blue-400">Viagem pro mesmo bairro — tarifa fixa R$ {precoEfetivo.valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
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
                    {carro6Lugares && taxaCarro6Valor > 0 && (
                      <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs text-muted-foreground">Carro 6 lugares</span>
                        </div>
                        <span className="text-sm font-bold text-cyan-400">
                          +R$ {(taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )}
                    {paradaValor > 0 && (
                      <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Route className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs text-muted-foreground">{paradaLabel}</span>
                        </div>
                        <span className="text-sm font-bold text-red-400">+R$ {paradaValor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    {taxaAnimalValor > 0 && (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-xs">🐾</span>
                          <span className="text-xs text-muted-foreground">{taxaAnimalLabel}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-400">+R$ {taxaAnimalValor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    {taxaEsperaValor > 0 && (
                      <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs text-muted-foreground">Tempo de espera ({minutosEspera} min)</span>
                        </div>
                        <span className="text-sm font-bold text-amber-400">+R$ {taxaEsperaValor.toFixed(2).replace('.', ',')}</span>
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

        {/* ── 2 Botões + Painéis ── */}
        <AnimatePresence>
          {precoEfetivo && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="space-y-3">

              {/* Botões principais */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={showOrcamento ? 'default' : 'outline'}
                  className={`h-14 rounded-2xl flex flex-col gap-0.5 font-bold text-sm transition-all ${
                    showOrcamento ? 'shadow-lg shadow-accent/20' : ''
                  }`}
                  onClick={() => { setShowOrcamento(v => !v); setShowRegistrar(false); }}
                >
                  <Send className="w-4 h-4" />
                  Orçamento
                </Button>
                <Button
                  className={`h-14 rounded-2xl flex flex-col gap-0.5 font-bold text-sm transition-all ${
                    showRegistrar
                      ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20'
                      : 'bg-green-600/80 hover:bg-green-600'
                  } text-white`}
                  onClick={() => { setShowRegistrar(v => !v); setShowOrcamento(false); }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirmar Registro
                </Button>
              </div>

              {/* ── Painel Orçamento ── */}
              <AnimatePresence>
                {showOrcamento && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="rounded-2xl overflow-hidden border-accent/20">
                {/* Header gradient */}
                <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Send className="w-4.5 h-4.5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Orçamento</h3>
                    <p className="text-[10px] text-muted-foreground">Copie e envie ao cliente</p>
                  </div>
                </div>

                <CardContent className="px-4 pb-4 pt-3 space-y-3">
                  {/* Toggle cliente info — pill style */}
                  <button
                    onClick={() => setShowClienteInfo(v => !v)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${showClienteInfo ? 'border-accent/30 bg-accent/5' : 'border-border/40 bg-muted/20'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showClienteInfo ? 'bg-accent/20' : 'bg-muted/40'}`}>
                      <User className={`w-4 h-4 transition-colors ${showClienteInfo ? 'text-accent' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">Dados do cliente</p>
                      <p className="text-[10px] text-muted-foreground">Nome e telefone no orçamento</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${showClienteInfo ? 'bg-accent justify-end' : 'bg-muted/60 justify-start'}`}>
                      <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-all" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {showClienteInfo && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="space-y-2">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome do cliente" className="h-11 pl-10 rounded-xl" />
                          </div>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} placeholder="(81) 9xxxx-xxxx" className="h-11 pl-10 rounded-xl" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mensagem preview — compact */}
                  <div className="bg-muted/15 rounded-xl p-3 border border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Preview</p>
                    </div>
                    <div className="text-[11px] whitespace-pre-wrap leading-relaxed text-muted-foreground max-h-[80px] overflow-y-auto">
                      {quoteMensagem}
                    </div>
                  </div>

                  {/* Action button — full width, prominent */}
                  <Button
                    className="w-full gap-2.5 h-12 rounded-xl font-bold text-sm shadow-lg shadow-accent/20"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        </div>
                        <span className="text-green-300">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4.5 h-4.5" />
                        Copiar Orçamento
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Painel Confirmar Registro ── */}
              <AnimatePresence>
                {showRegistrar && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <Card className="rounded-2xl overflow-hidden border-green-500/30">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-green-600/20 via-green-500/10 to-transparent px-4 py-3 flex items-center gap-3 border-b border-green-500/20">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold">Confirmar Registro de Viagem</h3>
                          <p className="text-[10px] text-muted-foreground">Revise os detalhes antes de confirmar</p>
                        </div>
                      </div>

                      <CardContent className="px-4 pt-4 pb-4 space-y-4">

                        {/* Rota */}
                        <div className="bg-muted/20 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rota</p>
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1 pt-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                              <div className="w-0.5 h-4 bg-border" />
                              <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Origem</p>
                                <p className="text-sm font-semibold">{origem}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Destino</p>
                                <p className="text-sm font-semibold">{destino}</p>
                              </div>
                            </div>
                          </div>
                          {clienteNome.trim() && (
                            <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <div>
                                <span className="text-xs font-medium">{clienteNome.trim()}</span>
                                {clienteTelefone.trim() && <span className="text-xs text-muted-foreground ml-2">{clienteTelefone.trim()}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Detalhamento de valores */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detalhamento de Valores</p>

                          {/* Tarifa base */}
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                              <span className="text-xs text-muted-foreground">
                                {precoEfetivo.mesmo_bairro ? 'Tarifa mesmo bairro' : precoEfetivo.estimado ? 'Tarifa estimada (IA)' : 'Tarifa tabelada'}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-indigo-400">R$ {precoEfetivo.valor.toFixed(2).replace('.', ',')}</span>
                          </div>
                          {!precoEfetivo.mesmo_bairro && (
                            <p className="text-[10px] text-muted-foreground px-3">{precoEfetivo.origem_tabela} → {precoEfetivo.destino_tabela}</p>
                          )}

                          {/* Ajuste horário */}
                          {dynamicAdj && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                <span className="text-xs text-muted-foreground">Ajuste horário: {dynamicAdj.regra.nome}</span>
                              </div>
                              <span className="text-sm font-bold text-purple-400">
                                +R$ {(dynamicAdj.aplicar(precoEfetivo.valor) - precoEfetivo.valor).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          )}

                          {/* Bagagem */}
                          {temBagagem && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                                <span className="text-xs text-muted-foreground">Taxa Feira/Bagagem</span>
                              </div>
                              <span className="text-sm font-bold text-orange-400">+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}

                          {/* Animal */}
                          {taxaAnimalValor > 0 && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                <span className="text-xs text-muted-foreground">{taxaAnimalLabel}</span>
                              </div>
                              <span className="text-sm font-bold text-emerald-400">+R$ {taxaAnimalValor.toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}

                          {/* Carro 6 lugares */}
                          {carro6Lugares && taxaCarro6Valor > 0 && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                                <span className="text-xs text-muted-foreground">Carro 6 lugares ({taxaCarro6Tipo === 'percentual' ? `${taxaCarro6Valor}%` : 'fixo'})</span>
                              </div>
                              <span className="text-sm font-bold text-cyan-400">+R$ {carro6Adicional.toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}

                          {/* Parada */}
                          {paradaValor > 0 && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                <span className="text-xs text-muted-foreground">{paradaLabel}</span>
                              </div>
                              <span className="text-sm font-bold text-red-400">+R$ {paradaValor.toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}

                          {/* Espera */}
                          {taxaEsperaValor > 0 && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <span className="text-xs text-muted-foreground">Tempo de espera ({minutosEspera} min)</span>
                              </div>
                              <span className="text-sm font-bold text-amber-400">+R$ {taxaEsperaValor.toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}

                          {/* Tarifa mínima */}
                          {isTarifaMinima && (
                            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                              <AlertTriangle className="w-3 h-3 text-yellow-400" />
                              <span className="text-xs text-yellow-400">Tarifa mínima aplicada</span>
                            </div>
                          )}

                          {/* Total */}
                          <div className="mt-2 pt-3 border-t border-border">
                            <div className="flex items-center justify-between bg-green-600/15 border border-green-500/30 rounded-xl px-4 py-3">
                              <span className="text-sm font-bold">Valor Total</span>
                              <div className="text-right">
                                {isTarifaMinima && (
                                  <p className="text-[10px] text-muted-foreground line-through">R$ {rawTotalValue.toFixed(2).replace('.', ',')}</p>
                                )}
                                <span className="text-3xl font-extrabold text-green-400">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Aviso aprovação */}
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300">A viagem ficará em análise até o administrador aprovar.</p>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRegistrar(false)}>Cancelar</Button>
                          <Button
                            className="flex-1 gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-600/20"
                            onClick={() => registrarMutation.mutate()}
                            disabled={registrarMutation.isPending}
                          >
                            {registrarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Confirmar Registro
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

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
                        <button
                          onClick={() => gerarReciboFromRide(ride)}
                          className="p-1 rounded-md hover:bg-accent/20 text-muted-foreground hover:text-accent transition-colors"
                          title={temRecibo(ride) ? "Baixar Recibo" : "Emitir Recibo"}
                        >
                          {temRecibo(ride) ? <Download className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </button>
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
