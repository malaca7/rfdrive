import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, DollarSign, Clock, Zap, Plus, Pencil, Trash2, Save,
  ChevronRight, ChevronDown, Search, Loader2, ToggleLeft, ToggleRight,
  TreePine, ArrowRight, Calculator, AlertTriangle, CheckCircle, Info,
  Map, Tag, Layers,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  calcularPreco, invalidatePricingCache,
  type Localidade, type PrecoRota, type RegraHorario, type PricingResult, type ConfigTarifas,
} from '@/lib/pricing-engine';

// ── Types ──
type LocalidadeRow = Localidade & { created_at: string; updated_at: string };
type PrecoRotaRow = PrecoRota & { created_at: string; updated_at: string };
type RegraHorarioRow = RegraHorario & { created_at: string; updated_at: string };

const TIPO_LABELS: Record<string, string> = {
  cidade: '🏙️ Cidade',
  zona: '🗺️ Zona',
  bairro: '🏘️ Bairro',
  local: '📍 Local',
  rua: '🛣️ Rua',
  ponto: '📌 Ponto',
};

const TIPO_COLORS: Record<string, string> = {
  cidade: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  zona: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  bairro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  local: 'bg-green-500/20 text-green-400 border-green-500/30',
  rua: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ponto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════
const AdminPricing: React.FC<{ defaultTab?: string }> = ({ defaultTab = 'tarifas' }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Fetch Data ──
  const { data: localidades = [], isLoading: loadingLoc } = useQuery({
    queryKey: ['pricing-localidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('localidades').select('*').order('nome');
      if (error) throw error;
      return data as LocalidadeRow[];
    },
  });

  const { data: precosRotas = [], isLoading: loadingPrecos } = useQuery({
    queryKey: ['pricing-precos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('precos_rotas').select('*').order('prioridade', { ascending: false });
      if (error) throw error;
      return data as PrecoRotaRow[];
    },
  });

  const { data: regrasHorario = [], isLoading: loadingRegras, error: regrasError } = useQuery({
    queryKey: ['pricing-regras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regras_horario').select('*').order('hora_inicio');
      if (error) throw error;
      return data as RegraHorarioRow[];
    },
    retry: 1,
  });

  const { data: configTarifas, isLoading: loadingConfig } = useQuery({
    queryKey: ['config-tarifas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('config_tarifas').select('*').limit(1).single();
      if (error) throw error;
      return data as ConfigTarifas & { created_at: string; updated_at: string };
    },
    retry: 1,
  });

  const refreshAll = () => {
    invalidatePricingCache();
    qc.invalidateQueries({ queryKey: ['pricing-localidades'] });
    qc.invalidateQueries({ queryKey: ['pricing-precos'] });
    qc.invalidateQueries({ queryKey: ['pricing-regras'] });
    qc.invalidateQueries({ queryKey: ['config-tarifas'] });
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="tarifas" className="gap-1 text-xs">
            <Tag className="w-3.5 h-3.5" /> Tarifas
          </TabsTrigger>
          <TabsTrigger value="horarios" className="gap-1 text-xs">
            <Clock className="w-3.5 h-3.5" /> Horários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarifas">
          <TarifasTab config={configTarifas ?? null} loading={loadingConfig} onRefresh={refreshAll} />
        </TabsContent>

        <TabsContent value="horarios">
          {regrasError ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-destructive font-semibold">Erro ao carregar regras de horário</p>
              <p className="text-xs text-muted-foreground">Execute a migration <code>20260413170000_fix_all_schema_cache.sql</code> no SQL Editor do Supabase</p>
            </div>
          ) : (
            <HorariosTab regras={regrasHorario} loading={loadingRegras} onRefresh={refreshAll} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// TAB 0: CONFIGURAÇÃO DE TARIFAS
// ══════════════════════════════════════════════════════════
const TarifasTab: React.FC<{
  config: (ConfigTarifas & { created_at?: string; updated_at?: string }) | null;
  loading: boolean;
  onRefresh: () => void;
}> = ({ config, loading, onRefresh }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    tarifa_minima: '',
    taxa_bagagem: '',
    tarifa_mesmo_bairro: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Sync form with loaded config
  React.useEffect(() => {
    if (config) {
      setForm({
        tarifa_minima: String(config.tarifa_minima ?? 0),
        taxa_bagagem: String(config.taxa_bagagem ?? 5),
        tarifa_mesmo_bairro: String(config.tarifa_mesmo_bairro ?? 10),
      });
      setHasChanges(false);
    }
  }, [config]);

  const updateField = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tarifa_minima: parseFloat(form.tarifa_minima) || 0,
        taxa_bagagem: parseFloat(form.taxa_bagagem) || 0,
        tarifa_mesmo_bairro: parseFloat(form.tarifa_mesmo_bairro) || 10,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase.from('config_tarifas').update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('config_tarifas').insert({ ...payload, ativo: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Configuração salva!' });
      onRefresh();
      setHasChanges(false);
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }),
  });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const tarifaConfigs = [
    {
      key: 'tarifa_minima',
      label: 'Tarifa Mínima',
      desc: 'Valor mínimo cobrado em qualquer corrida, independente da distância.',
      icon: <DollarSign className="w-4 h-4" />,
      prefix: 'R$',
      placeholder: '0.00',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 border-green-500/20',
    },
    {
      key: 'taxa_bagagem',
      label: 'Taxa de Bagagem/Feira',
      desc: 'Valor adicional cobrado quando o passageiro leva feira ou bagagem grande.',
      icon: <Layers className="w-4 h-4" />,
      prefix: 'R$',
      placeholder: '5.00',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      key: 'tarifa_mesmo_bairro',
      label: 'Tarifa Mesmo Bairro',
      desc: 'Valor fixo cobrado quando origem e destino são no mesmo bairro.',
      icon: <MapPin className="w-4 h-4" />,
      prefix: 'R$',
      placeholder: '10.00',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1 py-2">
        <Tag className="w-8 h-8 text-accent mx-auto" />
        <h3 className="font-semibold text-sm">Configuração de Tarifas</h3>
        <p className="text-xs text-muted-foreground">Defina os valores globais que se aplicam a todas as corridas</p>
      </div>

      <div className="space-y-3">
        {tarifaConfigs.map(cfg => (
          <Card key={cfg.key} className={`border ${cfg.bgColor}`}>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className={`mt-1 ${cfg.color}`}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-medium">{cfg.prefix}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(form as any)[cfg.key]}
                        onChange={e => updateField(cfg.key, e.target.value)}
                        placeholder={cfg.placeholder}
                        className="w-28 text-right font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !hasChanges}
        className="w-full gap-2"
        size="lg"
      >
        {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        <Save className="w-4 h-4" />
        Salvar Configuração
      </Button>

      {config?.updated_at && (
        <p className="text-[10px] text-muted-foreground text-center">
          Última atualização: {new Date(config.updated_at).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// TAB 1: LOCALIDADES
// ══════════════════════════════════════════════════════════
const LocalidadesTab: React.FC<{
  localidades: LocalidadeRow[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ localidades, loading, onRefresh }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    nome: '', tipo: 'bairro', parent_id: '' as string | null,
    latitude: '', longitude: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);

  // Build tree
  const tree = useMemo(() => {
    const filtered = search
      ? localidades.filter(l => l.nome.toLowerCase().includes(search.toLowerCase()))
      : localidades;
    const roots = filtered.filter(l => !l.parent_id || (search && !filtered.find(f => f.id === l.parent_id)));
    return { roots, all: localidades, filtered };
  }, [localidades, search]);

  const getChildren = (parentId: string) => {
    if (search) return tree.filtered.filter(l => l.parent_id === parentId);
    return tree.all.filter(l => l.parent_id === parentId);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        parent_id: form.parent_id || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      };
      if (editingId) {
        const { error } = await supabase.from('localidades').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('localidades').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Localidade atualizada!' : 'Localidade criada!' });
      onRefresh();
      setShowDialog(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar localidade', description: e?.message || 'Erro desconhecido', variant: 'destructive' }),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('localidades').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { onRefresh(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Move children to grandparent
      const loc = localidades.find(l => l.id === id);
      await supabase.from('localidades').update({ parent_id: loc?.parent_id || null }).eq('parent_id', id);
      const { error } = await supabase.from('localidades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Localidade excluída!' });
      onRefresh();
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setForm({ nome: '', tipo: 'bairro', parent_id: null, latitude: '', longitude: '' });
    setEditingId(null);
  };

  const openEdit = (loc: LocalidadeRow) => {
    setEditingId(loc.id);
    setForm({
      nome: loc.nome,
      tipo: loc.tipo,
      parent_id: loc.parent_id,
      latitude: loc.latitude != null ? String(loc.latitude) : '',
      longitude: loc.longitude != null ? String(loc.longitude) : '',
    });
    setShowDialog(true);
  };

  const openNew = (parentId?: string) => {
    resetForm();
    if (parentId) setForm(f => ({ ...f, parent_id: parentId }));
    setShowDialog(true);
  };

  // Recursive tree node
  const TreeNode: React.FC<{ loc: LocalidadeRow; depth: number }> = ({ loc, depth }) => {
    const children = getChildren(loc.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(loc.id);

    return (
      <div>
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group ${!loc.ativo ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(loc.id)} className="p-0.5 hover:bg-muted rounded">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4.5" />
          )}

          <Badge variant="outline" className={`text-[10px] px-1.5 ${TIPO_COLORS[loc.tipo] || ''}`}>
            {loc.tipo}
          </Badge>

          <span className="text-sm font-medium flex-1 truncate">{loc.nome}</span>

          {loc.latitude && loc.longitude && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
            </span>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openNew(loc.id)}>
              <Plus className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(loc)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={() => toggleAtivoMutation.mutate({ id: loc.id, ativo: !loc.ativo })}
            >
              {loc.ativo ? <ToggleRight className="w-3.5 h-3.5 text-green-400" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
              onClick={() => setDeleteConfirm({ id: loc.id, nome: loc.nome })}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <AnimatePresence>
          {isExpanded && children.map(child => (
            <motion.div key={child.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <TreeNode loc={child} depth={depth + 1} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar localidade..." className="pl-9" />
        </div>
        <Button onClick={() => openNew()} className="gap-1 shrink-0">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(TIPO_LABELS).map(([tipo, label]) => {
          const count = localidades.filter(l => l.tipo === tipo).length;
          if (!count) return null;
          return (
            <Badge key={tipo} variant="outline" className={`text-[10px] ${TIPO_COLORS[tipo]}`}>
              {label} ({count})
            </Badge>
          );
        })}
        <Badge variant="outline" className="text-[10px]">Total: {localidades.length}</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : localidades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TreePine className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma localidade cadastrada</p>
            <Button onClick={() => openNew()} className="mt-3 gap-1"><Plus className="w-4 h-4" /> Criar Primeira</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-2 divide-y divide-border/50">
            {tree.roots.map(loc => <TreeNode key={loc.id} loc={loc} depth={0} />)}
            {tree.roots.length === 0 && search && (
              <p className="py-6 text-center text-muted-foreground text-sm">Nenhuma localidade encontrada</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" />
              {editingId ? 'Editar Localidade' : 'Nova Localidade'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Centro, Shopping Costa Dourada" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Localidade Pai</Label>
                <Select value={form.parent_id || '_none'} onValueChange={v => setForm(f => ({ ...f, parent_id: v === '_none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum (raiz)</SelectItem>
                    {localidades.filter(l => l.id !== editingId).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome} ({l.tipo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs">Latitude (opcional)</Label>
                <Input type="number" step="0.0000001" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-8.2889" />
              </div>
              <div>
                <Label className="text-xs">Longitude (opcional)</Label>
                <Input type="number" step="0.0000001" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-35.0365" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.nome.trim()} className="gap-1">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Excluir Localidade</DialogTitle>
            <DialogDescription>Filhos serão movidos para o nível pai.</DialogDescription>
          </DialogHeader>
          <p className="text-sm py-2">Excluir <strong>{deleteConfirm?.nome}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="gap-1">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// TAB 2: PREÇOS (Matriz Origem x Destino)
// ══════════════════════════════════════════════════════════
const PrecosTab: React.FC<{
  precos: PrecoRotaRow[];
  localidades: LocalidadeRow[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ precos, localidades, loading, onRefresh }) => {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    origem_id: '', destino_id: '', preco_fixo: '', preco_minimo: '', prioridade: '0',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);

  const locMap = useMemo(() => {
    const m = new Map<string, LocalidadeRow>();
    localidades.forEach(l => m.set(l.id, l));
    return m;
  }, [localidades]);

  const activeLocalidades = localidades.filter(l => l.ativo);

  const filteredPrecos = precos.filter(p => {
    if (!search) return true;
    const o = locMap.get(p.origem_id);
    const d = locMap.get(p.destino_id);
    const s = search.toLowerCase();
    return o?.nome.toLowerCase().includes(s) || d?.nome.toLowerCase().includes(s);
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Check for duplicate
      if (!editingId) {
        const existing = precos.find(p => p.origem_id === form.origem_id && p.destino_id === form.destino_id);
        if (existing) throw new Error('Já existe uma rota para essa combinação origem/destino.');
      }

      const payload = {
        origem_id: form.origem_id,
        destino_id: form.destino_id,
        preco_fixo: form.preco_fixo ? parseFloat(form.preco_fixo) : null,
        preco_minimo: form.preco_minimo ? parseFloat(form.preco_minimo) : null,
        prioridade: parseInt(form.prioridade) || 0,
      };

      if (editingId) {
        const { error } = await supabase.from('precos_rotas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('precos_rotas').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Preço atualizado!' : 'Preço criado!' });
      onRefresh();
      setShowDialog(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message || 'Erro ao salvar', variant: 'destructive' }),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('precos_rotas').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => onRefresh(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precos_rotas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Preço excluído!' });
      onRefresh();
      setDeleteConfirm(null);
    },
  });

  const resetForm = () => {
    setForm({ origem_id: '', destino_id: '', preco_fixo: '', preco_minimo: '', prioridade: '0' });
    setEditingId(null);
  };

  const openEdit = (p: PrecoRotaRow) => {
    setEditingId(p.id);
    setForm({
      origem_id: p.origem_id,
      destino_id: p.destino_id,
      preco_fixo: p.preco_fixo != null ? String(p.preco_fixo) : '',
      preco_minimo: p.preco_minimo != null ? String(p.preco_minimo) : '',
      prioridade: String(p.prioridade),
    });
    setShowDialog(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por localidade..." className="pl-9" />
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-1 shrink-0">
          <Plus className="w-4 h-4" /> Nova Rota
        </Button>
      </div>

      <div className="flex gap-2">
        <Badge variant="outline" className="text-[10px]">{precos.length} rotas</Badge>
        <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
          {precos.filter(p => p.ativo).length} ativas
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filteredPrecos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma rota de preço cadastrada</p>
            <Button onClick={() => { resetForm(); setShowDialog(true); }} className="mt-3 gap-1"><Plus className="w-4 h-4" /> Criar Primeira</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPrecos.map((p, i) => {
            const o = locMap.get(p.origem_id);
            const d = locMap.get(p.destino_id);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className={!p.ativo ? 'opacity-50' : ''}>
                  <CardContent className="py-2.5 sm:py-3">
                    <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[9px] sm:text-[10px] ${TIPO_COLORS[o?.tipo || '']}`}>{o?.tipo}</Badge>
                          <span className="text-xs sm:text-sm font-medium truncate">{o?.nome || '?'}</span>
                          <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground shrink-0" />
                          <Badge variant="outline" className={`text-[9px] sm:text-[10px] ${TIPO_COLORS[d?.tipo || '']}`}>{d?.tipo}</Badge>
                          <span className="text-xs sm:text-sm font-medium truncate">{d?.nome || '?'}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                          {p.preco_fixo != null && (
                            <span className="text-green-400 font-semibold">Fixo: R$ {Number(p.preco_fixo).toFixed(2)}</span>
                          )}
                          {p.preco_minimo != null && (
                            <span>Mín: R$ {Number(p.preco_minimo).toFixed(2)}</span>
                          )}
                          <span className="text-[10px]">Prioridade: {p.prioridade}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => toggleAtivoMutation.mutate({ id: p.id, ativo: !p.ativo })}>
                          {p.ativo ? <ToggleRight className="w-3.5 h-3.5 text-green-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400"
                          onClick={() => setDeleteConfirm({ id: p.id, label: `${o?.nome} → ${d?.nome}` })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" />
              {editingId ? 'Editar Rota de Preço' : 'Nova Rota de Preço'}
            </DialogTitle>
            <DialogDescription>
              Defina o preço para uma combinação origem → destino.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={form.origem_id || '_'} onValueChange={v => setForm(f => ({ ...f, origem_id: v === '_' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_" disabled>Selecione...</SelectItem>
                    {activeLocalidades.map(l => (
                      <SelectItem key={l.id} value={l.id}>{TIPO_LABELS[l.tipo]?.split(' ')[0]} {l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Destino</Label>
                <Select value={form.destino_id || '_'} onValueChange={v => setForm(f => ({ ...f, destino_id: v === '_' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_" disabled>Selecione...</SelectItem>
                    {activeLocalidades.map(l => (
                      <SelectItem key={l.id} value={l.id}>{TIPO_LABELS[l.tipo]?.split(' ')[0]} {l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs">Preço Fixo (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.preco_fixo} onChange={e => setForm(f => ({ ...f, preco_fixo: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Preço Mínimo (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.preco_minimo} onChange={e => setForm(f => ({ ...f, preco_minimo: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Input type="number" min="0" max="100" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} />
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
              <Info className="w-3.5 h-3.5 inline mr-1" />
              Prioridade maior = regra preferencial. Tipos mais específicos (rua &gt; local &gt; bairro) são priorizados automaticamente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.origem_id || !form.destino_id} className="gap-1">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Excluir Rota</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2">Excluir <strong>{deleteConfirm?.label}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="gap-1">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// TAB 3: REGRAS DE HORÁRIO
// ══════════════════════════════════════════════════════════
const PRESET_COLORS = [
  '#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f43f5e', '#06b6d4', '#a855f7', '#84cc16',
];

const HorariosTab: React.FC<{
  regras: RegraHorarioRow[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ regras, loading, onRefresh }) => {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: '', hora_inicio: '', hora_fim: '', tipo_ajuste: 'percentual' as 'percentual' | 'fixo', valor_ajuste: '', cor: '#f97316',
    sempre_ativa: true, data_inicio: '', data_fim: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fmtTime = (t: string) => {
        const parts = t.split(':');
        if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
        return t;
      };
      const payload: Record<string, unknown> = {
        nome: form.nome.trim(),
        hora_inicio: fmtTime(form.hora_inicio),
        hora_fim: fmtTime(form.hora_fim),
        tipo_ajuste: form.tipo_ajuste,
        valor_ajuste: parseFloat(form.valor_ajuste) || 0,
        cor: form.cor,
        data_inicio: form.sempre_ativa ? null : (form.data_inicio || null),
        data_fim: form.sempre_ativa ? null : (form.data_fim || null),
        ativo: true,
      };
      if (editingId) {
        delete payload.ativo;
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase.from('regras_horario').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('regras_horario').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Regra atualizada!' : 'Regra criada!' });
      onRefresh();
      setShowDialog(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar regra', description: e?.message || 'Erro desconhecido', variant: 'destructive' }),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('regras_horario').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => onRefresh(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('regras_horario').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Regra excluída!' });
      onRefresh();
      setDeleteConfirm(null);
    },
  });

  const resetForm = () => {
    setForm({ nome: '', hora_inicio: '', hora_fim: '', tipo_ajuste: 'percentual', valor_ajuste: '', cor: '#f97316', sempre_ativa: true, data_inicio: '', data_fim: '' });
    setEditingId(null);
  };

  const openEdit = (r: RegraHorarioRow) => {
    setEditingId(r.id);
    const sempreAtiva = !(r as any).data_inicio && !(r as any).data_fim;
    setForm({
      nome: r.nome,
      hora_inicio: r.hora_inicio.substring(0, 5),
      hora_fim: r.hora_fim.substring(0, 5),
      tipo_ajuste: (r as any).tipo_ajuste || 'percentual',
      valor_ajuste: String(r.valor_ajuste),
      cor: (r as any).cor || '#f97316',
      sempre_ativa: sempreAtiva,
      data_inicio: (r as any).data_inicio || '',
      data_fim: (r as any).data_fim || '',
    });
    setShowDialog(true);
  };

  const getRuleColor = (r: RegraHorarioRow) => (r as any).cor || '#f97316';

  const timelineHours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[10px]">{regras.length} regras</Badge>
          <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
            {regras.filter(r => r.ativo).length} ativas
          </Badge>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-1">
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </div>

      {/* Timeline 24h com cores */}
      {regras.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium">TIMELINE 24H</p>
            <div className="relative">
              {/* Hour labels */}
              <div className="flex text-[8px] text-muted-foreground mb-1">
                {timelineHours.filter((_, i) => i % 3 === 0).map(h => (
                  <div key={h} style={{ width: `${100 / 8}%` }} className="text-center">{String(h).padStart(2, '0')}h</div>
                ))}
              </div>
              {/* Stacked bars per rule */}
              <div className="space-y-1">
                {regras.filter(r => r.ativo).map(r => {
                  const color = getRuleColor(r);
                  const start = parseInt(r.hora_inicio.substring(0, 2)) + parseInt(r.hora_inicio.substring(3, 5)) / 60;
                  const end = parseInt(r.hora_fim.substring(0, 2)) + parseInt(r.hora_fim.substring(3, 5)) / 60;
                  const label = (r as any).tipo_ajuste === 'fixo'
                    ? `+R$${r.valor_ajuste.toFixed(2)}`
                    : `+${r.valor_ajuste}%`;

                  return (
                    <div key={r.id} className="h-5 bg-muted/40 rounded relative overflow-hidden group">
                      {start <= end ? (
                        <div
                          className="absolute h-full rounded flex items-center justify-center"
                          title={`${r.nome}: ${r.hora_inicio.substring(0, 5)}–${r.hora_fim.substring(0, 5)} (${label})`}
                          style={{ left: `${(start / 24) * 100}%`, width: `${((end - start) / 24) * 100}%`, backgroundColor: color }}
                        >
                          <span className="text-[8px] font-bold text-white drop-shadow-sm truncate px-1">
                            {r.nome} {label}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            className="absolute h-full rounded-l flex items-center justify-end"
                            title={`${r.nome}: ${r.hora_inicio.substring(0, 5)}–${r.hora_fim.substring(0, 5)} (${label})`}
                            style={{ left: `${(start / 24) * 100}%`, width: `${((24 - start) / 24) * 100}%`, backgroundColor: color }}
                          >
                            <span className="text-[8px] font-bold text-white drop-shadow-sm truncate px-1">{r.nome} {label}</span>
                          </div>
                          <div
                            className="absolute h-full rounded-r"
                            title={`${r.nome} (cont.)`}
                            style={{ left: '0%', width: `${(end / 24) * 100}%`, backgroundColor: color }}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-3">
                {regras.filter(r => r.ativo).map(r => (
                  <div key={r.id} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getRuleColor(r) }} />
                    <span className="text-[9px] text-muted-foreground">{r.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : regras.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma regra de horário</p>
            <Button onClick={() => { resetForm(); setShowDialog(true); }} className="mt-3 gap-1"><Plus className="w-4 h-4" /> Criar Primeira</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {regras.map((r, i) => {
            const color = getRuleColor(r);
            const isFix = (r as any).tipo_ajuste === 'fixo';
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className={!r.ativo ? 'opacity-50' : ''} style={{ borderLeft: `3px solid ${color}` }}>
                  <CardContent className="py-2.5 sm:py-3">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-sm truncate">{r.nome}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                          <span>{r.hora_inicio.substring(0, 5)} – {r.hora_fim.substring(0, 5)}</span>
                          <Badge variant="outline" className="text-[10px]" style={{ color, borderColor: `${color}50` }}>
                            {isFix ? `+R$${r.valor_ajuste.toFixed(2)}` : `+${r.valor_ajuste}%`}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {isFix ? 'Valor fixo' : 'Percentual'}
                          </Badge>
                          {(r as any).data_inicio || (r as any).data_fim ? (
                            <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                              {(r as any).data_inicio ? new Date((r as any).data_inicio + 'T12:00').toLocaleDateString('pt-BR') : '∞'}
                              {' → '}
                              {(r as any).data_fim ? new Date((r as any).data_fim + 'T12:00').toLocaleDateString('pt-BR') : '∞'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                              Sempre ativa
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => toggleAtivoMutation.mutate({ id: r.id, ativo: !r.ativo })}>
                          {r.ativo ? <ToggleRight className="w-3.5 h-3.5 text-green-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400"
                          onClick={() => setDeleteConfirm({ id: r.id, nome: r.nome })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              {editingId ? 'Editar Regra' : 'Nova Regra de Horário'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Noturno, Horário de Pico" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Hora Início</Label>
                <Input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Hora Fim</Label>
                <Input type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} />
              </div>
            </div>
            {/* Tipo de ajuste */}
            <div>
              <Label className="text-xs">Tipo de Ajuste</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={form.tipo_ajuste === 'percentual' ? 'default' : 'outline'}
                  className="flex-1 gap-1"
                  onClick={() => setForm(f => ({ ...f, tipo_ajuste: 'percentual' }))}
                >
                  % Percentual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.tipo_ajuste === 'fixo' ? 'default' : 'outline'}
                  className="flex-1 gap-1"
                  onClick={() => setForm(f => ({ ...f, tipo_ajuste: 'fixo' }))}
                >
                  R$ Valor Fixo
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">
                {form.tipo_ajuste === 'fixo' ? 'Valor de Ajuste (R$)' : 'Percentual de Ajuste (%)'}
              </Label>
              <Input type="number" step="0.01" value={form.valor_ajuste}
                onChange={e => setForm(f => ({ ...f, valor_ajuste: e.target.value }))}
                placeholder={form.tipo_ajuste === 'fixo' ? 'Ex: 5.00' : 'Ex: 20'} />
              <p className="text-[10px] text-muted-foreground mt-1">
                {form.tipo_ajuste === 'fixo'
                  ? 'O valor em R$ será adicionado ao preço base da corrida.'
                  : 'O valor será acrescido como porcentagem sobre o preço base da corrida.'}
              </p>
            </div>
            {/* Color picker */}
            <div>
              <Label className="text-xs">Cor na Timeline</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, cor: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: form.cor === c ? '#fff' : 'transparent',
                      boxShadow: form.cor === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Vigência */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vigência</Label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, sempre_ativa: !f.sempre_ativa, data_inicio: '', data_fim: '' }))}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {form.sempre_ativa
                    ? <ToggleRight className="w-5 h-5 text-green-400" />
                    : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  <span className={form.sempre_ativa ? 'text-green-400 font-medium' : 'text-muted-foreground'}>
                    Sempre ativa
                  </span>
                </button>
              </div>
              {!form.sempre_ativa && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fim</Label>
                    <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
            {/* Preview */}
            {form.hora_inicio && form.hora_fim && form.valor_ajuste && (
              <div className="rounded-lg p-3 text-sm border" style={{ backgroundColor: `${form.cor}15`, borderColor: `${form.cor}40` }}>
                <Zap className="w-3.5 h-3.5 inline mr-1" style={{ color: form.cor }} />
                Preview: <strong>{form.nome || 'Regra'}</strong> das {form.hora_inicio} às {form.hora_fim}{' '}
                → <strong style={{ color: form.cor }}>
                  {form.tipo_ajuste === 'fixo' ? `+R$${parseFloat(form.valor_ajuste || '0').toFixed(2)}` : `+${form.valor_ajuste}%`}
                </strong> sobre o valor da corrida
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.nome.trim() || !form.hora_inicio || !form.hora_fim} className="gap-1">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Excluir Regra</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2">Excluir <strong>{deleteConfirm?.nome}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="gap-1">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// TAB 4: SIMULADOR DE PREÇO
// ══════════════════════════════════════════════════════════
const SimuladorTab: React.FC<{ localidades: LocalidadeRow[] }> = ({ localidades }) => {
  const [origemTexto, setOrigemTexto] = useState('');
  const [destinoTexto, setDestinoTexto] = useState('');
  const [horario, setHorario] = useState('');
  const [resultado, setResultado] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [noResult, setNoResult] = useState(false);

  const handleSimular = async () => {
    if (!origemTexto.trim() || !destinoTexto.trim()) return;
    setLoading(true);
    setNoResult(false);
    setResultado(null);

    try {
      await invalidatePricingCache();
      const result = await calcularPreco(origemTexto.trim(), destinoTexto.trim(), horario || undefined);
      if (result) {
        setResultado(result);
      } else {
        setNoResult(true);
      }
    } catch (e) {
      setNoResult(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="text-center space-y-1">
            <Calculator className="w-8 h-8 text-accent mx-auto" />
            <h3 className="font-semibold">Simulador de Preço</h3>
            <p className="text-xs text-muted-foreground">Teste o motor de cálculo com qualquer combinação</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> Origem</Label>
              <Input value={origemTexto} onChange={e => setOrigemTexto(e.target.value)} placeholder="Ex: Centro, Shopping" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-accent" /> Destino</Label>
              <Input value={destinoTexto} onChange={e => setDestinoTexto(e.target.value)} placeholder="Ex: Praia de Gaibu" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Horário (opcional)</Label>
              <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} placeholder="Auto-detectar" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSimular} disabled={loading || !origemTexto.trim() || !destinoTexto.trim()} className="w-full gap-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Calcular
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No result */}
      <AnimatePresence>
        {noResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="py-6 text-center">
                <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                <p className="font-medium">Nenhuma regra de preço encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verifique se existem localidades e rotas de preço cadastradas que correspondam à origem e destino informados.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {resultado && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Main price */}
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-5">
                <div className="text-center space-y-2">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                  <p className="text-3xl font-bold text-green-400">R$ {resultado.preco_final.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Preço Final Calculado</p>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium">DETALHES DO CÁLCULO</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Preço Base</p>
                    <p className="text-lg font-bold">R$ {resultado.preco_base.toFixed(2)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Ajuste Horário</p>
                    <p className="text-lg font-bold">{resultado.ajuste_aplicado}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Regra aplicada:</span>
                    <Badge variant="outline" className="text-[10px]">{resultado.origem_regra}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origem resolvida:</span>
                    <span className="font-medium">{resultado.origem_localidade?.nome} ({resultado.origem_localidade?.tipo})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destino resolvido:</span>
                    <span className="font-medium">{resultado.destino_localidade?.nome} ({resultado.destino_localidade?.tipo})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fallback usado:</span>
                    <Badge variant="outline" className={`text-[10px] ${resultado.fallback_usado ? 'text-yellow-400 border-yellow-500/30' : 'text-green-400 border-green-500/30'}`}>
                      {resultado.fallback_usado ? 'Sim' : 'Não (exato)'}
                    </Badge>
                  </div>
                  {resultado.regra_horario && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regra horário:</span>
                      <span className="font-medium">{resultado.regra_horario.nome} ({resultado.regra_horario.hora_inicio.substring(0, 5)}–{resultado.regra_horario.hora_fim.substring(0, 5)})</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário simulado:</span>
                    <span>{resultado.detalhes.horario}</span>
                  </div>
                </div>

                <Separator />

                {/* Ancestry chains */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Cadeia Origem</p>
                    {resultado.detalhes.cadeia_origem.map((c, i) => (
                      <div key={i} className="text-[10px] flex items-center gap-1">
                        {i > 0 && <span className="text-muted-foreground">↑</span>}
                        <span className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>{c}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Cadeia Destino</p>
                    {resultado.detalhes.cadeia_destino.map((c, i) => (
                      <div key={i} className="text-[10px] flex items-center gap-1">
                        {i > 0 && <span className="text-muted-foreground">↑</span>}
                        <span className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPricing;
