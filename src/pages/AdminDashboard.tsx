import React, { useState, useMemo, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  MapPin, Navigation, Clock, CheckCircle, XCircle,
  Users, Car, Shield, Loader2, MessageSquare, Phone,
  Search, Filter, Eye, AlertTriangle, History,
  Smartphone, Globe, DollarSign, User, Ban,
  FileText, ChevronDown, ChevronRight, Pencil, Trash2, Save, X, TableProperties, Star, Activity,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { buscarPrecoTabela } from '@/lib/tabela-preco';

// Lazy-load heavy admin sub-components (each ~500-1000 lines)
const AdminPricing = React.lazy(() => import('@/components/AdminPricing'));
const AdminTabelaPrecos = React.lazy(() => import('@/components/AdminTabelaPrecos'));
const AdminStatsDashboard = React.lazy(() => import('@/components/AdminStatsDashboard'));
const AdminMotoristas = React.lazy(() => import('@/components/AdminMotoristas'));
const AdminTracking = React.lazy(() => import('@/components/AdminTracking'));
const AdminDispatch = React.lazy(() => import('@/components/AdminDispatch'));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);

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
  canal_origem: string;
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

type UserRecord = {
  id: string;
  nome: string;
  telefone: string;
  senha: string;
  tipo: string;
  roles?: string[] | null;
  status: string;
  ativo: boolean;
  created_at: string;
  veiculo_marca?: string | null;
  veiculo_modelo?: string | null;
  veiculo_cor?: string | null;
  veiculo_placa?: string | null;
};

// ── Vehicle options ──
const VEHICLE_BRANDS = [
  'Chevrolet', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jeep', 'Nissan',
  'Peugeot', 'Renault', 'Toyota', 'Volkswagen', 'Citroën', 'Mitsubishi',
  'Kia', 'Caoa Chery', 'BYD', 'GWM', 'RAM', 'Suzuki', 'Outro',
];

const VEHICLE_MODELS: Record<string, string[]> = {
  Chevrolet: ['Onix', 'Onix Plus', 'Tracker', 'S10', 'Spin', 'Montana', 'Equinox', 'Cruze', 'Joy', 'Prisma', 'Cobalt', 'Outro'],
  Fiat: ['Argo', 'Mobi', 'Pulse', 'Fastback', 'Strada', 'Toro', 'Cronos', 'Uno', 'Palio', 'Siena', 'Grand Siena', 'Outro'],
  Ford: ['Ka', 'Ka Sedan', 'EcoSport', 'Ranger', 'Territory', 'Bronco Sport', 'Maverick', 'Fiesta', 'Focus', 'Outro'],
  Honda: ['Civic', 'City', 'HR-V', 'ZR-V', 'CR-V', 'Fit', 'WR-V', 'Accord', 'Outro'],
  Hyundai: ['HB20', 'HB20S', 'Creta', 'Tucson', 'Santa Fe', 'HB20X', 'i30', 'Azera', 'Outro'],
  Jeep: ['Renegade', 'Compass', 'Commander', 'Cherokee', 'Wrangler', 'Outro'],
  Nissan: ['Kicks', 'Versa', 'Sentra', 'Frontier', 'March', 'Outro'],
  Peugeot: ['208', '2008', '3008', '308', 'Partner', 'Outro'],
  Renault: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Oroch', 'Stepway', 'Outro'],
  Toyota: ['Corolla', 'Corolla Cross', 'Yaris', 'Hilux', 'SW4', 'RAV4', 'Etios', 'Outro'],
  Volkswagen: ['Gol', 'Voyage', 'Polo', 'Virtus', 'T-Cross', 'Nivus', 'Taos', 'Saveiro', 'Amarok', 'Fox', 'Outro'],
  'Citroën': ['C3', 'C4 Cactus', 'Aircross', 'Outro'],
  Mitsubishi: ['L200', 'Outlander', 'Eclipse Cross', 'ASX', 'Pajero', 'Outro'],
  Kia: ['Sportage', 'Seltos', 'Cerato', 'Stonic', 'Outro'],
  'Caoa Chery': ['Tiggo 5X', 'Tiggo 7', 'Tiggo 8', 'Arrizo 6', 'Outro'],
  BYD: ['Dolphin', 'Song Plus', 'Yuan Plus', 'Seal', 'Tan', 'Outro'],
  GWM: ['Haval H6', 'Haval Jolion', 'Ora 03', 'Outro'],
  RAM: ['Rampage', '1500', '2500', '3500', 'Outro'],
  Suzuki: ['Jimny', 'Vitara', 'Swift', 'S-Cross', 'Outro'],
  Outro: ['Outro'],
};

