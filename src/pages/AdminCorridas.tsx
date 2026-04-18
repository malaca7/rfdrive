import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/AdminLayout';
import { motion } from 'framer-motion';
import {
  MapPin, Clock, CheckCircle, XCircle, Car, Shield, Loader2, MessageSquare, Phone,
  Search, Filter, Eye, AlertTriangle, DollarSign, User, Globe,
  FileText, Pencil, Trash2, Save, TableProperties, Star, Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { buscarPrecoTabela } from '@/lib/tabela-preco';
import { useAllLocations } from '@/hooks/usePrecoTabela';
import { normalizeText } from '@/lib/tabela-preco';
import { getConfigTarifas, type ConfigTarifas, findActiveTimeRules, applyTimeAdjustment, type RegraHorario } from '@/lib/pricing-engine';

type Solicitacao = {
  id: string;
  cliente_id: string;
  motorista_id: string | null;
  origem_texto: string;
  destino_texto: string;
  horario_estimado: string | null;
  status: string;
  aprovado_admin: boolean;
  valor: number | null;
  valor_estimado: number | null;
  distancia_km: number | null;
  observacao_motorista: string | null;
  observacoes: string | null;
  confianca_ia: number | null;
  created_at: string;
  concluida_at: string | null;
  cliente?: { nome: string; telefone: string; tipo: string } | null;
  motorista?: { nome: string; telefone: string } | null;
  avaliacao_cliente?: { nota: number; comentario: string | null } | null;
  avaliacao_motorista?: { nota: number; comentario: string | null } | null;
};

type Aprovacao = {
  id: string;
  solicitacao_id: string;
  admin_id: string;
  status_admin: string;
  observacao: string;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  nova: { label: 'Nova', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <FileText className="w-3 h-3" /> },
  aguardando_motorista: { label: 'Aguardando Motorista', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  aceita: { label: 'Aceita', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Car className="w-3 h-3" /> },
  em_analise: { label: 'Em Análise', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Eye className="w-3 h-3" /> },
  aprovada: { label: 'Aprovada', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  nao_realizada: { label: 'Não Realizada', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <AlertTriangle className="w-3 h-3" /> },
  recusada: { label: 'Recusada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
  finalizada: { label: 'Finalizada', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
};
const ALL_STATUSES = ['nova', 'aguardando_motorista', 'aceita', 'em_analise', 'aprovada', 'nao_realizada', 'recusada', 'finalizada'] as const;

type PeriodFilter = 'todos' | 'semana' | 'semana_passada' | 'mes' | 'personalizado';

function getWeekRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return [start, end];
}
function getLastWeekRange(): [Date, Date] {
  const now = new Date();
  const end = new Date(now); end.setDate(now.getDate() - now.getDay() - 1); end.setHours(23, 59, 59, 999);
  const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
  return [start, end];
}
function getMonthRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return [start, end];
}

// ── Resilient update ──
const resilientUpdate = async (table: string, updates: Record<string, unknown>, eqCol: string, eqVal: string) => {
  let current = { ...updates };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from(table).update(current).eq(eqCol, eqVal);
    if (!error) return;
    const msg = error.message || '';
    const isMissingCol = error.code === '42703' || msg.includes('schema cache') || msg.includes('Could not find');
    if (isMissingCol) {
      const match = msg.match(/column\s+"?(\w+)"?/i) || msg.match(/the\s+'(\w+)'\s+column/i);
      const badCol = match?.[1];
      if (badCol && badCol in current) { delete current[badCol]; continue; }
    }
    throw error;
  }
};

const AdminCorridas: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('todos');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [motoristaFilter, setMotoristaFilter] = useState<string>('all');

  const dateRange = useMemo((): [Date, Date] | null => {
    switch (period) {
      case 'todos': return null;
      case 'semana': return getWeekRange();
      case 'semana_passada': return getLastWeekRange();
      case 'mes': return getMonthRange();
      case 'personalizado':
        if (customStart && customEnd) {
          return [new Date(customStart + 'T00:00:00'), new Date(customEnd + 'T23:59:59')];
        }
        return null;
    }
  }, [period, customStart, customEnd]);

  // ── Ride Dialogs ──
  const [selectedRide, setSelectedRide] = useState<Solicitacao | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<string>('');
  const [approvalObs, setApprovalObs] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [rideAprovacoes, setRideAprovacoes] = useState<Aprovacao[]>([]);
  const [showEditRideDialog, setShowEditRideDialog] = useState(false);
  const [editRideForm, setEditRideForm] = useState({
    origem_texto: '', destino_texto: '', status: '', valor: '', valor_estimado: '',
    distancia_km: '', horario_estimado: '', observacoes: '', motorista_id: '' as string | null,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  // ── Admin create ride ──
  const [showCreateRideDialog, setShowCreateRideDialog] = useState(false);
  const [createRideForm, setCreateRideForm] = useState({
    origem_texto: '', destino_texto: '', motorista_id: '' as string | null,
    data: '', hora: '', observacoes: '', valor: '', temBagagem: false,
    clienteNome: '', clienteTelefone: '',
  });
  const [usarDataAtual, setUsarDataAtual] = useState(true);
  const [showCreateOrigemSugg, setShowCreateOrigemSugg] = useState(false);
  const [showCreateDestinoSugg, setShowCreateDestinoSugg] = useState(false);
  const allLocations = useAllLocations();

  const filteredCreateOrigens = useMemo(() => {
    if (!createRideForm.origem_texto.trim()) return allLocations;
    const q = normalizeText(createRideForm.origem_texto);
    return allLocations.filter(o => normalizeText(o).includes(q));
  }, [createRideForm.origem_texto, allLocations]);

  const filteredCreateDestinos = useMemo(() => {
    if (!createRideForm.destino_texto.trim()) return allLocations;
    const q = normalizeText(createRideForm.destino_texto);
    return allLocations.filter(d => normalizeText(d).includes(q));
  }, [createRideForm.destino_texto, allLocations]);

  const { data: configTarifas } = useQuery<ConfigTarifas | null>({
    queryKey: ['config-tarifas-admin'],
    queryFn: () => getConfigTarifas(),
    staleTime: 10_000,
  });

  const taxaBagagemValor = configTarifas?.taxa_bagagem ?? 5;
  const tarifaMesmoBairro = configTarifas?.tarifa_mesmo_bairro ?? 10;

  const { data: regrasHorario } = useQuery<RegraHorario[]>({
    queryKey: ['regras-horario-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('regras_horario').select('*').eq('ativo', true);
      return (data || []) as RegraHorario[];
    },
    staleTime: 30_000,
  });

  const precoTabelaCreateRaw = useMemo(() => {
    if (!createRideForm.origem_texto.trim() || !createRideForm.destino_texto.trim()) return null;
    return buscarPrecoTabela(createRideForm.origem_texto, createRideForm.destino_texto);
  }, [createRideForm.origem_texto, createRideForm.destino_texto]);

  // Override valor for mesmo_bairro with configured tarifa
  const precoTabelaCreate = useMemo(() => {
    if (!precoTabelaCreateRaw) return null;
    if (precoTabelaCreateRaw.mesmo_bairro) return { ...precoTabelaCreateRaw, valor: tarifaMesmoBairro };
    return precoTabelaCreateRaw;
  }, [precoTabelaCreateRaw, tarifaMesmoBairro]);

  const precoTabelaAdmin = useMemo(() => {
    if (!editRideForm.origem_texto.trim() || !editRideForm.destino_texto.trim()) return null;
    return buscarPrecoTabela(editRideForm.origem_texto, editRideForm.destino_texto);
  }, [editRideForm.origem_texto, editRideForm.destino_texto]);

  const dynamicAdjCreate = useMemo(() => {
    if (!regrasHorario?.length) return null;
    const hora = usarDataAtual
      ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
      : (createRideForm.hora || null);
    if (!hora) return null;
    const regra = findActiveTimeRules(regrasHorario, hora);
    if (!regra) return null;
    return {
      regra,
      label: regra.tipo_ajuste === 'fixo' ? `+R$${regra.valor_ajuste.toFixed(2)} ${regra.nome}` : `+${regra.valor_ajuste}% ${regra.nome}`,
      aplicar: (precoBase: number) => Math.round(applyTimeAdjustment(precoBase, regra) * 100) / 100,
    };
  }, [regrasHorario, usarDataAtual, createRideForm.hora]);

  const totalCreateValue = useMemo(() => {
    if (!precoTabelaCreate) return null;
    let total = precoTabelaCreate.valor;
    if (dynamicAdjCreate) total = dynamicAdjCreate.aplicar(total);
    if (createRideForm.temBagagem) total += taxaBagagemValor;
    // Aplicar tarifa mínima
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima > 0 && total < minima) total = minima;
    return Math.round(total * 100) / 100;
  }, [precoTabelaCreate, dynamicAdjCreate, createRideForm.temBagagem, taxaBagagemValor, configTarifas]);

  const isTarifaMinimaCreate = useMemo(() => {
    if (!precoTabelaCreate) return false;
    const minima = configTarifas?.tarifa_minima ?? 0;
    if (minima <= 0) return false;
    let total = precoTabelaCreate.valor;
    if (dynamicAdjCreate) total = dynamicAdjCreate.aplicar(total);
    if (createRideForm.temBagagem) total += taxaBagagemValor;
    return total < minima;
  }, [precoTabelaCreate, dynamicAdjCreate, createRideForm.temBagagem, taxaBagagemValor, configTarifas]);

  const rawTotalCreateValue = useMemo(() => {
    if (!precoTabelaCreate) return 0;
    let total = precoTabelaCreate.valor;
    if (dynamicAdjCreate) total = dynamicAdjCreate.aplicar(total);
    if (createRideForm.temBagagem) total += taxaBagagemValor;
    return Math.round(total * 100) / 100;
  }, [precoTabelaCreate, dynamicAdjCreate, createRideForm.temBagagem, taxaBagagemValor]);

  // ── Fetch rides ──
  const { data: rides, isLoading: loadingRides } = useQuery({
    queryKey: ['admin-rides'],
    queryFn: async () => {
      const { data, error } = await supabase.from('corridas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = await Promise.all(
        (data || []).map(async (ride: any) => {
          const { data: cliente } = await supabase.from('users').select('nome, telefone, tipo').eq('id', ride.cliente_id).single();
          let motorista = null;
          if (ride.motorista_id) {
            const { data: m } = await supabase.from('users').select('nome, telefone').eq('id', ride.motorista_id).single();
            motorista = m;
          }
          const { data: avaliacoes } = await supabase.from('avaliacoes').select('nota, comentario, tipo').eq('corrida_id', ride.id);
          const avaliacao_cliente = avaliacoes?.find((a: any) => a.tipo === 'cliente') || null;
          const avaliacao_motorista = avaliacoes?.find((a: any) => a.tipo === 'motorista') || null;
          return { ...ride, cliente, motorista, avaliacao_cliente, avaliacao_motorista } as Solicitacao;
        })
      );
      return enriched;
    },
    staleTime: 0,
    refetchInterval: 1000,
  });

  // ── Fetch motoristas for assignment ──
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    staleTime: 0,
  });
  const motoristas = users?.filter((u: any) => (u.roles?.includes('motorista') || u.tipo === 'motorista') && u.status === 'ativo') || [];

  // ── Mutations ──
  const approvalMutation = useMutation({
    mutationFn: async ({ rideId, statusAdmin, observacao }: { rideId: string; statusAdmin: string; observacao: string }) => {
      if (!adminUser?.id) throw new Error('Usuário admin não identificado. Faça login novamente.');
      // 1. Update corrida status first (most important)
      const rideUpdates: Record<string, unknown> = { status: statusAdmin, aprovado_admin: statusAdmin === 'aprovada' };
      if (statusAdmin !== 'aprovada' && observacao) {
        rideUpdates.observacoes = observacao;
      }
      await resilientUpdate('corridas', rideUpdates, 'id', rideId);
      // 2. Insert audit trail (non-blocking)
      try {
        const { error: apError } = await supabase.from('aprovacoes').insert({ solicitacao_id: rideId, admin_id: adminUser.id, status_admin: statusAdmin, observacao: observacao || '' });
        if (apError) console.warn('Aprovação audit log falhou:', apError.message);
      } catch (e) {
        console.warn('Aprovação audit log error:', e);
      }
    },
    onSuccess: () => { toast({ title: 'Solicitação atualizada!' }); queryClient.invalidateQueries({ queryKey: ['admin-rides'] }); setShowApprovalDialog(false); setApprovalObs(''); setSelectedRide(null); },
    onError: (e: any) => { toast({ title: 'Erro ao processar ação', description: e?.message || 'Erro desconhecido', variant: 'destructive' }); },
  });

  const updateRideMutation = useMutation({
    mutationFn: async ({ rideId, updates }: { rideId: string; updates: Record<string, unknown> }) => {
      await resilientUpdate('corridas', updates, 'id', rideId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-rides'] }); toast({ title: 'Viagem atualizada!' }); setShowEditRideDialog(false); setSelectedRide(null); },
    onError: (e: any) => { toast({ title: 'Erro ao atualizar viagem', description: e?.message || 'Erro desconhecido', variant: 'destructive' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('aprovacoes').delete().eq('solicitacao_id', id);
      await supabase.from('avaliacoes').delete().eq('corrida_id', id);
      await supabase.from('historico_precos').delete().eq('corrida_id', id);
      const { error } = await supabase.from('corridas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-rides'] }); toast({ title: 'Viagem excluída!' }); setShowDeleteConfirm(false); setDeleteTarget(null); },
    onError: (err: any) => { toast({ title: 'Erro ao excluir', description: err?.message, variant: 'destructive' }); },
  });

  const createRideMutation = useMutation({
    mutationFn: async () => {
      if (!createRideForm.motorista_id || !createRideForm.origem_texto.trim() || !createRideForm.destino_texto.trim()) throw new Error('Preencha motorista, origem e destino');
      const concluidaAt = usarDataAtual
        ? new Date().toISOString()
        : (createRideForm.data
          ? new Date(`${createRideForm.data}T${createRideForm.hora || '12:00'}`).toISOString()
          : new Date().toISOString());
      let valor = createRideForm.valor ? parseFloat(createRideForm.valor) : null;
      if (valor == null && precoTabelaCreate) {
        valor = precoTabelaCreate.valor;
        if (dynamicAdjCreate) valor = dynamicAdjCreate.aplicar(valor);
        if (createRideForm.temBagagem) valor += taxaBagagemValor;
        valor = Math.round(valor * 100) / 100;
      }
      // Append client info to observacoes (columns don't exist in corridas)
      const obsParts: string[] = [];
      if (createRideForm.observacoes.trim()) obsParts.push(createRideForm.observacoes.trim());
      if (createRideForm.clienteNome.trim()) obsParts.push(`Cliente: ${createRideForm.clienteNome.trim()}`);
      if (createRideForm.clienteTelefone.trim()) obsParts.push(`Tel: ${createRideForm.clienteTelefone.trim()}`);
      const { error } = await supabase.from('corridas').insert({
        cliente_id: createRideForm.motorista_id,
        motorista_id: createRideForm.motorista_id,
        origem_texto: createRideForm.origem_texto.trim(),
        destino_texto: createRideForm.destino_texto.trim(),
        valor,
        valor_estimado: valor,
        status: 'aprovada',
        aprovado_admin: true,
        concluida_at: concluidaAt,
        observacoes: obsParts.length > 0 ? obsParts.join(' | ') : null,
        tem_bagagem: createRideForm.temBagagem,
        preco_regra_aplicada: precoTabelaCreate ? (precoTabelaCreate.mesmo_bairro ? 'mesmo_bairro' : precoTabelaCreate.estimado ? 'estimado' : 'tabela') : 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      toast({ title: 'Viagem registrada com sucesso!' });
      setShowCreateRideDialog(false);
      setCreateRideForm({ origem_texto: '', destino_texto: '', motorista_id: null, data: '', hora: '', observacoes: '', valor: '', temBagagem: false, clienteNome: '', clienteTelefone: '' });
      setUsarDataAtual(true);
    },
    onError: (err: any) => { toast({ title: 'Erro ao registrar viagem', description: err?.message, variant: 'destructive' }); },
  });

  // ── Helpers ──
  const openApprovalDialog = (ride: Solicitacao, action: string) => { setSelectedRide(ride); setApprovalAction(action); setApprovalObs(''); setShowApprovalDialog(true); };
  const handleDirectApprove = (ride: Solicitacao) => { approvalMutation.mutate({ rideId: ride.id, statusAdmin: 'aprovada', observacao: '' }); };
  const openDetailDialog = async (ride: Solicitacao) => {
    setSelectedRide(ride);
    const { data } = await supabase.from('aprovacoes').select('*').eq('solicitacao_id', ride.id).order('created_at', { ascending: false });
    setRideAprovacoes(data || []);
    setShowDetailDialog(true);
  };
  const openEditRideDialog = (ride: Solicitacao) => {
    setSelectedRide(ride);
    setEditRideForm({
      origem_texto: ride.origem_texto, destino_texto: ride.destino_texto, status: ride.status,
      valor: ride.valor != null ? String(ride.valor) : '', valor_estimado: ride.valor_estimado != null ? String(ride.valor_estimado) : '',
      distancia_km: ride.distancia_km != null ? String(ride.distancia_km) : '', horario_estimado: ride.horario_estimado || '',
      observacoes: ride.observacoes || '', motorista_id: ride.motorista_id,
    });
    setShowEditRideDialog(true);
  };
  const handleApproval = () => { if (!selectedRide) return; approvalMutation.mutate({ rideId: selectedRide.id, statusAdmin: approvalAction, observacao: approvalObs.trim() }); };
  const handleSaveRide = () => {
    if (!selectedRide) return;
    const updates: Record<string, unknown> = {
      origem_texto: editRideForm.origem_texto.trim(), destino_texto: editRideForm.destino_texto.trim(),
      status: editRideForm.status, valor: editRideForm.valor ? parseFloat(editRideForm.valor) : null,
      valor_estimado: editRideForm.valor_estimado ? parseFloat(editRideForm.valor_estimado) : null,
      distancia_km: editRideForm.distancia_km ? parseFloat(editRideForm.distancia_km) : null,
      horario_estimado: editRideForm.horario_estimado || null, observacoes: editRideForm.observacoes || null,
      motorista_id: editRideForm.motorista_id || null, aprovado_admin: editRideForm.status === 'aprovada',
    };
    updateRideMutation.mutate({ rideId: selectedRide.id, updates });
  };

  // ── Filtering ──
  const filteredRides = rides?.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !searchTerm || [r.origem_texto, r.destino_texto, r.motorista?.nome]
      .some(f => f?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    const matchMotorista = motoristaFilter === 'all' || r.motorista_id === motoristaFilter;
    const matchPeriod = !dateRange || (() => {
      const d = new Date(r.concluida_at || r.created_at);
      return d >= dateRange[0] && d <= dateRange[1];
    })();
    return matchStatus && matchSearch && matchMotorista && matchPeriod;
  })?.sort((a, b) => new Date(b.concluida_at || b.created_at).getTime() - new Date(a.concluida_at || a.created_at).getTime());

  const stats = {
    total: rides?.length || 0,
    emAnalise: rides?.filter(r => r.status === 'em_analise').length || 0,
    aprovadas: rides?.filter(r => r.status === 'aprovada').length || 0,
    recusadas: rides?.filter(r => r.status === 'recusada').length || 0,
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Car className="w-5 h-5 text-accent" /> Viagens
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Gerenciar todas as viagens da plataforma</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateRideDialog(true)}>
          <Plus className="w-4 h-4" /> Registrar Viagem
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white', bg: 'bg-white/[0.06]' },
          { label: 'Em Análise', value: stats.emAnalise, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Aprovadas', value: stats.aprovadas, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Recusadas', value: stats.recusadas, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                <Car className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold leading-none ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nome, telefone ou endereço..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-full sm:w-56"><Filter className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">📅 Todos os Períodos</SelectItem>
              <SelectItem value="semana">📅 Esta Semana</SelectItem>
              <SelectItem value="semana_passada">📅 Semana Passada</SelectItem>
              <SelectItem value="mes">📅 Este Mês</SelectItem>
              <SelectItem value="personalizado">📅 Personalizado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={motoristaFilter} onValueChange={setMotoristaFilter}>
            <SelectTrigger className="w-full sm:w-56"><User className="w-4 h-4 mr-2" /><SelectValue placeholder="Filtrar por motorista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Motoristas</SelectItem>
              {motoristas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {period === 'personalizado' && (
            <div className="flex gap-2 flex-1">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1" placeholder="De" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1" placeholder="Até" />
            </div>
          )}
        </div>
      </div>

      {/* Rides list */}
      {loadingRides ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !filteredRides?.length ? (
        <Card><CardContent className="py-12 text-center"><Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Nenhuma viagem encontrada</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredRides.map((ride, i) => {
            const cfg = STATUS_CONFIG[ride.status] || STATUS_CONFIG.nova;
            const needsAction = ride.status === 'em_analise';
            return (
              <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className={needsAction ? 'border-orange-500/30 bg-orange-500/5' : ''}>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>{cfg.icon}{cfg.label}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(ride.concluida_at || ride.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                        {ride.motorista && (
                          <div className="flex items-center gap-2">
                            <Car className="w-3.5 h-3.5 text-accent" />
                            <span className="text-sm">{ride.motorista.nome}</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shrink-0" /><span className="text-sm">{ride.origem_texto}</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent shrink-0" /><span className="text-sm">{ride.destino_texto}</span></div>
                      </div>
                      {(ride.valor != null || ride.valor_estimado != null) && (
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                          {ride.valor != null && <span className="flex items-center gap-1 text-green-400 font-semibold"><DollarSign className="w-3 h-3" />R$ {Number(ride.valor).toFixed(2).replace('.', ',')}</span>}
                          {ride.valor_estimado != null && <span className="flex items-center gap-1 text-muted-foreground">Est: R$ {Number(ride.valor_estimado).toFixed(2).replace('.', ',')}</span>}
                        </div>
                      )}
                      {(ride.avaliacao_cliente || ride.avaliacao_motorista) && (
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                          {ride.avaliacao_cliente && (
                            <span className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-blue-400" /><span className="text-muted-foreground">Cliente:</span>
                              <span className="flex items-center gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= ride.avaliacao_cliente!.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />)}</span>
                            </span>
                          )}
                          {ride.avaliacao_motorista && (
                            <span className="flex items-center gap-1.5">
                              <Car className="w-3 h-3 text-accent" /><span className="text-muted-foreground">Motorista:</span>
                              <span className="flex items-center gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= ride.avaliacao_motorista!.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />)}</span>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openDetailDialog(ride)}><Eye className="w-3 h-3" /> Detalhes</Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openEditRideDialog(ride)}><Pencil className="w-3 h-3" /> Editar</Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={() => handleDirectApprove(ride)}><CheckCircle className="w-3 h-3" /> Aprovar</Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10" onClick={() => openApprovalDialog(ride, 'nao_realizada')}><AlertTriangle className="w-3 h-3" /> Não Realizada</Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => openApprovalDialog(ride, 'recusada')}><XCircle className="w-3 h-3" /> Recusar</Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10 ml-auto" onClick={() => { setDeleteTarget({ id: ride.id, label: `Viagem de ${ride.cliente?.nome || 'cliente'}` }); setShowDeleteConfirm(true); }}>
                          <Trash2 className="w-3 h-3" /> Excluir
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

      {/* ═══ APPROVAL DIALOG ═══ */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalAction === 'aprovada' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {approvalAction === 'nao_realizada' && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
              {approvalAction === 'recusada' && <XCircle className="w-5 h-5 text-red-400" />}
              {approvalAction === 'aprovada' ? 'Aprovar Solicitação' : approvalAction === 'nao_realizada' ? 'Marcar como Não Realizada' : 'Recusar Solicitação'}
            </DialogTitle>
            <DialogDescription>A observação é opcional para manter o histórico de auditoria.</DialogDescription>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-medium">{selectedRide.cliente?.nome}</span></div>
                <div className="flex items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-green-500" /><span>{selectedRide.origem_texto}</span></div>
                <div className="flex items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-accent" /><span>{selectedRide.destino_texto}</span></div>
                {selectedRide.valor != null && <div className="flex items-center gap-2 text-sm text-green-400 font-semibold"><DollarSign className="w-3.5 h-3.5" />R$ {Number(selectedRide.valor).toFixed(2).replace('.', ',')}</div>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />Observação (opcional)</label>
                <Textarea value={approvalObs} onChange={(e) => setApprovalObs(e.target.value)} placeholder="Descreva o motivo da ação..." className="resize-none" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancelar</Button>
            <Button onClick={handleApproval} disabled={approvalMutation.isPending}
              className={approvalAction === 'aprovada' ? 'bg-green-600 hover:bg-green-700 text-white' : approvalAction === 'recusada' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}
            >
              {approvalMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT RIDE DIALOG ═══ */}
      <Dialog open={showEditRideDialog} onOpenChange={setShowEditRideDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-accent" />Editar Viagem</DialogTitle><DialogDescription>Altere os dados da viagem.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Label className="text-xs">Origem</Label><Input value={editRideForm.origem_texto} onChange={(e) => setEditRideForm(f => ({ ...f, origem_texto: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Destino</Label><Input value={editRideForm.destino_texto} onChange={(e) => setEditRideForm(f => ({ ...f, destino_texto: e.target.value }))} /></div>
              {precoTabelaAdmin && (
                <div className="sm:col-span-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableProperties className="w-4 h-4 text-green-400" />
                      <div><p className="text-[10px] text-muted-foreground">Preço tabelado RF</p><p className="text-lg font-bold text-green-400">R$ {precoTabelaAdmin.valor.toFixed(2).replace('.', ',')}</p></div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-green-400 hover:text-green-300 h-6"
                      onClick={() => setEditRideForm(f => ({ ...f, valor: precoTabelaAdmin.valor.toFixed(2), valor_estimado: precoTabelaAdmin.valor.toFixed(2) }))}>Aplicar</Button>
                  </div>
                </div>
              )}
              <div><Label className="text-xs">Status</Label>
                <Select value={editRideForm.status} onValueChange={(v) => setEditRideForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label className="text-xs">Motorista</Label>
                <Select value={editRideForm.motorista_id || '_none'} onValueChange={(v) => setEditRideForm(f => ({ ...f, motorista_id: v === '_none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem motorista" /></SelectTrigger>
                  <SelectContent><SelectItem value="_none">Sem motorista</SelectItem>{motoristas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.telefone})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" min="0" value={editRideForm.valor} onChange={(e) => setEditRideForm(f => ({ ...f, valor: e.target.value }))} /></div>
              <div><Label className="text-xs">Valor Estimado (R$)</Label><Input type="number" step="0.01" min="0" value={editRideForm.valor_estimado} onChange={(e) => setEditRideForm(f => ({ ...f, valor_estimado: e.target.value }))} /></div>
              <div><Label className="text-xs">Horário Estimado</Label><Input value={editRideForm.horario_estimado} onChange={(e) => setEditRideForm(f => ({ ...f, horario_estimado: e.target.value }))} placeholder="Ex: 14:30" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Observações</Label><Textarea value={editRideForm.observacoes} onChange={(e) => setEditRideForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className="resize-none" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRideDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveRide} disabled={updateRideMutation.isPending || !editRideForm.origem_texto.trim() || !editRideForm.destino_texto.trim()} className="gap-1">
              {updateRideMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DETAIL DIALOG ═══ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />Detalhes da Viagem</DialogTitle></DialogHeader>
          {selectedRide && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Status:</span><Badge variant="outline" className={STATUS_CONFIG[selectedRide.status]?.color || ''}>{STATUS_CONFIG[selectedRide.status]?.label || selectedRide.status}</Badge></div>
              <Separator />
              <div><p className="text-xs text-muted-foreground mb-2 font-medium">CLIENTE</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1"><p className="text-sm font-medium">{selectedRide.cliente?.nome}</p><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedRide.cliente?.telefone}</p></div>
              </div>
              {selectedRide.motorista && (
                <div><p className="text-xs text-muted-foreground mb-2 font-medium">MOTORISTA</p>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1"><p className="text-sm font-medium">{selectedRide.motorista.nome}</p><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedRide.motorista.telefone}</p></div>
                </div>
              )}
              <div><p className="text-xs text-muted-foreground mb-2 font-medium">ROTA</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2"><div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" /><div><p className="text-xs text-muted-foreground">Embarque</p><p className="text-sm font-medium">{selectedRide.origem_texto}</p></div></div>
                  <div className="flex items-start gap-2"><div className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" /><div><p className="text-xs text-muted-foreground">Destino</p><p className="text-sm font-medium">{selectedRide.destino_texto}</p></div></div>
                </div>
              </div>
              {(selectedRide.valor != null || selectedRide.valor_estimado != null) && (
                <div><p className="text-xs text-muted-foreground mb-2 font-medium">VALORES</p>
                  <div className="bg-muted/50 rounded-lg p-3 flex gap-6">
                    {selectedRide.valor != null && <div><p className="text-[10px] text-muted-foreground">Valor Final</p><p className="text-lg font-bold text-green-400">R$ {Number(selectedRide.valor).toFixed(2).replace('.', ',')}</p></div>}
                    {selectedRide.valor_estimado != null && <div><p className="text-[10px] text-muted-foreground">Estimado</p><p className="text-lg font-bold text-muted-foreground">R$ {Number(selectedRide.valor_estimado).toFixed(2).replace('.', ',')}</p></div>}
                  </div>
                </div>
              )}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p>Criada: {new Date(selectedRide.created_at).toLocaleString('pt-BR')}</p>
                {selectedRide.concluida_at && <p>Concluída: {new Date(selectedRide.concluida_at).toLocaleString('pt-BR')}</p>}
                <p>ID: <span className="font-mono text-[10px]">{selectedRide.id}</span></p>
              </div>
              {rideAprovacoes.length > 0 && (
                <div><p className="text-xs text-muted-foreground mb-2 font-medium">HISTÓRICO DE APROVAÇÕES</p>
                  <div className="space-y-2">
                    {rideAprovacoes.map((ap) => (
                      <div key={ap.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ap.status_admin === 'aprovada' ? 'text-green-400 border-green-500/30' : ap.status_admin === 'recusada' ? 'text-red-400 border-red-500/30' : 'text-yellow-400 border-yellow-500/30'}>{ap.status_admin}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(ap.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-sm">"{ap.observacao}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fechar</Button>
            {selectedRide && <Button className="gap-1" onClick={() => { setShowDetailDialog(false); openEditRideDialog(selectedRide); }}><Pencil className="w-4 h-4" /> Editar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRM ═══ */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-400"><Trash2 className="w-5 h-5" />Confirmar Exclusão</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          {deleteTarget && <div className="py-2"><p className="text-sm">Tem certeza que deseja excluir <strong>{deleteTarget.label}</strong>?</p></div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="gap-1">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CREATE RIDE DIALOG ═══ */}
      <Dialog open={showCreateRideDialog} onOpenChange={setShowCreateRideDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-accent" />Registrar Viagem</DialogTitle>
            <DialogDescription>Registre uma viagem definindo motorista, rota, valor e data/hora.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Motorista */}
            <div>
              <Label className="text-xs">Motorista *</Label>
              <Select value={createRideForm.motorista_id || '_none'} onValueChange={(v) => setCreateRideForm(f => ({ ...f, motorista_id: v === '_none' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o motorista" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione...</SelectItem>
                  {motoristas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.telefone})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Origem com autocomplete */}
            <div className="relative">
              <Label className="text-xs">Origem *</Label>
              <Input
                value={createRideForm.origem_texto}
                onChange={e => { setCreateRideForm(f => ({ ...f, origem_texto: e.target.value })); setShowCreateOrigemSugg(true); }}
                onFocus={() => setShowCreateOrigemSugg(true)}
                onBlur={() => setTimeout(() => setShowCreateOrigemSugg(false), 200)}
                placeholder="De onde sai?"
              />
              {showCreateOrigemSugg && filteredCreateOrigens.length > 0 && createRideForm.origem_texto.trim() && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredCreateOrigens.slice(0, 12).map(loc => (
                    <button key={loc} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setCreateRideForm(f => ({ ...f, origem_texto: loc })); setShowCreateOrigemSugg(false); }}>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destino com autocomplete */}
            <div className="relative">
              <Label className="text-xs">Destino *</Label>
              <Input
                value={createRideForm.destino_texto}
                onChange={e => { setCreateRideForm(f => ({ ...f, destino_texto: e.target.value })); setShowCreateDestinoSugg(true); }}
                onFocus={() => setShowCreateDestinoSugg(true)}
                onBlur={() => setTimeout(() => setShowCreateDestinoSugg(false), 200)}
                placeholder="Para onde vai?"
              />
              {showCreateDestinoSugg && filteredCreateDestinos.length > 0 && createRideForm.destino_texto.trim() && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredCreateDestinos.slice(0, 12).map(loc => (
                    <button key={loc} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setCreateRideForm(f => ({ ...f, destino_texto: loc })); setShowCreateDestinoSugg(false); }}>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Data e Hora toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Data e Hora</Label>
                <button type="button" onClick={() => { setUsarDataAtual(!usarDataAtual); if (!usarDataAtual) setCreateRideForm(f => ({ ...f, data: '', hora: '' })); }}
                  className="flex items-center gap-1.5 text-xs">
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${usarDataAtual ? 'bg-green-500' : 'bg-muted'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${usarDataAtual ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className={usarDataAtual ? 'text-green-400 font-medium' : 'text-muted-foreground'}>Data/hora atual</span>
                </button>
              </div>
              {!usarDataAtual && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={createRideForm.data}
                      onChange={e => setCreateRideForm(f => ({ ...f, data: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Hora</Label>
                    <Input type="time" value={createRideForm.hora}
                      onChange={e => setCreateRideForm(f => ({ ...f, hora: e.target.value }))} />
                  </div>
                </div>
              )}
              {usarDataAtual && (
                <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  A viagem será registrada com a data e hora atuais.
                </div>
              )}
            </div>

            {/* Bagagem */}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCreateRideForm(f => ({ ...f, temBagagem: !f.temBagagem }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${createRideForm.temBagagem ? 'bg-accent' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${createRideForm.temBagagem ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <Label className="text-xs cursor-pointer" onClick={() => setCreateRideForm(f => ({ ...f, temBagagem: !f.temBagagem }))}>📦 Com bagagem/feira (+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')})</Label>
            </div>

            {/* Preço tabelado */}
            {precoTabelaCreate && (
              <div className={`${precoTabelaCreate.mesmo_bairro ? 'bg-blue-500/10 border-blue-500/20' : precoTabelaCreate.estimado ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-xl p-3 space-y-2`}>
                {/* Preço base */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableProperties className={`w-4 h-4 ${precoTabelaCreate.mesmo_bairro ? 'text-blue-400' : precoTabelaCreate.estimado ? 'text-amber-400' : 'text-green-400'}`} />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{precoTabelaCreate.mesmo_bairro ? 'Mesmo bairro' : precoTabelaCreate.estimado ? 'Preço estimado' : 'Preço tabelado'}</p>
                      <p className={`text-base font-semibold ${precoTabelaCreate.mesmo_bairro ? 'text-blue-400' : precoTabelaCreate.estimado ? 'text-amber-400' : 'text-green-400'}`}>R$ {precoTabelaCreate.valor.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">
                        {precoTabelaCreate.mesmo_bairro ? 'Viagem pro mesmo bairro' : precoTabelaCreate.estimado ? 'Média via Centro do Cabo' : precoTabelaCreate.match_exato ? 'Correspondência exata' : 'Melhor correspondência'}
                      </p>
                      {!precoTabelaCreate.mesmo_bairro && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {precoTabelaCreate.origem_tabela} → {precoTabelaCreate.destino_tabela}
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-green-400 hover:text-green-300 h-6"
                      onClick={() => setCreateRideForm(f => ({ ...f, valor: (totalCreateValue ?? precoTabelaCreate.valor).toFixed(2) }))}>Aplicar Total</Button>
                  </div>
                </div>
                {/* Mesmo bairro */}
                {precoTabelaCreate.mesmo_bairro && (
                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs text-blue-400">Viagem pro mesmo bairro — tarifa fixa R$ {precoTabelaCreate.valor.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {/* Adicionais */}
                {dynamicAdjCreate && (
                  <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs text-muted-foreground">{dynamicAdjCreate.regra.nome}</span>
                    </div>
                    <span className="text-sm font-bold text-purple-400">
                      +R$ {(dynamicAdjCreate.aplicar(precoTabelaCreate.valor) - precoTabelaCreate.valor).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
                {createRideForm.temBagagem && (
                  <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 text-xs">📦</span>
                      <span className="text-xs text-muted-foreground">Feira/Bagagem</span>
                    </div>
                    <span className="text-sm font-bold text-orange-400">+R$ {taxaBagagemValor.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {isTarifaMinimaCreate && (
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
                      {isTarifaMinimaCreate && (
                        <span className="text-xs text-muted-foreground line-through">R$ {rawTotalCreateValue.toFixed(2).replace('.', ',')}</span>
                      )}
                      <span className={`text-xl font-extrabold ${isTarifaMinimaCreate ? 'text-yellow-400' : precoTabelaCreate.mesmo_bairro ? 'text-blue-400' : precoTabelaCreate.estimado ? 'text-amber-400' : 'text-green-400'}`}>
                        R$ {(totalCreateValue ?? precoTabelaCreate.valor).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!precoTabelaCreate && createRideForm.origem_texto.trim() && createRideForm.destino_texto.trim() && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-sm text-red-400">Rota não encontrada na tabela</p>
                <p className="text-[10px] text-muted-foreground">Verifique origem e destino</p>
              </div>
            )}

            {/* Valor manual */}
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={createRideForm.valor}
                onChange={e => setCreateRideForm(f => ({ ...f, valor: e.target.value }))}
                placeholder={totalCreateValue ? `Total: R$ ${totalCreateValue.toFixed(2).replace('.', ',')}` : (precoTabelaCreate ? `Base: R$ ${precoTabelaCreate.valor.toFixed(2).replace('.', ',')}` : 'Ex: 25,00')} />
            </div>

            {/* Cliente info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1.5"><User className="w-3 h-3" /> Nome do Cliente</Label>
                <Input value={createRideForm.clienteNome} onChange={e => setCreateRideForm(f => ({ ...f, clienteNome: e.target.value }))} placeholder="Nome (opcional)" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5"><Phone className="w-3 h-3" /> Telefone</Label>
                <Input value={createRideForm.clienteTelefone} onChange={e => setCreateRideForm(f => ({ ...f, clienteTelefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={createRideForm.observacoes} onChange={e => setCreateRideForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Observações sobre a viagem..." rows={3} className="resize-none min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRideDialog(false)}>Cancelar</Button>
            <Button onClick={() => createRideMutation.mutate()}
              disabled={createRideMutation.isPending || !createRideForm.motorista_id || !createRideForm.origem_texto.trim() || !createRideForm.destino_texto.trim()}
              className="gap-1">
              {createRideMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCircle className="w-4 h-4" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCorridas;
