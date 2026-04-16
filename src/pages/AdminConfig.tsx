import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/AdminLayout';
import {
  Settings, DollarSign, Save, Loader2, Calendar,
  Shield, Clock, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ConfigPlataforma = {
  id: string;
  taxa_semanal_motorista: number;
  nome_plataforma: string;
  telefone_suporte: string;
  horario_funcionamento_inicio: string;
  horario_funcionamento_fim: string;
  updated_at: string;
};

const DEFAULT_CONFIG: Omit<ConfigPlataforma, 'id' | 'updated_at'> = {
  taxa_semanal_motorista: 0,
  nome_plataforma: 'RF Drive',
  telefone_suporte: '',
  horario_funcionamento_inicio: '06:00',
  horario_funcionamento_fim: '22:00',
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
        telefone_suporte: config.telefone_suporte ?? '',
        horario_funcionamento_inicio: config.horario_funcionamento_inicio ?? '06:00',
        horario_funcionamento_fim: config.horario_funcionamento_fim ?? '22:00',
      });
      setHasChanges(false);
    }
  }, [config]);

  const updateField = (field: string, value: string | number) => {
    setForm(f => ({ ...f, [field]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        taxa_semanal_motorista: parseFloat(String(form.taxa_semanal_motorista)) || 0,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase.from('config_plataforma').update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('config_plataforma').insert(payload);
        if (error) throw error;
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

  const configSections = [
    {
      title: 'Financeiro',
      icon: <DollarSign className="w-4 h-4 text-green-400" />,
      items: [
        {
          key: 'taxa_semanal_motorista',
          label: 'Taxa Semanal do Motorista',
          desc: 'Valor cobrado semanalmente de cada motorista ativo na plataforma.',
          type: 'number' as const,
          prefix: 'R$',
          placeholder: '0.00',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10 border-green-500/20',
        },
      ],
    },
    {
      title: 'Geral',
      icon: <Settings className="w-4 h-4 text-accent" />,
      items: [
        {
          key: 'nome_plataforma',
          label: 'Nome da Plataforma',
          desc: 'Nome exibido ao público e nos relatórios.',
          type: 'text' as const,
          placeholder: 'RF Drive',
          color: 'text-accent',
          bgColor: 'bg-accent/10 border-accent/20',
        },
        {
          key: 'telefone_suporte',
          label: 'Telefone de Suporte',
          desc: 'Número de contato para suporte via WhatsApp.',
          type: 'tel' as const,
          placeholder: '(99) 99999-9999',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10 border-blue-500/20',
        },
      ],
    },
    {
      title: 'Horário de Funcionamento',
      icon: <Clock className="w-4 h-4 text-purple-400" />,
      items: [
        {
          key: 'horario_funcionamento_inicio',
          label: 'Início',
          desc: 'Horário de início do funcionamento da plataforma.',
          type: 'time' as const,
          placeholder: '06:00',
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10 border-purple-500/20',
        },
        {
          key: 'horario_funcionamento_fim',
          label: 'Fim',
          desc: 'Horário de encerramento do funcionamento.',
          type: 'time' as const,
          placeholder: '22:00',
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10 border-purple-500/20',
        },
      ],
    },
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
        {configSections.map(section => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              {section.icon} {section.title}
            </h3>
            <div className="space-y-3">
              {section.items.map(cfg => (
                <Card key={cfg.key} className={`border ${cfg.bgColor}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.desc}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {'prefix' in cfg && cfg.prefix && (
                              <span className="text-xs text-muted-foreground font-medium">{cfg.prefix}</span>
                            )}
                            <Input
                              type={cfg.type}
                              step={cfg.type === 'number' ? '0.01' : undefined}
                              min={cfg.type === 'number' ? '0' : undefined}
                              value={(form as any)[cfg.key]}
                              onChange={e => updateField(cfg.key, cfg.type === 'number' ? e.target.value : e.target.value)}
                              placeholder={cfg.placeholder}
                              className={`w-40 ${cfg.type === 'number' ? 'text-right' : ''} font-semibold`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
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
