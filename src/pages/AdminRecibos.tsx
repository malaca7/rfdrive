import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/components/AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Calendar, DollarSign, MapPin, User, Shield,
  ChevronLeft, Copy, Check, Filter, TrendingUp, Hash, Clock,
  ArrowDownAZ, ArrowUpAZ, Loader2, Archive, RotateCcw, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/native-helpers';

type Recibo = {
  id: string;
  motorista_id: string;
  numero: string;
  token: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  origem: string;
  destino: string;
  valor_total: number;
  detalhes: Record<string, any> | null;
  status: 'ativo' | 'arquivado' | 'cancelado';
  observacao_admin: string | null;
  created_at: string;
  updated_at?: string;
};

type SortField = 'created_at' | 'valor_total' | 'numero';
type SortDir = 'asc' | 'desc';

const AdminRecibos: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'arquivado' | 'cancelado'>('todos');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedRecibo, setSelectedRecibo] = useState<Recibo | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [adminObs, setAdminObs] = useState('');

  useEffect(() => {
    setAdminObs(selectedRecibo?.observacao_admin || '');
  }, [selectedRecibo]);

  const { data: recibos, isLoading } = useQuery({
    queryKey: ['admin-recibos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('recibos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Recibo[];
    },
    enabled: !!user,
  });

  const { data: motoristas } = useQuery({
    queryKey: ['admin-recibos-motoristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome')
        .in('tipo', ['motorista', 'admin']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: configTarifas } = useQuery({
    queryKey: ['admin-recibos-config-tarifas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('config_tarifas')
        .select('taxa_carro_6_tipo, taxa_carro_6_valor')
        .eq('ativo', true)
        .limit(1)
        .single();
      if (error) throw error;
      return data as { taxa_carro_6_tipo: 'percentual' | 'fixo'; taxa_carro_6_valor: number };
    },
    enabled: !!user,
    retry: 1,
  });

  const motoristaNomeById = useMemo(() => {
    const map: Record<string, string> = {};
    motoristas?.forEach(m => { map[m.id] = m.nome; });
    return map;
  }, [motoristas]);

  const filtered = useMemo(() => {
    if (!recibos) return [];
    let items = [...recibos];

    if (statusFilter !== 'todos') {
      items = items.filter(r => (r.status || 'ativo') === statusFilter);
    }

    // Period filter
    const now = new Date();
    if (periodoFilter === 'hoje') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      items = items.filter(r => new Date(r.created_at) >= todayStart);
    } else if (periodoFilter === 'semana') {
      const weekStart = new Date(now);
      const wd = now.getDay();
      weekStart.setDate(now.getDate() - (wd === 0 ? 6 : wd - 1));
      weekStart.setHours(0, 0, 0, 0);
      items = items.filter(r => new Date(r.created_at) >= weekStart);
    } else if (periodoFilter === 'mes') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      items = items.filter(r => new Date(r.created_at) >= monthStart);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(r =>
        r.numero.toLowerCase().includes(q) ||
        r.token.toLowerCase().includes(q) ||
        (r.cliente_nome || '').toLowerCase().includes(q) ||
        r.origem.toLowerCase().includes(q) ||
        r.destino.toLowerCase().includes(q) ||
        (motoristaNomeById[r.motorista_id] || '').toLowerCase().includes(q)
      );
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === 'valor_total') cmp = a.valor_total - b.valor_total;
      else if (sortField === 'numero') cmp = a.numero.localeCompare(b.numero);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return items;
  }, [recibos, search, periodoFilter, statusFilter, sortField, sortDir, motoristaNomeById]);

  const updateReciboMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await (supabase as any).from('recibos').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-recibos'] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro na atualização', description: e?.message, variant: 'destructive' });
    },
  });

  const deleteReciboMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('recibos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-recibos'] });
      setSelectedRecibo(null);
      toast({ title: 'Recibo removido com sucesso' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao remover recibo', description: e?.message, variant: 'destructive' });
    },
  });

  const handleUpdateStatus = (recibo: Recibo, status: 'ativo' | 'arquivado' | 'cancelado') => {
    updateReciboMutation.mutate({ id: recibo.id, payload: { status } });
    if (selectedRecibo?.id === recibo.id) {
      setSelectedRecibo({ ...selectedRecibo, status });
    }
    toast({ title: `Recibo ${status}` });
  };

  const handleSaveAdminObs = (recibo: Recibo) => {
    updateReciboMutation.mutate({ id: recibo.id, payload: { observacao_admin: adminObs.trim() || null } });
    if (selectedRecibo?.id === recibo.id) {
      setSelectedRecibo({ ...selectedRecibo, observacao_admin: adminObs.trim() || null });
    }
    toast({ title: 'Observação administrativa salva' });
  };

  const handleDeleteRecibo = (recibo: Recibo) => {
    if (!window.confirm('Deseja realmente excluir este recibo? Esta ação não pode ser desfeita.')) return;
    deleteReciboMutation.mutate(recibo.id);
  };

  const stats = useMemo(() => {
    if (!recibos) return { total: 0, receita: 0, hoje: 0, semana: 0 };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    const wd = now.getDay();
    weekStart.setDate(now.getDate() - (wd === 0 ? 6 : wd - 1));
    weekStart.setHours(0, 0, 0, 0);
    return {
      total: recibos.length,
      receita: recibos.reduce((s, r) => s + r.valor_total, 0),
      hoje: recibos.filter(r => new Date(r.created_at) >= todayStart).length,
      semana: recibos.filter(r => new Date(r.created_at) >= weekStart).length,
    };
  }, [recibos]);

  const handleCopyToken = async (token: string) => {
    const ok = await copyToClipboard(token);
    if (ok) {
      setCopiedToken(token);
      toast({ title: 'Token copiado!' });
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  const statsCards = [
    { label: 'Total de Recibos', value: stats.total, icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
    { label: 'Receita Total', value: `R$ ${stats.receita.toFixed(0)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/15' },
    { label: 'Hoje', value: stats.hoje, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    { label: 'Esta Semana', value: stats.semana, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  ];

  // Detail view
  if (selectedRecibo) {
    const r = selectedRecibo;
    const motoristaNome = motoristaNomeById[r.motorista_id] || 'Motorista';
    const detalhes = r.detalhes || {};
    const valorBase = Number(detalhes.valor_base || 0);
    const taxaBagagem = Number(detalhes.taxa_bagagem || 0);
    const configCarro6Tipo = configTarifas?.taxa_carro_6_tipo || 'fixo';
    const configCarro6Valor = Number(configTarifas?.taxa_carro_6_valor || 0);
    const hasCarro6Meta = detalhes.carro_6_tipo != null || detalhes.carro_6_config != null;
    const carro6Tipo = String(detalhes.carro_6_tipo || configCarro6Tipo);
    const carro6Config = Number(detalhes.carro_6_config ?? configCarro6Valor);
    const carro6Valor = (() => {
      if (detalhes.carro_6 == null) return 0;
      // Novo formato já salva o valor aplicado e os metadados de cálculo.
      if (hasCarro6Meta) return Number(detalhes.carro_6 || 0);
      // Legado: calcula com base na configuração atual (percentual/fixo).
      if (carro6Tipo === 'percentual') return valorBase * (carro6Config / 100);
      return Number(detalhes.carro_6 || 0);
    })();
    const paradaValor = Number(detalhes.parada_valor || 0);
    const paradaTipo = String(detalhes.parada_tipo || '');
    const paradaLabel = paradaTipo === 'trajeto'
      ? 'Parada no Trajeto'
      : paradaTipo === 'comum'
        ? 'Parada Comum'
        : paradaTipo === 'desvio'
          ? 'Parada desviando trajeto'
          : 'Parada';
    const tempoEsperaMin = Number(detalhes.tempo_espera_minutos || 0);
    const tempoEsperaValor = Number(detalhes.tempo_espera_valor || 0);
    return (
      <AdminLayout>
        <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
          <button
            onClick={() => setSelectedRecibo(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <Card className="mb-4">
              <CardContent className="py-4 px-[4%]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold">{r.numero}</h2>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
                    R$ {r.valor_total.toFixed(2).replace('.', ',')}
                  </Badge>
                </div>

                {/* Token */}
                <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 mb-3">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Token de Validação</p>
                    <p className="text-xs font-mono font-bold text-indigo-400 truncate">{r.token}</p>
                  </div>
                  <button
                    onClick={() => handleCopyToken(r.token)}
                    className="shrink-0 p-1.5 rounded-md hover:bg-indigo-500/20 transition-colors"
                  >
                    {copiedToken === r.token ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                </div>

                {/* Motorista */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <User className="w-3.5 h-3.5" />
                  <span>Motorista: <span className="text-foreground font-medium">{motoristaNome}</span></span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge className={
                    r.status === 'arquivado'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs'
                      : r.status === 'cancelado'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30 text-xs'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs'
                  }>
                    {r.status === 'arquivado' ? 'Arquivado' : r.status === 'cancelado' ? 'Cancelado' : 'Ativo'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Button
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => handleUpdateStatus(r, r.status === 'arquivado' ? 'ativo' : 'arquivado')}
                    disabled={updateReciboMutation.isPending}
                  >
                    {r.status === 'arquivado' ? <RotateCcw className="w-3.5 h-3.5 mr-1" /> : <Archive className="w-3.5 h-3.5 mr-1" />}
                    {r.status === 'arquivado' ? 'Reativar' : 'Arquivar'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-9 text-xs"
                    onClick={() => handleDeleteRecibo(r)}
                    disabled={deleteReciboMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Client */}
            {(r.cliente_nome || r.cliente_telefone) && (
              <Card className="mb-4">
                <CardContent className="py-3 px-[4%]">
                  <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Contratante</h3>
                  <p className="text-sm font-medium">{r.cliente_nome || '—'}</p>
                  {r.cliente_telefone && <p className="text-xs text-muted-foreground">{r.cliente_telefone}</p>}
                </CardContent>
              </Card>
            )}

            {/* Route */}
            <Card className="mb-4">
              <CardContent className="py-3 px-[4%]">
                <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Rota</h3>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs">{r.origem}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-xs">{r.destino}</span>
                </div>
              </CardContent>
            </Card>

            {/* Detalhes */}
            <Card className="mb-4">
              <CardContent className="py-3 px-[4%]">
                <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Detalhamento</h3>
                <div className="space-y-1.5">
                  {detalhes.tipo_tarifa && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{detalhes.tipo_tarifa}</span>
                      <span className="font-medium">R$ {valorBase.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {detalhes.ajuste_horario && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Ajuste: {detalhes.ajuste_horario}</span>
                      <span className="font-medium text-purple-400">aplicado</span>
                    </div>
                  )}
                  {detalhes.taxa_bagagem != null && taxaBagagem > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Feira/Bagagem</span>
                      <span className="font-medium text-orange-400">+R$ {taxaBagagem.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {detalhes.carro_6 != null && carro6Valor > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Carro 6 lugares {carro6Tipo === 'percentual' ? `(${carro6Config}%)` : '(fixo)'}
                      </span>
                      <span className="font-medium text-cyan-400">+R$ {carro6Valor.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {paradaValor > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{paradaLabel}</span>
                      <span className="font-medium text-red-400">+R$ {paradaValor.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {tempoEsperaValor > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tempo de espera{tempoEsperaMin > 0 ? ` (${tempoEsperaMin} min)` : ''}</span>
                      <span className="font-medium text-amber-400">+R$ {tempoEsperaValor.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {detalhes.tarifa_minima && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tarifa mínima</span>
                      <span className="font-medium text-yellow-400">aplicada</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-1.5 mt-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-green-400">R$ {r.valor_total.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-4">
              <CardContent className="py-3 px-[4%] space-y-2">
                <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Observação Administrativa</h3>
                <Textarea
                  value={adminObs}
                  onChange={e => setAdminObs(e.target.value)}
                  placeholder="Adicione observações internas para gestão deste recibo"
                  className="text-xs min-h-20"
                />
                <Button
                  onClick={() => handleSaveAdminObs(r)}
                  className="w-full h-9 text-xs"
                  disabled={updateReciboMutation.isPending}
                >
                  Salvar observação
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight">Gestão de Recibos</h1>
              <p className="text-xs text-muted-foreground">Todos os recibos emitidos pela plataforma</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-[4%]">
          {statsCards.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
              <Card className="border-border/30">
                <CardContent className="py-3 text-center">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mx-auto mb-1.5`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className={`text-lg font-extrabold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="mb-[4%]">
            <CardContent className="py-3 px-[4%] space-y-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold">Filtros</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select value={periodoFilter} onValueChange={v => setPeriodoFilter(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="semana">Esta Semana</SelectItem>
                    <SelectItem value="mes">Este Mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortField} onValueChange={v => setSortField(v as SortField)}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Data</SelectItem>
                    <SelectItem value="valor_total">Valor</SelectItem>
                    <SelectItem value="numero">Número</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-muted/40 transition-colors shrink-0"
                >
                  {sortDir === 'desc' ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpAZ className="w-3.5 h-3.5" />}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum recibo encontrado</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Os recibos aparecerão aqui quando gerados</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {filtered.length} recibo{filtered.length !== 1 ? 's' : ''}
            </p>
            {filtered.map((recibo, i) => {
              const motoristaNome = motoristaNomeById[recibo.motorista_id] || 'Motorista';
              return (
                <motion.div
                  key={recibo.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * Math.min(i, 15) }}
                >
                  <Card
                    className="cursor-pointer hover:bg-muted/10 transition-all border-border/30"
                    onClick={() => setSelectedRecibo(recibo)}
                  >
                    <CardContent className="py-3 px-[4%]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{recibo.numero}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{motoristaNome}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-green-400">R$ {recibo.valor_total.toFixed(2).replace('.', ',')}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {new Date(recibo.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {recibo.origem} → {recibo.destino}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 font-mono border-indigo-500/30 text-indigo-400">
                          {recibo.token}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[8px] px-1.5 py-0 h-4 ${
                            (recibo.status || 'ativo') === 'arquivado'
                              ? 'border-amber-500/30 text-amber-400'
                              : (recibo.status || 'ativo') === 'cancelado'
                                ? 'border-red-500/30 text-red-400'
                                : 'border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {recibo.status === 'arquivado' ? 'Arquivado' : recibo.status === 'cancelado' ? 'Cancelado' : 'Ativo'}
                        </Badge>
                        {recibo.cliente_nome && (
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-border/50 text-muted-foreground">
                            {recibo.cliente_nome}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminRecibos;
