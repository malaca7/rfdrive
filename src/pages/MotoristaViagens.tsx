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
  Copy, Check, Phone, User, Users, ShoppingCart, Armchair, FileText,
} from 'lucide-react';
import { usePrecoTabela, useAllLocations } from '@/hooks/usePrecoTabela';
import { useDynamicAdjustment } from '@/hooks/useDynamicAdjustment';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas } from '@/lib/pricing-engine';
import { useToast } from '@/hooks/use-toast';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { openExternal, copyToClipboard } from '@/lib/native-helpers';
import jsPDF from 'jspdf';

const MotoristaViagens: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { nomePlataforma, siglaPlataforma, slogan, logoUrl } = usePlatformConfig();
  const queryClient = useQueryClient();
  const allLocations = useAllLocations();
  const destinoRef = useRef<HTMLInputElement>(null);

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [showOrigemSugg, setShowOrigemSugg] = useState(false);
  const [showDestinoSugg, setShowDestinoSugg] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [temBagagem, setTemBagagem] = useState(false);
  const [carro6Lugares, setCarro6Lugares] = useState(false);
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
  const tarifaMesmoBairro = configTarifas?.tarifa_mesmo_bairro ?? 10;
  const taxaCarro6Tipo = configTarifas?.taxa_carro_6_tipo ?? 'fixo';
  const taxaCarro6Valor = configTarifas?.taxa_carro_6_valor ?? 0;

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
    if (carro6Lugares && taxaCarro6Valor > 0) {
      total += taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
    }
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima > 0 && total < minima) total = minima;
    return Math.round(total * 100) / 100;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, configTarifas]);

  const isTarifaMinima = useMemo(() => {
    if (!precoEfetivo) return false;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima <= 0) return false;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    if (carro6Lugares && taxaCarro6Valor > 0) {
      total += taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
    }
    return total < minima;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, configTarifas]);

  const rawTotalValue = useMemo(() => {
    if (!precoEfetivo) return 0;
    let total = precoEfetivo.valor;
    if (dynamicAdj) total = dynamicAdj.aplicar(total);
    if (temBagagem) total += taxaBagagemValor;
    if (carro6Lugares && taxaCarro6Valor > 0) {
      total += taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
    }
    return Math.round(total * 100) / 100;
  }, [precoEfetivo, dynamicAdj, temBagagem, taxaBagagemValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor]);

  // ── Quote message ──
  const quoteMensagem = useMemo(() => {
    if (!precoEfetivo || !origem.trim() || !destino.trim()) return '';
    const hasAdicionais = dynamicAdj || temBagagem || carro6Lugares;
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
      if (carro6Lugares && taxaCarro6Valor > 0) {
        const c6add = taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
        lines.push(`   🚐 Carro 6 lugares: +R$ ${c6add.toFixed(2).replace('.', ',')}`);
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
  }, [precoEfetivo, origem, destino, clienteNome, observacao, totalValue, dynamicAdj, temBagagem, taxaBagagemValor, carro6Lugares, taxaCarro6Tipo, taxaCarro6Valor, nomePlataforma, siglaPlataforma, slogan]);

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
    doc.rect(0, 0, W, 44, 'F');

    // Try to add logo
    let logoLoaded = false;
    if (logoUrl) {
      try {
        const logoImg = await loadImageForPDF(logoUrl);
        if (logoImg) {
          doc.addImage(logoImg, 'PNG', margin, 8, 28, 28);
          logoLoaded = true;
        }
      } catch { /* fallback to text */ }
    }

    const textStartX = logoLoaded ? margin + 34 : margin;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(nomePlataforma.toUpperCase(), textStartX, 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(slogan || 'Transporte executivo', textStartX, 27);
    // CNPJ / Contact line
    doc.setFontSize(7);
    doc.text('Serviço de transporte particular', textStartX, 33);

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
    doc.roundedRect(W - margin - tokenW, 30, tokenW, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(tokenText, W - margin - tokenW / 2, 35, { align: 'center' });

    // Accent line below header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 44, W, 1.2, 'F');
    y = 54;

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
    const rows: { desc: string; valor: string }[] = [];
    const tipoTarifa = precoEfetivo.mesmo_bairro ? 'Tarifa (mesmo bairro)' : precoEfetivo.estimado ? 'Tarifa estimada' : 'Tarifa tabelada';
    rows.push({ desc: tipoTarifa, valor: precoEfetivo.valor.toFixed(2).replace('.', ',') });
    if (!precoEfetivo.mesmo_bairro) {
      rows.push({ desc: `   Ref: ${precoEfetivo.origem_tabela} → ${precoEfetivo.destino_tabela}`, valor: '' });
    }
    if (dynamicAdj) {
      const ajusteValor = dynamicAdj.aplicar(precoEfetivo.valor) - precoEfetivo.valor;
      rows.push({ desc: `Ajuste horário: ${dynamicAdj.regra.nome}`, valor: `+${ajusteValor.toFixed(2).replace('.', ',')}` });
    }
    if (temBagagem) {
      rows.push({ desc: 'Taxa Feira/Bagagem', valor: `+${taxaBagagemValor.toFixed(2).replace('.', ',')}` });
    }
    if (carro6Lugares && taxaCarro6Valor > 0) {
      const c6add = taxaCarro6Tipo === 'percentual' ? precoEfetivo.valor * (taxaCarro6Valor / 100) : taxaCarro6Valor;
      rows.push({ desc: `Carro 6 lugares (${taxaCarro6Tipo === 'percentual' ? `${taxaCarro6Valor}%` : 'fixo'})`, valor: `+${c6add.toFixed(2).replace('.', ',')}` });
    }
    if (isTarifaMinima) {
      rows.push({ desc: 'Ajuste tarifa mínima', valor: `→ ${totalValue.toFixed(2).replace('.', ',')}` });
    }

    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, 6.5, 'F');
      }
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(row.desc, margin + 4, y + 4.5);
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
    doc.text(`Emitido por: ${nomePlataforma}`, margin + 5, y + 17);
    doc.text(`Data/Hora: ${dataFormatada} às ${horaFormatada}`, margin + 5, y + 22);
    // Checkmark badge
    doc.setFillColor(34, 197, 94);
    doc.circle(W - margin - 10, y + 13, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('✓', W - margin - 10, y + 15, { align: 'center' });
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

    // ── Save to Supabase ──
    try {
      await supabase.from('recibos').insert({
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
          carro_6: carro6Lugares ? taxaCarro6Valor : null,
          tarifa_minima: isTarifaMinima,
        },
      });
    } catch { /* non-blocking: table may not exist yet */ }

    // ── Share via WhatsApp as PDF ──
    try {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], `recibo-${recNum}.pdf`, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Recibo ${recNum}`,
        });
      } else {
        // Fallback: gerar URL blob e abrir WhatsApp web
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recibo-${recNum}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        // Abre WhatsApp para enviar manualmente
        window.open('https://api.whatsapp.com/send?text=Segue%20o%20recibo%20em%20PDF', '_blank');
      }
      toast({ title: 'Recibo gerado!', description: `Token: ${token}` });
    } catch {
      // User cancelled ou erro — baixa e abre WhatsApp
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recibo-${recNum}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Recibo salvo!', description: `Token: ${token}` });
    }
  };

  // ── Registrar viagem como realizada ──
  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!precoEfetivo || !user) throw new Error('Dados incompletos');
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
      setCarro6Lugares(false);
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

            {/* Bagagem + Carro 6 Lugares — lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTemBagagem(!temBagagem)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                  temBagagem ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-muted/30 border border-transparent'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  temBagagem ? 'bg-orange-500/20 text-orange-400' : 'bg-muted/40 text-muted-foreground/40'
                }`}>
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <span className={`text-[10px] font-semibold leading-tight text-center ${temBagagem ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  Feira/Bagagem
                </span>
                <span className="text-[9px] text-muted-foreground/70">+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')}</span>
              </button>

              {taxaCarro6Valor > 0 && (
                <button
                  type="button"
                  onClick={() => setCarro6Lugares(!carro6Lugares)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                    carro6Lugares ? 'bg-cyan-500/15 border border-cyan-500/30' : 'bg-muted/30 border border-transparent'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    carro6Lugares ? 'bg-cyan-500/20 text-cyan-400' : 'bg-muted/40 text-muted-foreground/40'
                  }`}>
                    <Armchair className="w-7 h-7" />
                  </div>
                  <span className={`text-[10px] font-semibold leading-tight text-center ${carro6Lugares ? 'text-cyan-400' : 'text-muted-foreground'}`}>
                    Carro 6 Lugares
                  </span>
                  <span className="text-[9px] text-muted-foreground/70">+{taxaCarro6Tipo === 'percentual' ? `${taxaCarro6Valor}%` : `R$ ${taxaCarro6Valor.toFixed(2).replace('.', ',')}`}</span>
                </button>
              )}
            </div>

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

                  <Button
                    variant="outline"
                    className="w-full gap-2 h-11 rounded-xl font-semibold border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                    onClick={handleGerarRecibo}
                  >
                    <Send className="w-4 h-4" />
                    Enviar Recibo (WhatsApp)
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
