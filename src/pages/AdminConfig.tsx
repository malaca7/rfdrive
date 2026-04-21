import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AdminLayout from '@/components/AdminLayout';
import {
  Settings, DollarSign, Save, Loader2,
  Image, Upload, TableProperties, Timer, SlidersHorizontal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { logPlatformActivity } from '@/lib/activity-log';

const AdminPricing = React.lazy(() => import('@/components/AdminPricing'));
const AdminTabelaPrecos = React.lazy(() => import('@/components/AdminTabelaPrecos'));

type ConfigPlataforma = {
  id: string;
  taxa_semanal_motorista: number;
  nome_plataforma: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_municipal: string;
  email_empresa: string;
  telefone_empresa: string;
  endereco_empresa: string;
  cor_primaria: string;
  logo_url: string;
  slogan: string;
  senha_padrao: string;
  updated_at: string;
};

const DEFAULT_CONFIG: Omit<ConfigPlataforma, 'id' | 'updated_at'> = {
  taxa_semanal_motorista: 0,
  nome_plataforma: 'RF Drive',
  razao_social: 'Escritorio RF',
  nome_fantasia: 'RF Drive',
  cnpj: '',
  inscricao_municipal: '',
  email_empresa: '',
  telefone_empresa: '',
  endereco_empresa: '',
  logo_url: '',
  slogan: 'Seu transporte inteligente',
  senha_padrao: '123456',
  cor_primaria: '#086AB8',
};

const AdminConfig: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
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
        razao_social: (config as any).razao_social ?? 'Escritorio RF',
        nome_fantasia: (config as any).nome_fantasia ?? (config.nome_plataforma ?? 'RF Drive'),
        cnpj: (config as any).cnpj ?? '',
        inscricao_municipal: (config as any).inscricao_municipal ?? '',
        email_empresa: (config as any).email_empresa ?? '',
        telefone_empresa: (config as any).telefone_empresa ?? '',
        endereco_empresa: (config as any).endereco_empresa ?? '',
        cor_primaria: (config as any).cor_primaria ?? '#FFD000',
        logo_url: (config as any).logo_url ?? '',
        slogan: (config as any).slogan ?? 'Seu transporte inteligente',
        senha_padrao: (config as any).senha_padrao ?? '123456',
      });
      setHasChanges(false);
    }
  }, [config]);

  const updateField = (field: string, value: string | number | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let payload: Record<string, unknown> = {
        ...form,
        taxa_semanal_motorista: parseFloat(String(form.taxa_semanal_motorista)) || 0,
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
      let saved = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const error = await save(payload);
        if (!error) {
          saved = true;
          break;
        }
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

      if (!saved) throw new Error('Falha ao salvar configuração');

      await logPlatformActivity({
        userId: user?.id,
        action: 'atualizar_config_plataforma',
        category: 'config',
        entity: 'config_plataforma',
        entityId: config?.id || null,
        details: {
          nome_plataforma: form.nome_plataforma,
          razao_social: form.razao_social,
          cnpj: form.cnpj,
          taxa_semanal_motorista: form.taxa_semanal_motorista,
        },
      });
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

  const [activeTab, setActiveTab] = useState<'geral' | 'financeiro' | 'precos'>('geral');
  const [activePrecoTab, setActivePrecoTab] = useState<'tabela' | 'tarifas' | 'horarios'>('tabela');

  const tabs = [
    { id: 'geral' as const, label: 'Geral', icon: <Settings className="w-4 h-4" /> },
    { id: 'financeiro' as const, label: 'Financeiro', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'precos' as const, label: 'Preços', icon: <TableProperties className="w-4 h-4" /> },
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
                      <div className="w-14 h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                        <Image className="w-5 h-5 text-muted-foreground/40" />
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

            <Card className="border bg-accent/10 border-accent/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-semibold text-accent">Senha Padrão de Acesso</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Senha usada ao criar novos motoristas ou redefinir senhas.</p>
                  </div>
                  <Input value={form.senha_padrao} onChange={e => updateField('senha_padrao', e.target.value)} placeholder="123456" className="w-full sm:w-52 font-semibold" type="password" autoComplete="new-password" />
                </div>
              </CardContent>
            </Card>

            <Card className="border bg-accent/10 border-accent/20">
              <CardContent className="py-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-accent">Informacoes da Empresa</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Dados usados em recibos e documentos da plataforma.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input value={form.razao_social} onChange={e => updateField('razao_social', e.target.value)} placeholder="Razao Social" className="font-semibold" />
                  <Input value={form.nome_fantasia} onChange={e => updateField('nome_fantasia', e.target.value)} placeholder="Nome Fantasia" className="font-semibold" />
                  <Input value={form.cnpj} onChange={e => updateField('cnpj', e.target.value)} placeholder="CNPJ" className="font-semibold" />
                  <Input value={form.inscricao_municipal} onChange={e => updateField('inscricao_municipal', e.target.value)} placeholder="Inscricao Municipal" className="font-semibold" />
                  <Input value={form.email_empresa} onChange={e => updateField('email_empresa', e.target.value)} placeholder="Email da Empresa" className="font-semibold" />
                  <Input value={form.telefone_empresa} onChange={e => updateField('telefone_empresa', e.target.value)} placeholder="Telefone da Empresa" className="font-semibold" />
                </div>

                <Input value={form.endereco_empresa} onChange={e => updateField('endereco_empresa', e.target.value)} placeholder="Endereco da Empresa" className="font-semibold" />
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* ══ PREÇOS ══ */}
        {activeTab === 'precos' && (
        <div className="space-y-3">
          <div className="flex gap-1 bg-muted/30 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActivePrecoTab('tabela')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                activePrecoTab === 'tabela'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              Tabela
            </button>
            <button
              onClick={() => setActivePrecoTab('tarifas')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                activePrecoTab === 'tarifas'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Tarifas
            </button>
            <button
              onClick={() => setActivePrecoTab('horarios')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                activePrecoTab === 'horarios'
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Timer className="w-4 h-4" />
              Horários
            </button>
          </div>

          <Card className="border">
            <CardContent className="py-4 px-0 sm:px-1">
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>}>
                {activePrecoTab === 'tabela' && <AdminTabelaPrecos />}
                {activePrecoTab === 'tarifas' && <AdminPricing key="tarifas" defaultTab="tarifas" hideTabs />}
                {activePrecoTab === 'horarios' && <AdminPricing key="horarios" defaultTab="horarios" hideTabs />}
              </Suspense>
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {activeTab !== 'precos' && (
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
      )}
    </AdminLayout>
  );
};

export default AdminConfig;
