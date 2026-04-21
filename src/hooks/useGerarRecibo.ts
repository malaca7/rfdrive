import { useCallback } from 'react';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RideData {
  id: string;
  origem_texto: string;
  destino_texto: string;
  valor: number | null;
  concluida_at: string | null;
  created_at: string;
  preco_detalhes?: Record<string, any> | null;
  tem_bagagem?: boolean | null;
  preco_regra_aplicada?: string | null;
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [4, 4, 4, 4];
  return segments.map(len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')).join('-');
}

function loadImageForPDF(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function useGerarRecibo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { nomePlataforma, siglaPlataforma, slogan, logoUrl, razaoSocial, cnpjEmpresa, nomeFantasia } = usePlatformConfig();

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

  // Fetch existing recibos to check if ride already has one
  const { data: recibosExistentes = [] } = useQuery({
    queryKey: ['recibos-existentes', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('recibos')
        .select('id, origem, destino, valor_total')
        .eq('motorista_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return [];
      return (data || []) as { id: string; origem: string; destino: string; valor_total: number }[];
    },
    enabled: !!user,
    staleTime: 5_000,
  });

  const temRecibo = useCallback((ride: RideData): boolean => {
    if (!ride.valor) return false;
    return recibosExistentes.some(r =>
      r.origem === ride.origem_texto &&
      r.destino === ride.destino_texto &&
      Math.abs(r.valor_total - ride.valor!) < 0.01
    );
  }, [recibosExistentes]);

  const gerarReciboFromRide = useCallback(async (ride: RideData) => {
    if (!ride.valor) {
      toast({ title: 'Viagem sem valor', description: 'Não é possível emitir recibo sem valor.', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const marg = 18;
    const cW = W - marg * 2;
    let y = 0;

    const rideDate = new Date(ride.concluida_at || ride.created_at);
    const dataFmt = rideDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaFmt = rideDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const recNum = `REC-${rideDate.getFullYear()}${String(rideDate.getMonth() + 1).padStart(2, '0')}${String(rideDate.getDate()).padStart(2, '0')}-${String(rideDate.getHours()).padStart(2, '0')}${String(rideDate.getMinutes()).padStart(2, '0')}${String(rideDate.getSeconds()).padStart(2, '0')}`;
    const token = generateToken();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 48, 'F');

    let logoImg2: HTMLImageElement | null = null;
    let logoLoaded2 = false;
    if (logoUrl) {
      try {
        logoImg2 = await loadImageForPDF(logoUrl);
        if (logoImg2) { doc.addImage(logoImg2, 'PNG', marg, 8, 28, 28); logoLoaded2 = true; }
      } catch { /* */ }
    }

    const txX = logoLoaded2 ? marg + 34 : marg;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text((nomeFantasia || nomePlataforma).toUpperCase(), txX, 18);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    if (razaoSocial) doc.text(razaoSocial, txX, 24);
    if (cnpjEmpresa) doc.text(`CNPJ: ${cnpjEmpresa}`, txX, razaoSocial ? 29 : 24);
    doc.text(slogan || 'Transporte executivo', txX, razaoSocial && cnpjEmpresa ? 34 : razaoSocial || cnpjEmpresa ? 29 : 24);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(`N° ${recNum}`, W - marg, 14, { align: 'right' });
    doc.text(dataFmt, W - marg, 20, { align: 'right' });
    doc.text(horaFmt, W - marg, 26, { align: 'right' });
    doc.setFillColor(99, 102, 241);
    const tkText = `TOKEN: ${token}`;
    doc.setFontSize(6);
    const tkW = doc.getTextWidth(tkText) + 6;
    doc.roundedRect(W - marg - tkW, 33, tkW, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(tkText, W - marg - tkW / 2, 38, { align: 'center' });

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 48, W, 1.2, 'F');

    // Watermark
    if (logoImg2) {
      const wmS = 120;
      doc.saveGraphicsState();
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.04 }));
      doc.addImage(logoImg2, 'PNG', (W - wmS) / 2, (297 - wmS) / 2, wmS, wmS);
      doc.restoreGraphicsState();
    }

    y = 58;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE SERVIÇO DE TRANSPORTE', W / 2, y, { align: 'center' });
    y += 3;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.6);
    doc.line(W / 2 - 45, y, W / 2 + 45, y);
    y += 10;

    // Driver & Vehicle
    if (driverProfile) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marg, y, cW, 20, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(marg, y, cW, 20, 2, 2, 'S');
      doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold');
      doc.text('PRESTADOR DO SERVIÇO', marg + 5, y + 6);
      doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
      doc.text(driverProfile.nome || '—', marg + 5, y + 13);
      if (driverProfile.telefone) { doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(driverProfile.telefone, marg + 5, y + 18); }
      const vName = [driverProfile.veiculo_marca, driverProfile.veiculo_modelo].filter(Boolean).join(' ');
      const vDet = [driverProfile.veiculo_cor, driverProfile.veiculo_placa ? `Placa: ${driverProfile.veiculo_placa}` : ''].filter(Boolean).join(' • ');
      if (vName) {
        doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold');
        doc.text('VEÍCULO', W - marg - 5, y + 6, { align: 'right' });
        doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
        doc.text(vName, W - marg - 5, y + 13, { align: 'right' });
        if (vDet) { doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(vDet, W - marg - 5, y + 18, { align: 'right' }); }
      }
      y += 26;
    }

    // Route
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marg, y, cW, 28, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(marg, y, cW, 28, 2, 2, 'S');
    doc.setFillColor(34, 197, 94); doc.circle(marg + 8, y + 8, 2, 'F');
    doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold');
    doc.text('ORIGEM', marg + 14, y + 6);
    doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
    doc.text(ride.origem_texto, marg + 14, y + 12);
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0); doc.line(marg + 8, y + 14, marg + 8, y + 17); doc.setLineDashPattern([], 0);
    doc.setFillColor(99, 102, 241); doc.circle(marg + 8, y + 22, 2, 'F');
    doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold');
    doc.text('DESTINO', marg + 14, y + 20);
    doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
    doc.text(ride.destino_texto, marg + 14, y + 26);
    y += 34;

    // Fare breakdown
    const pd = ride.preco_detalhes as Record<string, any> | null;
    const rows: { desc: string; valor: string; color?: [number, number, number] }[] = [];
    if (pd) {
      const valorBase = Number(pd.valor_base || ride.valor || 0);
      const tipoTarifa = pd.origem_tabela && pd.destino_tabela
        ? `Tarifa: ${pd.origem_tabela} → ${pd.destino_tabela}`
        : (ride.preco_regra_aplicada === 'mesmo_bairro' ? 'Tarifa (mesmo bairro)' : 'Tarifa base');
      rows.push({ desc: tipoTarifa, valor: valorBase.toFixed(2).replace('.', ','), color: [99, 102, 241] });
      if (pd.ajuste_horario || pd.regra_horario) {
        const ajNome = pd.regra_horario || pd.ajuste_horario || 'Ajuste horário';
        const ajVal = pd.ajuste_valor ? Number(pd.ajuste_valor) : 0;
        rows.push({ desc: `Ajuste: ${ajNome}`, valor: ajVal > 0 ? `+${ajVal.toFixed(2).replace('.', ',')}` : '—', color: [139, 92, 246] });
      }
      if (pd.taxa_bagagem || ride.tem_bagagem) {
        const bagVal = Number(pd.taxa_bagagem || 0);
        rows.push({ desc: 'Taxa Feira/Bagagem', valor: bagVal > 0 ? `+${bagVal.toFixed(2).replace('.', ',')}` : 'Inclusa', color: [234, 88, 12] });
      }
      if (pd.taxa_animal && Number(pd.taxa_animal) > 0) {
        rows.push({ desc: `Taxa Animal (${pd.porte_animal || 'porte'})`, valor: `+${Number(pd.taxa_animal).toFixed(2).replace('.', ',')}`, color: [34, 197, 94] });
      }
      if (pd.carro_6_lugares) {
        const c6val = Number(pd.carro_6 || 0);
        rows.push({ desc: 'Carro 6 Lugares', valor: c6val > 0 ? `+${c6val.toFixed(2).replace('.', ',')}` : '—', color: [14, 165, 233] });
      }
      if (pd.parada_valor && Number(pd.parada_valor) > 0) {
        const pLabel = pd.parada_tipo === 'trajeto' ? 'Parada no Trajeto' : pd.parada_tipo === 'fora_bairro' ? 'Parada Fora do Bairro' : pd.parada_tipo === 'extra' ? 'Parada Extra' : 'Parada';
        rows.push({ desc: pLabel, valor: `+${Number(pd.parada_valor).toFixed(2).replace('.', ',')}`, color: [239, 68, 68] });
      }
      if (pd.tempo_espera_valor && Number(pd.tempo_espera_valor) > 0) {
        const mins = pd.tempo_espera_minutos || 0;
        rows.push({ desc: `Tempo de espera (${mins} min)`, valor: `+${Number(pd.tempo_espera_valor).toFixed(2).replace('.', ',')}`, color: [245, 158, 11] });
      }
    }

    if (rows.length > 0) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text('DETALHAMENTO DE VALORES', marg, y);
      y += 5;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(marg, y, cW, 7, 1, 1, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('DESCRIÇÃO', marg + 4, y + 5);
      doc.text('VALOR (R$)', W - marg - 4, y + 5, { align: 'right' });
      y += 7;
      rows.forEach((row, i) => {
        if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(marg, y, cW, 6.5, 'F'); }
        doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        if (row.color) {
          doc.setFillColor(row.color[0], row.color[1], row.color[2]);
          doc.circle(marg + 5, y + 3.2, 1.6, 'F');
          doc.text(row.desc, marg + 10, y + 4.5);
        } else {
          doc.text(row.desc, marg + 4, y + 4.5);
        }
        if (row.valor) doc.text(row.valor, W - marg - 4, y + 4.5, { align: 'right' });
        y += 6.5;
      });
      y += 2;
    }

    // Total
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(marg, y, cW, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL', marg + 6, y + 9);
    doc.setFontSize(16);
    doc.text(`R$ ${ride.valor.toFixed(2).replace('.', ',')}`, W - marg - 6, y + 10, { align: 'right' });
    y += 22;

    // Digital Signature
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marg, y, cW, 26, 2, 2, 'F');
    doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.3);
    doc.roundedRect(marg, y, cW, 26, 2, 2, 'S');
    doc.setFontSize(7); doc.setTextColor(99, 102, 241); doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURA DIGITAL', marg + 5, y + 6);
    doc.setFontSize(6.5); doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'normal');
    doc.text(`Token de Validação: ${token}`, marg + 5, y + 12);
    doc.text(`Emitido por: ${razaoSocial || nomeFantasia || nomePlataforma}`, marg + 5, y + 17);
    doc.text(`Data/Hora: ${dataFmt} às ${horaFmt}`, marg + 5, y + 22);
    // Draw checkmark manually (✓ doesn't render in jsPDF)
    doc.setFillColor(34, 197, 94); doc.circle(W - marg - 10, y + 13, 5, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.8);
    const cx = W - marg - 10, cy = y + 13;
    doc.line(cx - 2.5, cy, cx - 0.5, cy + 2);
    doc.line(cx - 0.5, cy + 2, cx + 3, cy - 2);
    doc.setFontSize(5); doc.setTextColor(34, 197, 94);
    doc.text('VALIDADO', W - marg - 10, y + 22, { align: 'center' });
    y += 32;

    // Signature lines
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.line(marg, y, marg + 68, y);
    doc.line(W - marg - 68, y, W - marg, y);
    y += 4;
    doc.setFontSize(6.5); doc.setTextColor(148, 163, 184);
    doc.text('Prestador do serviço', marg + 34, y, { align: 'center' });
    doc.text('Contratante', W - marg - 34, y, { align: 'center' });

    // Footer
    doc.setFillColor(15, 23, 42); doc.rect(0, 287, W, 10, 'F');
    doc.setFillColor(99, 102, 241); doc.rect(0, 287, W, 0.8, 'F');
    doc.setTextColor(148, 163, 184); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(`${siglaPlataforma} • ${slogan}`, W / 2, 293, { align: 'center' });

    // Save to Supabase
    try {
      await (supabase as any).from('recibos').insert({
        motorista_id: user!.id,
        numero: recNum,
        token,
        cliente_nome: null,
        cliente_telefone: null,
        origem: ride.origem_texto,
        destino: ride.destino_texto,
        valor_total: ride.valor,
        detalhes: {
          valor_base: pd?.valor_base || ride.valor,
          tipo_tarifa: pd?.tipo_tarifa || (pd?.origem_tabela && pd?.destino_tabela ? `${pd.origem_tabela} → ${pd.destino_tabela}` : 'Tarifa base'),
          ajuste_horario: pd?.ajuste_horario || pd?.regra_horario || null,
          taxa_bagagem: pd?.taxa_bagagem != null && Number(pd.taxa_bagagem) > 0 ? pd.taxa_bagagem : null,
          taxa_animal: pd?.taxa_animal != null && Number(pd.taxa_animal) > 0 ? pd.taxa_animal : null,
          porte_animal: pd?.porte_animal || null,
          carro_6: pd?.carro_6 != null ? pd.carro_6 : null,
          carro_6_tipo: pd?.carro_6_tipo || null,
          parada_tipo: pd?.parada_tipo || null,
          parada_valor: pd?.parada_valor != null ? pd.parada_valor : null,
          tempo_espera_minutos: pd?.tempo_espera_minutos || null,
          tempo_espera_valor: pd?.tempo_espera_valor || null,
          data_emissao: ride.concluida_at || ride.created_at,
        },
        status: 'ativo',
      });
      qc.invalidateQueries({ queryKey: ['admin-recibos'] });
    } catch { /* non-blocking: PDF already generated */ }

    // Share
    try {
      const pdfBlob = doc.output('blob');
      const filename = `recibo-${recNum}.pdf`;

      if (Capacitor.isNativePlatform()) {
        // Native: save to cache then share via system sheet
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
  }, [driverProfile, logoUrl, nomeFantasia, nomePlataforma, razaoSocial, cnpjEmpresa, slogan, siglaPlataforma, toast]);

  return { gerarReciboFromRide, temRecibo };
}
