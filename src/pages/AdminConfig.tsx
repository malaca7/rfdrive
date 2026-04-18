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

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent" /> Configurações
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Configurações gerais da plataforma</p>
      </div>

      <div className="space-y-5">
        {/* ══ FINANCEIRO ══ */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-green-400" /> Financeiro
          </h3>
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

        {/* ══ GERAL ══ */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-accent" /> Geral
          </h3>
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
                    {form.logo_url && (
                      <div className="mt-2 w-12 h-12 rounded-xl overflow-hidden border border-accent/30">
                        <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 items-start sm:items-end">
                    <Input value={form.logo_url} onChange={e => updateField('logo_url', e.target.value)} placeholder="https://..." className="w-full sm:w-52 text-xs" />
                    <label className="flex items-center gap-1 text-[11px] text-accent cursor-pointer hover:underline">
                      <Upload className="w-3 h-3" />Upload
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split('.').pop();
                        const path = `logos/plataforma_${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
                        if (error) { toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }); return; }
                        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
                        updateField('logo_url', urlData.publicUrl);
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

        {/* ══ CORES DO TEMA ══ */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-purple-400" /> Cores do Tema
          </h3>
          <div className="space-y-3">
            {[
              { key: 'cor_primaria', label: 'Cor Primária', desc: 'Cor principal (botões, destaques).', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', ph: '#FFD000' },
              { key: 'cor_secundaria', label: 'Cor de Fundo', desc: 'Cor de fundo principal do site.', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', ph: '#0a0a0a' },
              { key: 'cor_terciaria', label: 'Cor de Texto', desc: 'Cor dos textos e elementos de conteúdo.', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', ph: '#ffffff' },
              { key: 'cor_sucesso', label: 'Cor de Sucesso', desc: 'Aprovações, confirmações, status positivo.', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', ph: '#22c55e' },
              { key: 'cor_alerta', label: 'Cor de Alerta', desc: 'Avisos, pendências, status em análise.', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', ph: '#f59e0b' },
              { key: 'cor_erro', label: 'Cor de Erro', desc: 'Erros, rejeições, status negativo.', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', ph: '#ef4444' },
              { key: 'cor_info', label: 'Cor de Informação', desc: 'Dicas, informações, notificações neutras.', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', ph: '#3b82f6' },
            ].map(c => (
              <Card key={c.key} className={`border ${c.bg}`}>
                <CardContent className="py-3 sm:py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                    <div>
                      <p className={`text-sm font-semibold ${c.color}`}>{c.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">{c.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="color"
                        value={(form as any)[c.key] || c.ph}
                        onChange={e => updateField(c.key, e.target.value)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        type="text"
                        value={(form as any)[c.key]}
                        onChange={e => updateField(c.key, e.target.value)}
                        placeholder={c.ph}
                        className="w-24 sm:w-28 font-mono text-sm font-semibold"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ══ APARÊNCIA AVANÇADA ══ */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-cyan-400" /> Aparência Avançada
          </h3>
          <div className="space-y-3">
            {/* Fonte */}
            <Card className="border bg-cyan-500/10 border-cyan-500/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-cyan-400 flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Fonte</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Família tipográfica usada em todo o app.</p>
                  </div>
                  <Select value={form.tema_fonte} onValueChange={v => updateField('tema_fonte', v)}>
                    <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f} value={f}><span style={{ fontFamily: `"${f}", sans-serif` }}>{f}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Border Radius */}
            <Card className="border bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5"><Radius className="w-3.5 h-3.5" /> Arredondamento</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Raio das bordas de cards e botões.</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">{form.tema_border_radius}px</span>
                </div>
                <Slider
                  value={[form.tema_border_radius]}
                  onValueChange={([v]) => updateField('tema_border_radius', v)}
                  min={0} max={32} step={2}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0px (reto)</span>
                  <span>16px (padrão)</span>
                  <span>32px (arredondado)</span>
                </div>
              </CardContent>
            </Card>

            {/* Card Opacity */}
            <Card className="border bg-violet-500/10 border-violet-500/20">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-violet-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Opacidade dos Cards</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Transparência dos cards e painéis.</p>
                  </div>
                  <span className="text-sm font-bold text-violet-400">{form.tema_card_opacidade}%</span>
                </div>
                <Slider
                  value={[form.tema_card_opacidade]}
                  onValueChange={([v]) => updateField('tema_card_opacidade', v)}
                  min={30} max={100} step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>30% (transparente)</span>
                  <span>100% (sólido)</span>
                </div>
              </CardContent>
            </Card>

            {/* Muted Foreground Offset */}
            <Card className="border bg-stone-500/10 border-stone-500/20">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-stone-400 flex items-center gap-1.5"><Paintbrush className="w-3.5 h-3.5" /> Contraste de Texto Secundário</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Intensidade da cor dos textos secundários.</p>
                  </div>
                  <span className="text-sm font-bold text-stone-400">{form.tema_muted_offset}</span>
                </div>
                <Slider
                  value={[form.tema_muted_offset]}
                  onValueChange={([v]) => updateField('tema_muted_offset', v)}
                  min={10} max={70} step={2}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10 (mais visível)</span>
                  <span>46 (padrão)</span>
                  <span>70 (mais sutil)</span>
                </div>
              </CardContent>
            </Card>

            {/* Gradient Direction */}
            <Card className="border bg-orange-500/10 border-orange-500/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-orange-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Direção do Gradiente</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sentido dos gradientes aplicados.</p>
                  </div>
                  <Select value={form.tema_gradiente_direcao} onValueChange={v => updateField('tema_gradiente_direcao', v)}>
                    <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADIENT_OPTIONS.map(g => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Button Style */}
            <Card className="border bg-rose-500/10 border-rose-500/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-rose-400 flex items-center gap-1.5"><Paintbrush className="w-3.5 h-3.5" /> Estilo dos Botões</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Aparência dos botões de ação.</p>
                  </div>
                  <Select value={form.tema_botao_estilo} onValueChange={v => updateField('tema_botao_estilo', v)}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUTTON_STYLES.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Button Text Color */}
            <Card className="border bg-fuchsia-500/10 border-fuchsia-500/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-fuchsia-400 flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Cor do Texto do Botão</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Cor do texto dentro dos botões de ação.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="color" value={form.cor_botao_texto} onChange={e => updateField('cor_botao_texto', e.target.value)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
                    <Input type="text" value={form.cor_botao_texto} onChange={e => updateField('cor_botao_texto', e.target.value)} placeholder="#0a0a0a" className="w-24 sm:w-28 font-mono text-sm font-semibold" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Button Background Color */}
            <Card className="border bg-amber-500/10 border-amber-500/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Cor de Fundo do Botão</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Cor de fundo / base dos botões de ação.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="color" value={form.cor_botao_fundo} onChange={e => updateField('cor_botao_fundo', e.target.value)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
                    <Input type="text" value={form.cor_botao_fundo} onChange={e => updateField('cor_botao_fundo', e.target.value)} placeholder="#FFD000" className="w-24 sm:w-28 font-mono text-sm font-semibold" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Button Glow/Shadow Border */}
            <Card className="border bg-indigo-500/10 border-indigo-500/20">
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-indigo-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Borda Esfumaçada do Botão</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Cor do brilho/sombra ao redor dos botões.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="color" value={form.cor_botao_borda} onChange={e => updateField('cor_botao_borda', e.target.value)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
                    <Input type="text" value={form.cor_botao_borda} onChange={e => updateField('cor_botao_borda', e.target.value)} placeholder="#FFD000" className="w-24 sm:w-28 font-mono text-sm font-semibold" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <input type="checkbox" id="botaoBordaAtiva" checked={form.botao_borda_ativa} onChange={e => updateField('botao_borda_ativa', e.target.checked)} className="w-5 h-5 rounded border-border text-accent focus:ring-accent" />
                  <label htmlFor="botaoBordaAtiva" className="text-sm cursor-pointer">
                    <span className="font-medium">Ativar borda esfumaçada</span>
                    <span className="text-muted-foreground text-xs ml-1">(glow/shadow nos botões)</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ══ PREVIEW ══ */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-accent" /> Preview
            <span className="text-[10px] font-normal text-muted-foreground ml-1">• Atualiza em tempo real</span>
          </h3>
          <Card className="border border-border">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: form.cor_primaria }}>
                  <span className="text-lg font-bold" style={{ color: form.cor_secundaria }}>RF</span>
                </div>
                <div>
                  <p className="text-sm font-bold">{form.nome_plataforma}</p>
                  <p className="text-[10px] text-muted-foreground">Preview do tema</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 p-3 rounded-lg border" style={{ backgroundColor: `${form.cor_secundaria}ee`, borderColor: `${form.cor_primaria}30`, borderRadius: `${form.tema_border_radius}px` }}>
                  <p className="text-xs" style={{ color: form.cor_terciaria }}>Card com as cores selecionadas</p>
                </div>
                <div
                  className="px-4 py-2 font-semibold text-sm flex items-center"
                  style={{
                    background: form.tema_botao_estilo === 'gradient'
                      ? `linear-gradient(${form.tema_gradiente_direcao}, ${form.cor_botao_fundo}, ${form.cor_botao_fundo}cc)`
                      : form.tema_botao_estilo === 'filled'
                        ? form.cor_botao_fundo
                        : 'transparent',
                    color: form.tema_botao_estilo === 'outline' ? form.cor_botao_fundo : form.cor_botao_texto,
                    border: form.tema_botao_estilo === 'outline' ? `2px solid ${form.cor_botao_fundo}` : 'none',
                    borderRadius: `${form.tema_border_radius}px`,
                    boxShadow: form.botao_borda_ativa
                      ? `0 0 14px ${form.cor_botao_borda}50, 0 0 40px ${form.cor_botao_borda}18`
                      : 'none',
                  }}
                >
                  Botão
                </div>
              </div>
              {/* Status colors preview */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { color: form.cor_sucesso, label: 'Sucesso' },
                  { color: form.cor_alerta, label: 'Alerta' },
                  { color: form.cor_erro, label: 'Erro' },
                  { color: form.cor_info, label: 'Info' },
                ].map(s => (
                  <div
                    key={s.label}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-full"
                    style={{ backgroundColor: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
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