const VEHICLE_COLORS = [
  'Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho', 'Azul',
  'Marrom', 'Bege', 'Verde', 'Amarelo', 'Laranja', 'Dourado', 'Vinho',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  nova: { label: 'Nova', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <FileText className="w-3 h-3" /> },
  aguardando_motorista: { label: 'Aguardando Motorista', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  aceita: { label: 'Aceita', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Car className="w-3 h-3" /> },
  em_analise: { label: 'Em Análise', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Eye className="w-3 h-3" /> },
  aprovada: { label: 'Aprovada', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  nao_realizada: { label: 'Não Realizada', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <AlertTriangle className="w-3 h-3" /> },
  recusada: { label: 'Recusada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
};

const ALL_STATUSES = ['nova', 'aguardando_motorista', 'aceita', 'em_analise', 'aprovada', 'nao_realizada', 'recusada'] as const;

const AdminDashboard: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Tab States ──
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');

  // ── Ride Dialogs ──
  const [selectedRide, setSelectedRide] = useState<Solicitacao | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<string>('');
  const [approvalObs, setApprovalObs] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [rideAprovacoes, setRideAprovacoes] = useState<Aprovacao[]>([]);
  const [showEditRideDialog, setShowEditRideDialog] = useState(false);
  const [editRideForm, setEditRideForm] = useState({
    origem_texto: '',
    destino_texto: '',
    status: '',
    valor: '',
    valor_estimado: '',
    distancia_km: '',
    horario_estimado: '',
    observacoes: '',
    motorista_id: '' as string | null,
  });

  // ── Tabela de preço: lookup para edição de corrida ──
  const precoTabelaAdmin = useMemo(() => {
    if (!editRideForm.origem_texto.trim() || !editRideForm.destino_texto.trim()) return null;
    return buscarPrecoTabela(editRideForm.origem_texto, editRideForm.destino_texto);
  }, [editRideForm.origem_texto, editRideForm.destino_texto]);

  // ── User Dialogs ──
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    nome: '',
    telefone: '',
    tipo: '',
    roles: [] as string[],
    status: '',
    senha: '',
    veiculo_marca: '',
    veiculo_modelo: '',
    veiculo_cor: '',
    veiculo_placa: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'ride'; id: string; label: string } | null>(null);

  // ── Fetch all rides with client and driver info ──
  const { data: rides, isLoading: loadingRides } = useQuery({
    queryKey: ['admin-rides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (ride: any) => {
          const { data: cliente } = await supabase
            .from('users')
            .select('nome, telefone, tipo')
            .eq('id', ride.cliente_id)
            .single();

          let motorista = null;
          if (ride.motorista_id) {
            const { data: m } = await supabase
              .from('users')
              .select('nome, telefone')
              .eq('id', ride.motorista_id)
              .single();
            motorista = m;
          }

          // Fetch avaliacoes for this ride
          const { data: avaliacoes } = await supabase
            .from('avaliacoes')
            .select('nota, comentario, tipo')
            .eq('corrida_id', ride.id);

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

  // ── Fetch all users ──
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserRecord[];
    },
    staleTime: 0,
    refetchInterval: 1000,
  });

  // ── Fetch motoristas for ride assignment ──
  const motoristas = users?.filter(u =>
    (u.roles?.includes('motorista') || u.tipo === 'motorista') && u.status === 'ativo'
  ) || [];

  // ── Approval mutation ──
  const approvalMutation = useMutation({
    mutationFn: async ({ rideId, statusAdmin, observacao }: { rideId: string; statusAdmin: string; observacao: string }) => {
      const { error: apError } = await supabase.from('aprovacoes').insert({
        solicitacao_id: rideId,
        admin_id: adminUser!.id,
        status_admin: statusAdmin,
        observacao,
      });
      if (apError) throw apError;

      const { error: rideError } = await supabase.from('corridas').update({
        status: statusAdmin,
        aprovado_admin: statusAdmin === 'aprovada',
      }).eq('id', rideId);
      if (rideError) throw rideError;
    },
    onSuccess: () => {
      toast({ title: 'Solicitação atualizada com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      setShowApprovalDialog(false);
      setApprovalObs('');
      setSelectedRide(null);
    },
    onError: () => {
      toast({ title: 'Erro ao processar ação', variant: 'destructive' });
    },
  });

  // ── Resilient update: strip missing columns on 42703 and retry ──
  const resilientUpdate = async (table: string, updates: Record<string, unknown>, eqCol: string, eqVal: string) => {
    let current = { ...updates };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from(table).update(current).eq(eqCol, eqVal);
      if (!error) return;
      // Handle missing column errors (code 42703 or schema cache errors)
      const msg = error.message || '';
      const isMissingCol = error.code === '42703' || msg.includes('schema cache') || msg.includes('Could not find');
      if (isMissingCol) {
        // Try multiple patterns: column "X", 'X' column of 'table'
        const match = msg.match(/column\s+"?(\w+)"?/i) || msg.match(/the\s+'(\w+)'\s+column/i);
        const badCol = match?.[1];
        if (badCol && badCol in current) {
          delete current[badCol];
          continue;
        }
      }
      throw error;
    }
  };

  // ── Update user mutation ──
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      await resilientUpdate('users', updates, 'id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      toast({ title: 'Usuário atualizado!' });
      setShowEditUserDialog(false);
      setSelectedUser(null);
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao atualizar usuário', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
    },
  });

  // ── Update ride mutation ──
  const updateRideMutation = useMutation({
    mutationFn: async ({ rideId, updates }: { rideId: string; updates: Record<string, unknown> }) => {
      await resilientUpdate('corridas', updates, 'id', rideId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      toast({ title: 'Corrida atualizada!' });
      setShowEditRideDialog(false);
      setSelectedRide(null);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar corrida', variant: 'destructive' });
    },
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'user' | 'ride'; id: string }) => {
      if (type === 'ride') {
        // Delete related records first (some may not exist — ignore their errors)
        await supabase.from('aprovacoes').delete().eq('solicitacao_id', id);
        await supabase.from('avaliacoes').delete().eq('corrida_id', id);
        await supabase.from('historico_precos').delete().eq('corrida_id', id);
        const { error } = await supabase.from('corridas').delete().eq('id', id);
        if (error) throw error;
      } else {
        // 1. Remove aprovações feitas por este admin
        await supabase.from('aprovacoes').delete().eq('admin_id', id);

        // 2. Remove avaliações do usuário (como cliente ou motorista)
        await supabase.from('avaliacoes').delete().eq('cliente_id', id);
        await supabase.from('avaliacoes').delete().eq('motorista_id', id);

        // 3. Remove corridas como cliente (e seus registros dependentes)
        const { data: clientRides } = await supabase.from('corridas').select('id').eq('cliente_id', id);
        if (clientRides && clientRides.length > 0) {
          for (const ride of clientRides) {
            await supabase.from('aprovacoes').delete().eq('solicitacao_id', ride.id);
            await supabase.from('avaliacoes').delete().eq('corrida_id', ride.id);
            await supabase.from('historico_precos').delete().eq('corrida_id', ride.id);
          }
          await supabase.from('corridas').delete().eq('cliente_id', id);
        }

        // 4. Desvincula corridas como motorista (SET NULL em vez de deletar)
        await supabase.from('corridas').update({ motorista_id: null }).eq('motorista_id', id);

        // 5. Finalmente, deleta o usuário
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Excluído com sucesso!' });
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao excluir', description: err?.message || 'Pode haver registros vinculados.', variant: 'destructive' });
    },
  });

  // ── Helpers ──
  const openApprovalDialog = (ride: Solicitacao, action: string) => {
    setSelectedRide(ride);
    setApprovalAction(action);
    setApprovalObs('');
    setShowApprovalDialog(true);
  };

  const openDetailDialog = async (ride: Solicitacao) => {
    setSelectedRide(ride);
    const { data } = await supabase
      .from('aprovacoes')
      .select('*')
      .eq('solicitacao_id', ride.id)
      .order('created_at', { ascending: false });
    setRideAprovacoes(data || []);
    setShowDetailDialog(true);
  };

  const openEditRideDialog = (ride: Solicitacao) => {
    setSelectedRide(ride);
    setEditRideForm({
      origem_texto: ride.origem_texto,
      destino_texto: ride.destino_texto,
      status: ride.status,
      valor: ride.valor != null ? String(ride.valor) : '',
      valor_estimado: ride.valor_estimado != null ? String(ride.valor_estimado) : '',
      distancia_km: ride.distancia_km != null ? String(ride.distancia_km) : '',
      horario_estimado: ride.horario_estimado || '',
      observacoes: ride.observacoes || '',
      motorista_id: ride.motorista_id,
    });
    setShowEditRideDialog(true);
  };

  const openEditUserDialog = (u: UserRecord) => {
    setSelectedUser(u);
    const derivedRoles = u.roles && u.roles.length > 0 ? u.roles : (
      u.tipo === 'admin' ? ['admin'] :
      u.tipo === 'motorista' ? ['motorista'] :
      ['cliente']
    );
    setEditUserForm({
      nome: u.nome,
      telefone: u.telefone,
      tipo: u.tipo,
      roles: derivedRoles,
      status: u.status,
      senha: '',
      veiculo_marca: u.veiculo_marca || '',
      veiculo_modelo: u.veiculo_modelo || '',
      veiculo_cor: u.veiculo_cor || '',
      veiculo_placa: u.veiculo_placa || '',
    });
    setShowEditUserDialog(true);
  };

  const handleApproval = () => {
    if (!selectedRide) return;
    approvalMutation.mutate({
      rideId: selectedRide.id,
      statusAdmin: approvalAction,
      observacao: approvalObs.trim(),
    });
  };

  const handleSaveRide = () => {
    if (!selectedRide) return;
    const updates: Record<string, unknown> = {
      origem_texto: editRideForm.origem_texto.trim(),
      destino_texto: editRideForm.destino_texto.trim(),
      status: editRideForm.status,
      valor: editRideForm.valor ? parseFloat(editRideForm.valor) : null,
      valor_estimado: editRideForm.valor_estimado ? parseFloat(editRideForm.valor_estimado) : null,
      distancia_km: editRideForm.distancia_km ? parseFloat(editRideForm.distancia_km) : null,
      horario_estimado: editRideForm.horario_estimado || null,
      observacoes: editRideForm.observacoes || null,
      motorista_id: editRideForm.motorista_id || null,
      aprovado_admin: editRideForm.status === 'aprovada',
    };
    updateRideMutation.mutate({ rideId: selectedRide.id, updates });
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    const updates: Record<string, unknown> = {};

    // Só envia campos que realmente mudaram
    if (editUserForm.nome.trim() !== selectedUser.nome) {
      updates.nome = editUserForm.nome.trim();
    }
    if (editUserForm.telefone.trim() !== selectedUser.telefone) {
      updates.telefone = editUserForm.telefone.trim();
    }
    if (editUserForm.status !== selectedUser.status) {
      updates.status = editUserForm.status;
      updates.ativo = editUserForm.status === 'ativo';
    }
    if (editUserForm.senha.trim()) {
      updates.senha = editUserForm.senha.trim();
    }

    // Veículo — só envia campos que mudaram
    if ((editUserForm.veiculo_marca || '') !== (selectedUser.veiculo_marca || '')) {
      updates.veiculo_marca = editUserForm.veiculo_marca || null;
    }
    if ((editUserForm.veiculo_modelo || '') !== (selectedUser.veiculo_modelo || '')) {
      updates.veiculo_modelo = editUserForm.veiculo_modelo || null;
    }
    if ((editUserForm.veiculo_cor || '') !== (selectedUser.veiculo_cor || '')) {
      updates.veiculo_cor = editUserForm.veiculo_cor || null;
    }
    if ((editUserForm.veiculo_placa || '') !== (selectedUser.veiculo_placa || '')) {
      updates.veiculo_placa = editUserForm.veiculo_placa || null;
    }

    // Não altera tipo nem roles — preserva o que está no banco
    if (Object.keys(updates).length === 0) {
      toast({ title: 'Nenhuma alteração detectada' });
      return;
    }

    updateUserMutation.mutate({ userId: selectedUser.id, updates });
  };

  const confirmDelete = (type: 'user' | 'ride', id: string, label: string) => {
    setDeleteTarget({ type, id, label });
    setShowDeleteConfirm(true);
  };

  // ── Filtering ──
  const filteredRides = rides?.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !searchTerm || [
      r.origem_texto,
      r.destino_texto,
      r.cliente?.nome,
      r.cliente?.telefone,
      r.motorista?.nome,
    ].some(f => f?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
      searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ));
    return matchStatus && matchSearch;
  });

  const filteredUsers = users?.filter((u) => {
    const matchType = userTypeFilter === 'all' || u.tipo === userTypeFilter || (u.roles && u.roles.includes(userTypeFilter));
    const matchSearch = !userSearchTerm ||
      u.nome?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
        userSearchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      ) ||
      u.telefone?.includes(userSearchTerm);
    return matchType && matchSearch;
  });

  // ── Stats ──
  const stats = {
    total: rides?.length || 0,
    novas: rides?.filter(r => r.status === 'nova').length || 0,
    aguardando: rides?.filter(r => r.status === 'aguardando_motorista').length || 0,
    aceitas: rides?.filter(r => r.status === 'aceita').length || 0,
    emAnalise: rides?.filter(r => r.status === 'em_analise').length || 0,
    aprovadas: rides?.filter(r => r.status === 'aprovada').length || 0,
    whatsapp: rides?.filter(r => r.canal_origem === 'whatsapp').length || 0,
    app: rides?.filter(r => r.canal_origem === 'app').length || 0,
    motoristas: users?.filter(u => u.tipo === 'motorista').length || 0,
    clientes: users?.filter(u => u.tipo === 'cliente').length || 0,
    totalUsers: users?.length || 0,
    banidos: users?.filter(u => u.status === 'banido').length || 0,
  };

  return (
    <AppShell>
      <div className="w-full px-[3%] py-[3%] max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-[3%]">
          <h1 className="text-[clamp(1.3rem,4vw,1.75rem)] font-extrabold flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground text-[clamp(0.7rem,2vw,0.85rem)] mt-1">Controle completo de solicitações, motoristas e clientes</p>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="w-full mb-[3%] h-auto min-h-[48px] p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl flex flex-wrap gap-1">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <Activity className="w-3.5 h-3.5 shrink-0" /> <span className="hidden xs:inline">Dashboard</span><span className="xs:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <Car className="w-3.5 h-3.5 shrink-0" /> Corridas
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <Users className="w-3.5 h-3.5 shrink-0" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <Car className="w-3.5 h-3.5 shrink-0" /> Motoristas
            </TabsTrigger>
            <TabsTrigger value="precificacao" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <DollarSign className="w-3.5 h-3.5 shrink-0" /> Preços
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <Navigation className="w-3.5 h-3.5 shrink-0" /> Tracking
            </TabsTrigger>
            <TabsTrigger value="despacho" className="flex-1 min-w-[80px] gap-1 rounded-xl h-10 text-[11px] sm:text-xs font-semibold data-[state=active]:bg-[hsl(22_100%_55%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[hsl(22_100%_55%/0.2)]">
              <Activity className="w-3.5 h-3.5 shrink-0" /> Despacho
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════ DASHBOARD TAB ═══════════════════════════════ */}
          <TabsContent value="dashboard">
            {loadingRides || loadingUsers ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : (
              <Suspense fallback={<TabLoader />}>
                <AdminStatsDashboard rides={rides || []} users={users || []} />
              </Suspense>
            )}
          </TabsContent>

          {/* ═══════════════════════════════ CORRIDAS TAB ═══════════════════════════════ */}
          <TabsContent value="solicitacoes">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, telefone ou endereço..."
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-56">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingRides ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : !filteredRides?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma solicitação encontrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRides.map((ride, i) => {
                  const cfg = STATUS_CONFIG[ride.status] || STATUS_CONFIG.nova;
                  const needsAction = ride.status === 'em_analise';
                  const canValidate = ['aceita', 'em_analise', 'aguardando_motorista', 'nova'].includes(ride.status);

                  return (
                    <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <Card className={needsAction ? 'border-orange-500/30 bg-orange-500/5' : ''}>
                        <CardContent className="py-4">
                          <div className="flex flex-col gap-3">
                            {/* Top row */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                                  {cfg.icon}
                                  {cfg.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs gap-1">
                                  {ride.canal_origem === 'whatsapp' ? (
                                    <><MessageSquare className="w-3 h-3 text-green-400" /> WhatsApp</>
                                  ) : (
                                    <><Globe className="w-3 h-3 text-blue-400" /> App</>
                                  )}
                                </Badge>
                                {ride.confianca_ia != null && (
                                  <Badge variant="outline" className="text-[10px]">
                                    IA: {Math.round(ride.confianca_ia * 100)}%
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(ride.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>

                            {/* Client & Driver info */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium">{ride.cliente?.nome || 'Desconhecido'}</span>
                                <span className="text-xs text-muted-foreground">{ride.cliente?.telefone}</span>
                              </div>
                              {ride.motorista && (
                                <div className="flex items-center gap-2">
                                  <Car className="w-3.5 h-3.5 text-accent" />
                                  <span className="text-sm">{ride.motorista.nome}</span>
                                  <span className="text-xs text-muted-foreground">{ride.motorista.telefone}</span>
                                </div>
                              )}
                            </div>

                            {/* Route */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                <span className="text-sm">{ride.origem_texto}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                                <span className="text-sm">{ride.destino_texto}</span>
                              </div>
                            </div>

                            {/* Value & observation */}
                            {(ride.valor != null || ride.valor_estimado != null || ride.observacao_motorista) && (
                              <div className="flex items-center gap-4 text-xs flex-wrap">
                                {ride.valor != null && (
                                  <span className="flex items-center gap-1 text-green-400 font-semibold">
                                    <DollarSign className="w-3 h-3" />
                                    R$ {Number(ride.valor).toFixed(2)}
                                  </span>
                                )}
                                {ride.valor_estimado != null && (
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    Est: R$ {Number(ride.valor_estimado).toFixed(2)}
                                  </span>
                                )}
                                {ride.observacao_motorista && (
                                  <span className="flex items-center gap-1 text-muted-foreground italic">
                                    <MessageSquare className="w-3 h-3" />
                                    {ride.observacao_motorista}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Avaliações */}
                            {(ride.avaliacao_cliente || ride.avaliacao_motorista) && (
                              <div className="flex items-center gap-4 text-xs flex-wrap">
                                {ride.avaliacao_cliente && (
                                  <span className="flex items-center gap-1.5" title={ride.avaliacao_cliente.comentario || ''}>
                                    <User className="w-3 h-3 text-blue-400" />
                                    <span className="text-muted-foreground">Cliente:</span>
                                    <span className="flex items-center gap-0.5">
                                      {[1,2,3,4,5].map(s => (
                                        <Star key={s} className={`w-3 h-3 ${s <= ride.avaliacao_cliente!.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                                      ))}
                                    </span>
                                    {ride.avaliacao_cliente.comentario && (
                                      <span className="text-muted-foreground italic max-w-[150px] truncate">"{ride.avaliacao_cliente.comentario}"</span>
                                    )}
                                  </span>
                                )}
                                {ride.avaliacao_motorista && (
                                  <span className="flex items-center gap-1.5" title={ride.avaliacao_motorista.comentario || ''}>
                                    <Car className="w-3 h-3 text-accent" />
                                    <span className="text-muted-foreground">Motorista:</span>
                                    <span className="flex items-center gap-0.5">
                                      {[1,2,3,4,5].map(s => (
                                        <Star key={s} className={`w-3 h-3 ${s <= ride.avaliacao_motorista!.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                                      ))}
                                    </span>
                                    {ride.avaliacao_motorista.comentario && (
                                      <span className="text-muted-foreground italic max-w-[150px] truncate">"{ride.avaliacao_motorista.comentario}"</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openDetailDialog(ride)}>
                                <Eye className="w-3 h-3" /> Detalhes
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openEditRideDialog(ride)}>
                                <Pencil className="w-3 h-3" /> Editar
                              </Button>

                              {canValidate && (
                                <>
                                  <Button
                                    size="sm" variant="outline"
                                    className="text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                                    onClick={() => openApprovalDialog(ride, 'aprovada')}
                                  >
                                    <CheckCircle className="w-3 h-3" /> Aprovar
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className="text-xs gap-1 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                                    onClick={() => openApprovalDialog(ride, 'nao_realizada')}
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Não Realizada
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                                    onClick={() => openApprovalDialog(ride, 'recusada')}
                                  >
                                    <XCircle className="w-3 h-3" /> Recusar
                                  </Button>
                                </>
                              )}

                              <Button
                                size="sm" variant="outline"
                                className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10 ml-auto"
                                onClick={() => confirmDelete('ride', ride.id, `Corrida de ${ride.cliente?.nome || 'cliente'}`)}
                              >
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
          </TabsContent>

          {/* ═══════════════════════════════ USUÁRIOS TAB ═══════════════════════════════ */}
          <TabsContent value="usuarios">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou telefone..."
                  className="pl-9"
                />
              </div>
              <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="motorista">Motoristas</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary badges */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <Users className="w-3 h-3" /> {stats.totalUsers} total
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 text-blue-400 border-blue-500/30">
                <User className="w-3 h-3" /> {stats.clientes} clientes
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 text-accent border-accent/30">
                <Car className="w-3 h-3" /> {stats.motoristas} motoristas
              </Badge>
              {stats.banidos > 0 && (
                <Badge variant="outline" className="text-xs gap-1 text-red-400 border-red-500/30">
                  <Ban className="w-3 h-3" /> {stats.banidos} banidos
                </Badge>
              )}
            </div>

            {loadingUsers ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : !filteredUsers?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u, i) => {
                  const rideCount = rides?.filter(r => r.cliente_id === u.id || r.motorista_id === u.id).length || 0;
                  const tipos: string[] = u.roles && u.roles.length > 0 
                    ? u.roles 
                    : u.tipo === 'admin' 
                      ? ['admin'] 
                      : u.tipo === 'motorista' 
                        ? ['motorista'] 
                        : ['cliente'];
                  return (
                    <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <Card className={u.status === 'banido' ? 'border-red-500/30 bg-red-500/5' : ''}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                u.tipo === 'motorista' ? 'bg-accent/20' : u.tipo === 'admin' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                              }`}>
                                {u.tipo === 'motorista' ? <Car className="w-5 h-5 text-accent" /> :
                                 u.tipo === 'admin' ? <Shield className="w-5 h-5 text-purple-400" /> :
                                 <User className="w-5 h-5 text-blue-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{u.nome || 'Sem nome'}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="w-3 h-3" />
                                  {u.telefone}
                                </div>
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {tipos.map(r => {
                                    const rl: Record<string, string> = { cliente: '👤 Cliente', motorista: '🚗 Motorista', admin: '🛡️ Admin' };
                                    const rc: Record<string, string> = {
                                      cliente: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                      motorista: 'bg-green-500/20 text-green-400 border-green-500/30',
                                      admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                                    };
                                    return (
                                      <Badge key={r} variant="outline" className={`text-[10px] px-1.5 ${rc[r] || ''}`}>
                                        {rl[r] || r}
                                      </Badge>
                                    );
                                  })}
                                  <Badge
                                    variant={u.status === 'ativo' ? 'outline' : 'destructive'}
                                    className="text-[10px] px-1.5"
                                  >
                                    {u.status === 'ativo' ? '✅ Ativo' : '🚫 Banido'}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    {rideCount} corrida{rideCount !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Cadastro: {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <Button
                                size="sm" variant="outline" className="text-xs gap-1"
                                onClick={() => openEditUserDialog(u)}
                              >
                                <Pencil className="w-3 h-3" /> Editar
                              </Button>
                              <Button
                                size="sm"
                                variant={u.status === 'ativo' ? 'destructive' : 'default'}
                                className="text-xs gap-1"
                                onClick={() =>
                                  updateUserMutation.mutate({
                                    userId: u.id,
                                    updates: {
                                      status: u.status === 'ativo' ? 'banido' : 'ativo',
                                      ativo: u.status !== 'ativo',
                                    },
                                  })
                                }
                              >
                                {u.status === 'ativo' ? <><Ban className="w-3 h-3" /> Banir</> : <><CheckCircle className="w-3 h-3" /> Ativar</>}
                              </Button>
                              {u.tipo !== 'admin' && (
                                <Button
                                  size="sm" variant="outline"
                                  className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                                  onClick={() => confirmDelete('user', u.id, u.nome)}
                                >
                                  <Trash2 className="w-3 h-3" /> Excluir
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════ MOTORISTAS TAB ═══════════════════════════════ */}
          <TabsContent value="motoristas">
            <Suspense fallback={<TabLoader />}>
              <AdminMotoristas users={users || []} rides={rides || []} loading={loadingUsers || loadingRides} />
            </Suspense>
          </TabsContent>

          {/* ═══════════════════════════════ PRECIFICAÇÃO TAB ═══════════════════════════════ */}
          <TabsContent value="precificacao">
            <Tabs defaultValue="tabela_rf" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="tabela_rf" className="flex-1 gap-2">
                  <TableProperties className="w-4 h-4" /> Tabela RF
                </TabsTrigger>
                <TabsTrigger value="precificacao_dinamica" className="flex-1 gap-2">
                  <DollarSign className="w-4 h-4" /> Configurações de Preços
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tabela_rf">
                <Suspense fallback={<TabLoader />}>
                  <AdminTabelaPrecos />
                </Suspense>
              </TabsContent>
              <TabsContent value="precificacao_dinamica">
                <Suspense fallback={<TabLoader />}>
                  <AdminPricing />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ═══════════════════════════════ TRACKING TAB ═══════════════════════════════ */}
          <TabsContent value="tracking">
            <Suspense fallback={<TabLoader />}>
              <AdminTracking />
            </Suspense>
          </TabsContent>

          {/* ═══════════════════════════════ DESPACHO TAB ═══════════════════════════════ */}
          <TabsContent value="despacho">
            <Suspense fallback={<TabLoader />}>
              <AdminDispatch />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalAction === 'aprovada' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {approvalAction === 'nao_realizada' && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
              {approvalAction === 'recusada' && <XCircle className="w-5 h-5 text-red-400" />}
              {approvalAction === 'aprovada' ? 'Aprovar Solicitação' :
               approvalAction === 'nao_realizada' ? 'Marcar como Não Realizada' :
               'Recusar Solicitação'}
            </DialogTitle>
            <DialogDescription>
              A observação é obrigatória para manter o histórico de auditoria.
            </DialogDescription>
          </DialogHeader>

          {selectedRide && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{selectedRide.cliente?.nome}</span>
                  <span className="text-xs text-muted-foreground">{selectedRide.cliente?.telefone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{selectedRide.origem_texto}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span>{selectedRide.destino_texto}</span>
                </div>
                {selectedRide.motorista && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Car className="w-3 h-3" />
                    Motorista: {selectedRide.motorista.nome}
                  </div>
                )}
                {selectedRide.valor != null && (
                  <div className="flex items-center gap-2 text-sm text-green-400 font-semibold">
                    <DollarSign className="w-3.5 h-3.5" />
                    R$ {Number(selectedRide.valor).toFixed(2)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Observação (opcional)
                </label>
                <Textarea
                  value={approvalObs}
                  onChange={(e) => setApprovalObs(e.target.value)}
                  placeholder="Descreva o motivo da ação..."
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleApproval}
              disabled={approvalMutation.isPending}
              className={
                approvalAction === 'aprovada' ? 'bg-green-600 hover:bg-green-700 text-white' :
                approvalAction === 'recusada' ? 'bg-red-600 hover:bg-red-700 text-white' :
                'bg-yellow-600 hover:bg-yellow-700 text-white'
              }
            >
              {approvalMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ EDIT RIDE DIALOG ═══════════════════ */}
      <Dialog open={showEditRideDialog} onOpenChange={setShowEditRideDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" />
              Editar Corrida
            </DialogTitle>
            <DialogDescription>
              Altere os dados da corrida diretamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs">Origem</Label>
                <Input
                  value={editRideForm.origem_texto}
                  onChange={(e) => setEditRideForm(f => ({ ...f, origem_texto: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Destino</Label>
                <Input
                  value={editRideForm.destino_texto}
                  onChange={(e) => setEditRideForm(f => ({ ...f, destino_texto: e.target.value }))}
                />
              </div>
              {precoTabelaAdmin && (
                <div className="sm:col-span-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableProperties className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Preço tabelado RF</p>
                        <p className="text-lg font-bold text-green-400">R$ {precoTabelaAdmin.valor.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-green-400 hover:text-green-300 h-6"
                        onClick={() => setEditRideForm(f => ({ ...f, valor: precoTabelaAdmin.valor.toFixed(2), valor_estimado: precoTabelaAdmin.valor.toFixed(2) }))}
                      >
                        Aplicar nos valores
                      </Button>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                        {precoTabelaAdmin.origem_tabela} → {precoTabelaAdmin.destino_tabela}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editRideForm.status} onValueChange={(v) => setEditRideForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Motorista</Label>
                <Select
                  value={editRideForm.motorista_id || '_none'}
                  onValueChange={(v) => setEditRideForm(f => ({ ...f, motorista_id: v === '_none' ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Sem motorista" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem motorista</SelectItem>
                    {motoristas.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome} ({m.telefone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={editRideForm.valor}
                  onChange={(e) => setEditRideForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs">Valor Estimado (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={editRideForm.valor_estimado}
                  onChange={(e) => setEditRideForm(f => ({ ...f, valor_estimado: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs">Horário Estimado</Label>
                <Input
                  value={editRideForm.horario_estimado}
                  onChange={(e) => setEditRideForm(f => ({ ...f, horario_estimado: e.target.value }))}
                  placeholder="Ex: 14:30"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={editRideForm.observacoes}
                  onChange={(e) => setEditRideForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRideDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveRide}
              disabled={updateRideMutation.isPending || !editRideForm.origem_texto.trim() || !editRideForm.destino_texto.trim()}
              className="gap-1"
            >
              {updateRideMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ EDIT USER DIALOG ═══════════════════ */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              Altere os dados do usuário. Deixe a senha em branco para manter a atual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={editUserForm.nome}
                onChange={(e) => setEditUserForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                value={editUserForm.telefone}
                onChange={(e) => setEditUserForm(f => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Tipo / Cargos</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/30 text-sm">
                  <span className="capitalize">{editUserForm.tipo}</span>
                  {editUserForm.roles.length > 0 && (
                    <span className="text-muted-foreground text-xs">({editUserForm.roles.join(', ')})</span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editUserForm.status} onValueChange={(v) => setEditUserForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">✅ Ativo</SelectItem>
                    <SelectItem value="banido">🚫 Banido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Nova Senha (opcional)</Label>
              <Input
                type="password"
                value={editUserForm.senha}
                onChange={(e) => setEditUserForm(f => ({ ...f, senha: e.target.value }))}
                placeholder="Deixe em branco para manter"
              />
            </div>

            {selectedUser && (
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p>ID: <span className="font-mono text-[10px]">{selectedUser.id}</span></p>
                <p>Cadastro: {new Date(selectedUser.created_at).toLocaleString('pt-BR')}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending || !editUserForm.nome.trim() || !editUserForm.telefone.trim()}
              className="gap-1"
            >
              {updateUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ DETAIL DIALOG ═══════════════════ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>

          {selectedRide && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant="outline" className={STATUS_CONFIG[selectedRide.status]?.color || ''}>
                  {STATUS_CONFIG[selectedRide.status]?.label || selectedRide.status}
                </Badge>
              </div>

              {/* Channel */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Canal:</span>
                <Badge variant="outline" className="gap-1">
                  {selectedRide.canal_origem === 'whatsapp' ? (
                    <><MessageSquare className="w-3 h-3 text-green-400" /> WhatsApp</>
                  ) : (
                    <><Globe className="w-3 h-3 text-blue-400" /> App</>
                  )}
                </Badge>
                {selectedRide.confianca_ia != null && (
                  <Badge variant="outline" className="text-xs">
                    Confiança IA: {Math.round(selectedRide.confianca_ia * 100)}%
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Client info */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">CLIENTE</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium">{selectedRide.cliente?.nome}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedRide.cliente?.telefone}
                  </p>
                </div>
              </div>

              {/* Driver info */}
              {selectedRide.motorista && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">MOTORISTA</p>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium">{selectedRide.motorista.nome}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedRide.motorista.telefone}
                    </p>
                  </div>
                </div>
              )}

              {/* Route */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">ROTA</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Embarque</p>
                      <p className="text-sm font-medium">{selectedRide.origem_texto}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="text-sm font-medium">{selectedRide.destino_texto}</p>
                    </div>
                  </div>
                  {selectedRide.horario_estimado && (
                    <div className="flex items-center gap-2 ml-4">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">{selectedRide.horario_estimado}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Values */}
              {(selectedRide.valor != null || selectedRide.valor_estimado != null) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">VALORES</p>
                  <div className="bg-muted/50 rounded-lg p-3 flex gap-6">
                    {selectedRide.valor != null && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Valor Final</p>
                        <p className="text-lg font-bold text-green-400">R$ {Number(selectedRide.valor).toFixed(2)}</p>
                      </div>
                    )}
                    {selectedRide.valor_estimado != null && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Estimado</p>
                        <p className="text-lg font-bold text-muted-foreground">R$ {Number(selectedRide.valor_estimado).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Driver observation */}
              {selectedRide.observacao_motorista && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">OBSERVAÇÃO DO MOTORISTA</p>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm italic">"{selectedRide.observacao_motorista}"</p>
                  </div>
                </div>
              )}

              {/* Observations */}
              {selectedRide.observacoes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">OBSERVAÇÕES DO CLIENTE</p>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm">{selectedRide.observacoes}</p>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">DATAS</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs text-muted-foreground">
                  <p>Criada: {new Date(selectedRide.created_at).toLocaleString('pt-BR')}</p>
                  {selectedRide.concluida_at && (
                    <p>Concluída: {new Date(selectedRide.concluida_at).toLocaleString('pt-BR')}</p>
                  )}
                </div>
              </div>

              {/* ID */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <p>ID: <span className="font-mono text-[10px]">{selectedRide.id}</span></p>
              </div>

              {/* Approval history */}
              {rideAprovacoes.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">HISTÓRICO DE APROVAÇÕES</p>
                  <div className="space-y-2">
                    {rideAprovacoes.map((ap) => (
                      <div key={ap.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={
                            ap.status_admin === 'aprovada' ? 'text-green-400 border-green-500/30' :
                            ap.status_admin === 'recusada' ? 'text-red-400 border-red-500/30' :
                            'text-yellow-400 border-yellow-500/30'
                          }>
                            {ap.status_admin}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(ap.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm">"{ap.observacao}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avaliações */}
              {selectedRide && (selectedRide.avaliacao_cliente || selectedRide.avaliacao_motorista) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-400" />
                    Avaliações
                  </h4>
                  <div className="space-y-2">
                    {selectedRide.avaliacao_cliente && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Cliente avaliou o motorista</p>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-4 h-4 ${s <= selectedRide.avaliacao_cliente!.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-sm ml-1 font-semibold">{selectedRide.avaliacao_cliente.nota}/5</span>
                        </div>
                        {selectedRide.avaliacao_cliente.comentario && (
                          <p className="text-sm text-muted-foreground italic">"{selectedRide.avaliacao_cliente.comentario}"</p>
                        )}
                      </div>
                    )}
                    {selectedRide.avaliacao_motorista && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Motorista avaliou o cliente</p>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-4 h-4 ${s <= selectedRide.avaliacao_motorista!.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-sm ml-1 font-semibold">{selectedRide.avaliacao_motorista.nota}/5</span>
                        </div>
                        {selectedRide.avaliacao_motorista.comentario && (
                          <p className="text-sm text-muted-foreground italic">"{selectedRide.avaliacao_motorista.comentario}"</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fechar</Button>
            {selectedRide && (
              <Button className="gap-1" onClick={() => { setShowDetailDialog(false); openEditRideDialog(selectedRide); }}>
                <Pencil className="w-4 h-4" /> Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ DELETE CONFIRMATION DIALOG ═══════════════════ */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="py-2">
              <p className="text-sm">
                Tem certeza que deseja excluir {deleteTarget.type === 'user' ? 'o usuário' : 'a corrida'}{' '}
                <strong>{deleteTarget.label}</strong>?
              </p>
              {deleteTarget.type === 'user' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Corridas associadas a este usuário podem causar erros se não forem removidas antes.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
              className="gap-1"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminDashboard;
