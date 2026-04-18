import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import AdminLayout from '@/components/AdminLayout';
import {
  Settings, DollarSign, Save, Loader2, Palette,
  Type, Radius, Layers, Paintbrush, Sparkles, Image, Upload,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ConfigPlataforma = {
  id: string;
  taxa_semanal_motorista: number;
  nome_plataforma: string;
  cor_primaria: string;
  cor_secundaria: string;
  cor_terciaria: string;
  cor_sucesso: string;
  cor_alerta: string;
  cor_erro: string;
  cor_info: string;
  cor_botao_texto: string;
  cor_botao_fundo: string;
  cor_botao_borda: string;
  botao_borda_ativa: boolean;
  tema_border_radius: number;
  tema_card_opacidade: number;
  tema_fonte: string;
  tema_muted_offset: number;
  tema_gradiente_direcao: string;
  tema_botao_estilo: string;
  logo_url: string;
  slogan: string;
  updated_at: string;
};

const DEFAULT_CONFIG: Omit<ConfigPlataforma, 'id' | 'updated_at'> = {
  taxa_semanal_motorista: 0,
  nome_plataforma: 'RF Drive',
  logo_url: '',
  slogan: 'Seu transporte inteligente',
  cor_primaria: '#FFD000',
  cor_secundaria: '#0a0a0a',
  cor_terciaria: '#ffffff',
  cor_sucesso: '#22c55e',
  cor_alerta: '#f59e0b',
  cor_erro: '#ef4444',
  cor_info: '#3b82f6',
  cor_botao_texto: '#0a0a0a',
  cor_botao_fundo: '#FFD000',
  cor_botao_borda: '#FFD000',
  botao_borda_ativa: true,
  tema_border_radius: 16,
  tema_card_opacidade: 100,
  tema_fonte: 'Plus Jakarta Sans',
  tema_muted_offset: 46,
  tema_gradiente_direcao: '135deg',
  tema_botao_estilo: 'gradient',
};

const AdminConfig: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['config-plataforma'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_plataforma')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConfigPlataforma | null;
    },
    retry: 1,
  });

  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        taxa_semanal_motorista: config.taxa_semanal_motorista ?? 0,
        nome_plataforma: config.nome_plataforma ?? 'RF Drive',
        cor_primaria: (config as any).cor_primaria ?? '#FFD000',
        cor_secundaria: (config as any).cor_secundaria ?? '#0a0a0a',
        cor_terciaria: (config as any).cor_terciaria ?? '#ffffff',
        cor_sucesso: (config as any).cor_sucesso ?? '#22c55e',
        cor_alerta: (config as any).cor_alerta ?? '#f59e0b',
        cor_erro: (config as any).cor_erro ?? '#ef4444',
        cor_info: (config as any).cor_info ?? '#3b82f6',
        cor_botao_texto: (config as any).cor_botao_texto ?? '#0a0a0a',
        cor_botao_fundo: (config as any).cor_botao_fundo ?? '#FFD000',
        cor_botao_borda: (config as any).cor_botao_borda ?? '#FFD000',
        botao_borda_ativa: (config as any).botao_borda_ativa ?? true,
        tema_border_radius: (config as any).tema_border_radius ?? 16,
        tema_card_opacidade: (config as any).tema_card_opacidade ?? 100,
        tema_fonte: (config as any).tema_fonte ?? 'Plus Jakarta Sans',
        tema_muted_offset: (config as any).tema_muted_offset ?? 46,
        tema_gradiente_direcao: (config as any).tema_gradiente_direcao ?? '135deg',
        tema_botao_estilo: (config as any).tema_botao_estilo ?? 'gradient',
        logo_url: (config as any).logo_url ?? '',
        slogan: (config as any).slogan ?? 'Seu transporte inteligente',
      });
      setHasChanges(false);
    }
  }, [config]);

  const updateField = (field: string, value: string | number | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    setHasChanges(true);
  };

  // ── Live preview: apply theme CSS vars instantly from form state ──
  useEffect(() => {
    const root = document.documentElement;
    const hexToHSL = (hex: string): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return '45 100% 50%';
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };
    const adjustL = (hsl: string, delta: number) => {
      const m = hsl.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
      if (!m) return hsl;
      return `${Math.round(+m[1])} ${Math.round(+m[2])}% ${Math.round(Math.min(100, Math.max(0, +m[3] + delta)))}%`;
    };

    const primary = hexToHSL(form.cor_primaria);
    const bg = hexToHSL(form.cor_secundaria);
    const fg = hexToHSL(form.cor_terciaria);

    root.style.setProperty('--primary', primary);
    root.style.setProperty('--accent', primary);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-ring', primary);
    root.style.setProperty('--background', bg);
    root.style.setProperty('--card', adjustL(bg, 4));
    root.style.setProperty('--popover', adjustL(bg, 4));
    root.style.setProperty('--secondary', adjustL(bg, 8));
    root.style.setProperty('--muted', adjustL(bg, 8));
    root.style.setProperty('--border', adjustL(bg, 10));
    root.style.setProperty('--input', adjustL(bg, 10));
    root.style.setProperty('--sidebar-background', bg);
    root.style.setProperty('--sidebar-accent', adjustL(bg, 8));
    root.style.setProperty('--sidebar-border', adjustL(bg, 12));
    root.style.setProperty('--foreground', fg);
    root.style.setProperty('--card-foreground', fg);
    root.style.setProperty('--popover-foreground', fg);
    root.style.setProperty('--secondary-foreground', fg);
    root.style.setProperty('--sidebar-foreground', adjustL(fg, -6));
    root.style.setProperty('--sidebar-accent-foreground', adjustL(fg, -6));
    root.style.setProperty('--muted-foreground', adjustL(fg, -form.tema_muted_offset));

    const darkerPrimary = adjustL(primary, -5);
    root.style.setProperty('--gradient-accent', `linear-gradient(${form.tema_gradiente_direcao}, hsl(${primary}), hsl(${darkerPrimary}))`);
    root.style.setProperty('--gradient-primary', `linear-gradient(${form.tema_gradiente_direcao}, hsl(${adjustL(bg, 2)}), hsl(${adjustL(bg, 8)}))`);
    root.style.setProperty('--radius', `${form.tema_border_radius}px`);
    if (form.tema_card_opacidade < 100) {
      root.style.setProperty('--card-opacity', String(form.tema_card_opacidade / 100));
    } else {
      root.style.removeProperty('--card-opacity');
    }
    root.style.setProperty('--font-sans', `"${form.tema_fonte}", system-ui, sans-serif`);
    document.body.style.fontFamily = `"${form.tema_fonte}", system-ui, sans-serif`;
    root.style.setProperty('--theme-button-style', form.tema_botao_estilo);
    root.dataset.btnStyle = form.tema_botao_estilo;
    root.style.setProperty('--theme-gradient-dir', form.tema_gradiente_direcao);
    root.classList.toggle('no-btn-glow', !form.botao_borda_ativa);
    document.body.style.background = `hsl(${bg})`;
    root.style.setProperty('--theme-primary-hex', form.cor_primaria);
    root.style.setProperty('--theme-bg-hex', form.cor_secundaria);
    root.style.setProperty('--theme-fg-hex', form.cor_terciaria);
    // Status colors
    root.style.setProperty('--theme-success', form.cor_sucesso);
    root.style.setProperty('--theme-warning', form.cor_alerta);
    root.style.setProperty('--theme-error', form.cor_erro);
    root.style.setProperty('--theme-info', form.cor_info);
    // Button colors
    root.style.setProperty('--theme-btn-text', form.cor_botao_texto);
    root.style.setProperty('--theme-btn-bg', form.cor_botao_fundo);
    root.style.setProperty('--theme-btn-glow', form.cor_botao_borda);
    root.style.setProperty('--theme-btn-glow-active', form.botao_borda_ativa ? '1' : '0');
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let payload: Record<string, unknown> = {
        ...form,
        taxa_semanal_motorista: parseFloat(String(form.taxa_semanal_motorista)) || 0,
        tema_border_radius: Number(form.tema_border_radius) || 16,
        tema_card_opacidade: Number(form.tema_card_opacidade) || 100,
        tema_muted_offset: Number(form.tema_muted_offset) || 46,
        updated_at: new Date().toISOString(),
      };

      const save = async (p: Record<string, unknown>) => {
        if (config?.id) {
          const { error } = await supabase.from('config_plataforma').update(p).eq('id', config.id);
          return error;
        } else {
          const { error } = await supabase.from('config_plataforma').insert(p);
          return error;
        }
      };

      // Try full payload, strip unknown columns on 42703 errors
      for (let attempt = 0; attempt < 5; attempt++) {
        const error = await save(payload);
        if (!error) return;
        const msg = error.message || '';
        const colMatch = msg.match(/column "(\w+)" of relation/);
        if (error.code === '42703' && colMatch) {
          const badCol = colMatch[1];
          const { [badCol]: _, ...rest } = payload;
          payload = rest;
          continue;
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Configuração salva com sucesso!' });
      qc.invalidateQueries({ queryKey: ['config-plataforma'] });
      setHasChanges(false);
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
      </AdminLayout>
    );
  }

  const [activeTab, setActiveTab] = useState<'geral' | 'tema' | 'financeiro'>('geral');

  const FONT_OPTIONS = [
    'Plus Jakarta Sans',
    'Inter',
    'Poppins',
    'Roboto',
    'Nunito',
    'Montserrat',
    'Open Sans',
    'Lato',
    'Raleway',
    'Source Sans 3',
  ];

  const GRADIENT_OPTIONS = [
    { value: '135deg', label: 'Diagonal ↘' },
    { value: '180deg', label: 'Vertical ↓' },
    { value: '90deg', label: 'Horizontal →' },
    { value: '45deg', label: 'Diagonal ↗' },
    { value: '225deg', label: 'Diagonal ↙' },
    { value: '270deg', label: 'Horizontal ←' },
    { value: '0deg', label: 'Vertical ↑' },
  ];

  const BUTTON_STYLES = [
    { value: 'gradient', label: 'Gradiente' },
    { value: 'filled', label: 'Sólido' },
    { value: 'outline', label: 'Contorno' },
  ];

  const tabs = [
    { id: 'geral' as const, label: 'Geral', icon: <Settings className="w-4 h-4" /> },
    { id: 'tema' as const, label: 'Tema', icon: <Palette className="w-4 h-4" /> },
    { id: 'financeiro' as const, label: 'Financeiro', icon: <DollarSign className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent" /> Configurações
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Configurações gerais da plataforma</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-accent text-accent-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* ══ FINANCEIRO ══ */}
        {activeTab === 'financeiro' && (
        <div>
          <Card className="border bg-green-500/10 border-green-500/20">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-sm font-semibold text-green-400">Taxa Semanal do Motorista</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Valor cobrado semanalmente de cada motorista ativo.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">R$</span>
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.taxa_semanal_motorista}
                    onChange={e => updateField('taxa_semanal_motorista', e.target.value)}
                    placeholder="0.00"
                    className="w-28 sm:w-32 text-right font-semibold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* ══ GERAL ══ */}
        {activeTab === 'geral' && (
        <div>
          <div className="space-y-3">
            <Card className="border bg-accent/10 border-accent/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-accent">Nome da Plataforma</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Nome exibido ao público e nos relatórios.</p>
                  </div>
                  <Input value={form.nome_plataforma} onChange={e => updateField('nome_plataforma', e.target.value)} placeholder="RF Drive" className="w-full sm:w-40 font-semibold" />
                </div>
              </CardContent>
            </Card>
            <Card className="border bg-accent/10 border-accent/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-accent flex items-center gap-1.5"><Image className="w-4 h-4" />Logo da Plataforma</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Imagem exibida no cabeçalho e tela de login.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {form.logo_url ? (
                      <div className="relative group">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-accent/30">
                          <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            updateField('logo_url', '');
                            if (config?.id) {
                              await supabase.from('config_plataforma').update({ logo_url: '' }).eq('id', config.id);
                              qc.invalidateQueries({ queryKey: ['config-plataforma'] });
                            }
                            toast({ title: 'Logo removida' });
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          title="Remover logo"
                        >✕</button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center">
                        <Image className="w-5 h-5 text-white/20" />
                      </div>
                    )}
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/20 text-accent text-xs font-medium cursor-pointer hover:bg-accent/30 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {form.logo_url ? 'Trocar' : 'Enviar imagem'}
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split('.').pop();
                        const path = `logos/plataforma_${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
                        if (error) { toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }); return; }
                        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
                        const newUrl = urlData.publicUrl;
                        updateField('logo_url', newUrl);
                        // Persist immediately to DB
                        if (config?.id) {
                          const { error: dbErr } = await supabase.from('config_plataforma').update({ logo_url: newUrl }).eq('id', config.id);
                          if (dbErr) { toast({ title: 'Erro ao salvar logo', description: dbErr.message, variant: 'destructive' }); return; }
                          qc.invalidateQueries({ queryKey: ['config-plataforma'] });
                        }
                        toast({ title: 'Logo atualizada!', description: 'A nova logo será aplicada em todo o site.' });
                      }} />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border bg-accent/10 border-accent/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-accent">Slogan da Plataforma</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Frase exibida na tela de login e no título da página.</p>
                  </div>
                  <Input value={form.slogan} onChange={e => updateField('slogan', e.target.value)} placeholder="Seu transporte inteligente" className="w-full sm:w-52 font-semibold" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* ══ TEMA ══ */}
        {activeTab === 'tema' && (
        <>
        {/* ── Preview fixo no topo ── */}
        <Card className="border border-accent/20 bg-accent/5">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: form.cor_primaria }}>
                  <span className="text-lg font-bold" style={{ color: form.cor_secundaria }}>RF</span>
                </div>
                <div>
                  <p className="text-sm font-bold">{form.nome_plataforma}</p>
                  <p className="text-[10px] text-muted-foreground">Preview em tempo real</p>
                </div>
              </div>
              <div
                className="px-4 py-2 font-semibold text-sm rounded-lg"
                style={{
                  background: form.tema_botao_estilo === 'gradient'
                    ? `linear-gradient(${form.tema_gradiente_direcao}, ${form.cor_botao_fundo}, ${form.cor_botao_fundo}cc)`
                    : form.tema_botao_estilo === 'filled' ? form.cor_botao_fundo : 'transparent',
                  color: form.tema_botao_estilo === 'outline' ? form.cor_botao_fundo : form.cor_botao_texto,
                  border: form.tema_botao_estilo === 'outline' ? `2px solid ${form.cor_botao_fundo}` : 'none',
                  borderRadius: `${form.tema_border_radius}px`,
                  boxShadow: form.botao_borda_ativa ? `0 0 14px ${form.cor_botao_borda}50, 0 0 40px ${form.cor_botao_borda}18` : 'none',
                }}
              >Botão</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { color: form.cor_sucesso, label: 'Sucesso' },
                { color: form.cor_alerta, label: 'Alerta' },
                { color: form.cor_erro, label: 'Erro' },
                { color: form.cor_info, label: 'Info' },
              ].map(s => (
                <div key={s.label} className="px-2.5 py-1 text-[10px] font-semibold rounded-full" style={{ backgroundColor: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>{s.label}</div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Cores Principais ── */}
        <Card className="border border-border">
          <CardContent className="py-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Palette className="w-3.5 h-3.5" /> Cores Principais
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'cor_primaria', label: 'Primária', ph: '#FFD000' },
                { key: 'cor_secundaria', label: 'Fundo', ph: '#0a0a0a' },
                { key: 'cor_terciaria', label: 'Texto', ph: '#ffffff' },
              ].map(c => (
                <div key={c.key} className="flex flex-col items-center gap-1.5">
                  <label className="relative cursor-pointer group">
                    <input type="color" value={(form as any)[c.key] || c.ph} onChange={e => updateField(c.key, e.target.value)} className="w-12 h-12 rounded-xl border-2 border-border cursor-pointer bg-transparent group-hover:scale-105 transition-transform" />
                  </label>
                  <span className="text-[10px] font-medium text-muted-foreground">{c.label}</span>
                  <Input type="text" value={(form as any)[c.key]} onChange={e => updateField(c.key, e.target.value)} className="w-full text-center font-mono text-[11px] h-7 px-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Cores de Status ── */}
        <Card className="border border-border">
          <CardContent className="py-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Cores de Status
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: 'cor_sucesso', label: 'Sucesso', ph: '#22c55e' },
                { key: 'cor_alerta', label: 'Alerta', ph: '#f59e0b' },
                { key: 'cor_erro', label: 'Erro', ph: '#ef4444' },
                { key: 'cor_info', label: 'Info', ph: '#3b82f6' },
              ].map(c => (
                <div key={c.key} className="flex flex-col items-center gap-1.5">
                  <label className="relative cursor-pointer group">
                    <input type="color" value={(form as any)[c.key] || c.ph} onChange={e => updateField(c.key, e.target.value)} className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer bg-transparent group-hover:scale-105 transition-transform" />
                  </label>
                  <span className="text-[10px] font-medium text-muted-foreground">{c.label}</span>
                  <Input type="text" value={(form as any)[c.key]} onChange={e => updateField(c.key, e.target.value)} className="w-full text-center font-mono text-[10px] h-7 px-0.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Botões ── */}
        <Card className="border border-border">
          <CardContent className="py-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Paintbrush className="w-3.5 h-3.5" /> Botões
            </h3>
            {/* Estilo + Direção */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">Estilo</span>
                <Select value={form.tema_botao_estilo} onValueChange={v => updateField('tema_botao_estilo', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUTTON_STYLES.map(b => (<SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">Gradiente</span>
                <Select value={form.tema_gradiente_direcao} onValueChange={v => updateField('tema_gradiente_direcao', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADIENT_OPTIONS.map(g => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Cores do botão */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'cor_botao_texto', label: 'Texto', ph: '#0a0a0a' },
                { key: 'cor_botao_fundo', label: 'Fundo', ph: '#FFD000' },
                { key: 'cor_botao_borda', label: 'Brilho', ph: '#FFD000' },
              ].map(c => (
                <div key={c.key} className="flex flex-col items-center gap-1.5">
                  <label className="relative cursor-pointer group">
                    <input type="color" value={(form as any)[c.key] || c.ph} onChange={e => updateField(c.key, e.target.value)} className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer bg-transparent group-hover:scale-105 transition-transform" />
                  </label>
                  <span className="text-[10px] font-medium text-muted-foreground">{c.label}</span>
                  <Input type="text" value={(form as any)[c.key]} onChange={e => updateField(c.key, e.target.value)} className="w-full text-center font-mono text-[10px] h-7 px-0.5" />
                </div>
              ))}
            </div>
            {/* Glow toggle */}
            <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
              <input type="checkbox" id="botaoBordaAtiva" checked={form.botao_borda_ativa} onChange={e => updateField('botao_borda_ativa', e.target.checked)} className="w-4 h-4 rounded border-border text-accent focus:ring-accent" />
              <label htmlFor="botaoBordaAtiva" className="text-xs cursor-pointer">
                <span className="font-medium">Ativar brilho/sombra</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ── Tipografia & Layout ── */}
        <Card className="border border-border">
          <CardContent className="py-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Type className="w-3.5 h-3.5" /> Tipografia & Layout
            </h3>
            {/* Fonte */}
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground">Fonte</span>
              <Select value={form.tema_fonte} onValueChange={v => updateField('tema_fonte', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => (<SelectItem key={f} value={f}><span style={{ fontFamily: `"${f}", sans-serif` }}>{f}</span></SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {/* Arredondamento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Radius className="w-3 h-3" /> Arredondamento</span>
                <span className="text-xs font-bold text-accent">{form.tema_border_radius}px</span>
              </div>
              <Slider value={[form.tema_border_radius]} onValueChange={([v]) => updateField('tema_border_radius', v)} min={0} max={32} step={2} className="w-full" />
            </div>
            {/* Opacidade dos Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" /> Opacidade dos Cards</span>
                <span className="text-xs font-bold text-accent">{form.tema_card_opacidade}%</span>
              </div>
              <Slider value={[form.tema_card_opacidade]} onValueChange={([v]) => updateField('tema_card_opacidade', v)} min={30} max={100} step={5} className="w-full" />
            </div>
            {/* Contraste texto secundário */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Paintbrush className="w-3 h-3" /> Contraste Secundário</span>
                <span className="text-xs font-bold text-accent">{form.tema_muted_offset}</span>
              </div>
              <Slider value={[form.tema_muted_offset]} onValueChange={([v]) => updateField('tema_muted_offset', v)} min={10} max={70} step={2} className="w-full" />
            </div>
          </CardContent>
        </Card>
        </>
        )}
      </div>

      <div className="mt-6">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          className="w-full gap-2"
          size="lg"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          Salvar Configurações
        </Button>

        {config?.updated_at && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Última atualização: {new Date(config.updated_at).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminConfig;
