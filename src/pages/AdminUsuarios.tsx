import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/AdminLayout';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, Car, Shield, Loader2, Phone, Search, Filter,
  Users, UserPlus, Pencil, Trash2, Save, Camera,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  avatar_url?: string | null;
  veiculo_foto?: string | null;
};

const VEHICLE_BRANDS = [
  'Chevrolet', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jeep', 'Nissan',
  'Peugeot', 'Renault', 'Toyota', 'Volkswagen', 'Citroën', 'Mitsubishi',
  'Kia', 'Caoa Chery', 'BYD', 'GWM', 'RAM', 'Suzuki', 'Outro',
];
const VEHICLE_MODELS: Record<string, string[]> = {
  Chevrolet: ['Onix', 'Onix Plus', 'Tracker', 'S10', 'Spin', 'Montana', 'Equinox', 'Cruze', 'Outro'],
  Fiat: ['Argo', 'Mobi', 'Pulse', 'Fastback', 'Strada', 'Toro', 'Cronos', 'Uno', 'Outro'],
  Ford: ['Ka', 'Ka Sedan', 'EcoSport', 'Ranger', 'Territory', 'Maverick', 'Outro'],
  Honda: ['Civic', 'City', 'HR-V', 'ZR-V', 'CR-V', 'Fit', 'WR-V', 'Outro'],
  Hyundai: ['HB20', 'HB20S', 'Creta', 'Tucson', 'Santa Fe', 'Outro'],
  Jeep: ['Renegade', 'Compass', 'Commander', 'Outro'],
  Nissan: ['Kicks', 'Versa', 'Sentra', 'Frontier', 'Outro'],
  Peugeot: ['208', '2008', '3008', 'Outro'],
  Renault: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Outro'],
  Toyota: ['Corolla', 'Corolla Cross', 'Yaris', 'Hilux', 'SW4', 'Outro'],
  Volkswagen: ['Gol', 'Voyage', 'Polo', 'Virtus', 'T-Cross', 'Nivus', 'Saveiro', 'Outro'],
  'Citroën': ['C3', 'C4 Cactus', 'Outro'],
  Mitsubishi: ['L200', 'Outlander', 'Eclipse Cross', 'Outro'],
  Kia: ['Sportage', 'Seltos', 'Cerato', 'Outro'],
  'Caoa Chery': ['Tiggo 5X', 'Tiggo 7', 'Tiggo 8', 'Outro'],
  BYD: ['Dolphin', 'Song Plus', 'Yuan Plus', 'Seal', 'Outro'],
  GWM: ['Haval H6', 'Haval Jolion', 'Outro'],
  RAM: ['Rampage', '1500', 'Outro'],
  Suzuki: ['Jimny', 'Vitara', 'Outro'],
  Outro: ['Outro'],
};
const VEHICLE_COLORS = ['Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho', 'Azul', 'Marrom', 'Bege', 'Verde', 'Amarelo', 'Laranja', 'Dourado', 'Vinho'];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}.${digits.slice(7, 11)}`;
}
function formatPlate(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

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

const AdminUsuarios: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');

  // ── User Dialogs ──
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    nome: '', telefone: '', tipo: '', roles: [] as string[], status: '', senha: '', isAdmin: false,
    veiculo_marca: '', veiculo_modelo: '', veiculo_cor: '', veiculo_placa: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadingVeiculoFoto, setUploadingVeiculoFoto] = useState(false);
  const veiculoFotoRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    nome: '', telefone: '', senha: '', isAdmin: false,
    veiculo_marca: '', veiculo_modelo: '', veiculo_cor: '', veiculo_placa: '',
  });

  // ── Fetch users ──
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

  // ── Fetch rides count ──
  const { data: rides } = useQuery({
    queryKey: ['admin-rides'],
    queryFn: async () => {
      const { data, error } = await supabase.from('corridas').select('id, cliente_id, motorista_id');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  // ── Mutations ──
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      await resilientUpdate('users', updates, 'id', userId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast({ title: 'Usuário atualizado!' }); setShowEditUserDialog(false); setSelectedUser(null); },
    onError: (e: any) => { toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' }); },
  });

  const createUserMutation = useMutation({
    mutationFn: async (form: typeof createUserForm) => {
      const { data: existing } = await supabase.from('users').select('id').eq('telefone', form.telefone.trim()).limit(1);
      if (existing && existing.length > 0) throw new Error('Já existe um usuário com este telefone');
      const phoneDigits = form.telefone.replace(/\D/g, '');
      const { data: existing2 } = await supabase.from('users').select('id').eq('telefone', phoneDigits).limit(1);
      if (existing2 && existing2.length > 0) throw new Error('Já existe um usuário com este telefone');
      const roles = form.isAdmin ? ['motorista', 'admin'] : ['motorista'];
      const tipo = form.isAdmin ? 'admin' : 'motorista';
      const newUser: Record<string, unknown> = {
        nome: form.nome.trim(), telefone: phoneDigits, tipo, roles, senha: form.senha.trim(), status: 'ativo', ativo: true,
      };
      if (form.veiculo_marca) newUser.veiculo_marca = form.veiculo_marca;
      if (form.veiculo_modelo) newUser.veiculo_modelo = form.veiculo_modelo;
      if (form.veiculo_cor) newUser.veiculo_cor = form.veiculo_cor;
      if (form.veiculo_placa) newUser.veiculo_placa = form.veiculo_placa;
      const { error } = await supabase.from('users').insert(newUser);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuário criado!' });
      setShowCreateUserDialog(false);
      setCreateUserForm({ nome: '', telefone: '', senha: '', isAdmin: false, veiculo_marca: '', veiculo_modelo: '', veiculo_cor: '', veiculo_placa: '' });
    },
    onError: (e: any) => { toast({ title: 'Erro ao criar', description: e?.message, variant: 'destructive' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('aprovacoes').delete().eq('admin_id', id);
      await supabase.from('avaliacoes').delete().eq('cliente_id', id);
      await supabase.from('avaliacoes').delete().eq('motorista_id', id);
      const { data: clientRides } = await supabase.from('corridas').select('id').eq('cliente_id', id);
      if (clientRides && clientRides.length > 0) {
        for (const ride of clientRides) {
          await supabase.from('aprovacoes').delete().eq('solicitacao_id', ride.id);
          await supabase.from('avaliacoes').delete().eq('corrida_id', ride.id);
          await supabase.from('historico_precos').delete().eq('corrida_id', ride.id);
        }
        await supabase.from('corridas').delete().eq('cliente_id', id);
      }
      await supabase.from('corridas').update({ motorista_id: null }).eq('motorista_id', id);
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); queryClient.invalidateQueries({ queryKey: ['admin-rides'] }); toast({ title: 'Excluído com sucesso!' }); setShowDeleteConfirm(false); setDeleteTarget(null); },
    onError: (err: any) => { toast({ title: 'Erro ao excluir', description: err?.message, variant: 'destructive' }); },
  });

  // ── Vehicle photo upload ──
  const handleVeiculoFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione uma imagem', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande (máx. 10MB)', variant: 'destructive' });
      return;
    }
    setUploadingVeiculoFoto(true);
    try {
      const filePath = `veiculos/${selectedUser.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('users').update({ veiculo_foto: publicUrl }).eq('id', selectedUser.id);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['driver-full-profile'] });
      toast({ title: 'Foto do veículo atualizada!' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Erro ao enviar foto', variant: 'destructive' });
    } finally {
      setUploadingVeiculoFoto(false);
      e.target.value = '';
    }
  };

  // ── Helpers ──
  const openEditUserDialog = (u: UserRecord) => {
    setSelectedUser(u);
    const derivedRoles = u.roles && u.roles.length > 0 ? u.roles : (u.tipo === 'admin' ? ['admin', 'motorista'] : ['motorista']);
    const isAdmin = derivedRoles.includes('admin');
    setEditUserForm({
      nome: u.nome, telefone: formatPhone(u.telefone), tipo: 'motorista', roles: derivedRoles,
      status: u.status, senha: '', isAdmin,
      veiculo_marca: u.veiculo_marca || '', veiculo_modelo: u.veiculo_modelo || '', veiculo_cor: u.veiculo_cor || '', veiculo_placa: u.veiculo_placa ? formatPlate(u.veiculo_placa) : '',
    });
    setShowEditUserDialog(true);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    const updates: Record<string, unknown> = {};
    if (editUserForm.nome.trim() !== selectedUser.nome) updates.nome = editUserForm.nome.trim();
    if (editUserForm.telefone.trim() !== selectedUser.telefone) updates.telefone = editUserForm.telefone.trim();
    if (editUserForm.status !== selectedUser.status) { updates.status = editUserForm.status; updates.ativo = editUserForm.status === 'ativo'; }
    if (editUserForm.senha.trim()) updates.senha = editUserForm.senha.trim();
    const newRoles = editUserForm.isAdmin ? ['motorista', 'admin'] : ['motorista'];
    const newTipo = editUserForm.isAdmin ? 'admin' : 'motorista';
    const currentRoles = selectedUser.roles || [selectedUser.tipo];
    if (JSON.stringify(newRoles.sort()) !== JSON.stringify([...currentRoles].sort())) { updates.roles = newRoles; updates.tipo = newTipo; }
    if ((editUserForm.veiculo_marca || '') !== (selectedUser.veiculo_marca || '')) updates.veiculo_marca = editUserForm.veiculo_marca || null;
    if ((editUserForm.veiculo_modelo || '') !== (selectedUser.veiculo_modelo || '')) updates.veiculo_modelo = editUserForm.veiculo_modelo || null;
    if ((editUserForm.veiculo_cor || '') !== (selectedUser.veiculo_cor || '')) updates.veiculo_cor = editUserForm.veiculo_cor || null;
    if ((editUserForm.veiculo_placa || '') !== (selectedUser.veiculo_placa || '')) updates.veiculo_placa = editUserForm.veiculo_placa || null;
    if (Object.keys(updates).length === 0) { toast({ title: 'Nenhuma alteração' }); return; }
    updateUserMutation.mutate({ userId: selectedUser.id, updates });
  };

  // ── Filtering ──
  const filteredUsers = users?.filter((u) => {
    const matchType = userTypeFilter === 'all' || (userTypeFilter === 'ativo' && u.status === 'ativo') || (userTypeFilter === 'banido' && u.status === 'banido') || (userTypeFilter === 'admin' && (u.roles?.includes('admin') || u.tipo === 'admin'));
    const matchSearch = !userSearchTerm || u.nome?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(userSearchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || u.telefone?.includes(userSearchTerm);
    return matchType && matchSearch;
  });

  const stats = {
    total: users?.length || 0,
    ativos: users?.filter(u => u.status === 'ativo').length || 0,
    admins: users?.filter(u => u.roles?.includes('admin') || u.tipo === 'admin').length || 0,
    inativos: users?.filter(u => u.status === 'banido').length || 0,
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2"><Users className="w-5 h-5 text-accent" /> Usuários</h1>
          <p className="text-xs text-muted-foreground mt-1">Gerenciar motoristas e administradores</p>
        </div>
        <Button className="gap-1.5" onClick={() => { setCreateUserForm({ nome: '', telefone: '', senha: '', isAdmin: false, veiculo_marca: '', veiculo_modelo: '', veiculo_cor: '', veiculo_placa: '' }); setShowCreateUserDialog(true); }}>
          <UserPlus className="w-4 h-4" /> Novo Motorista
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Card><CardContent className="py-3 px-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center"><Users className="w-4 h-4 text-white/60" /></div><div><p className="text-lg font-bold leading-none">{stats.total}</p><p className="text-[10px] text-muted-foreground mt-0.5">Total</p></div></CardContent></Card>
        <Card><CardContent className="py-3 px-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-400" /></div><div><p className="text-lg font-bold leading-none text-green-400">{stats.ativos}</p><p className="text-[10px] text-muted-foreground mt-0.5">Ativos</p></div></CardContent></Card>
        <Card><CardContent className="py-3 px-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center"><Shield className="w-4 h-4 text-purple-400" /></div><div><p className="text-lg font-bold leading-none text-purple-400">{stats.admins}</p><p className="text-[10px] text-muted-foreground mt-0.5">Admins</p></div></CardContent></Card>
        <Card><CardContent className="py-3 px-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center"><XCircle className="w-4 h-4 text-red-400" /></div><div><p className="text-lg font-bold leading-none text-red-400">{stats.inativos}</p><p className="text-[10px] text-muted-foreground mt-0.5">Inativos</p></div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} placeholder="Buscar por nome ou telefone..." className="pl-9" /></div>
        <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
          <SelectTrigger className="w-full sm:w-48"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filtrar" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="banido">Inativos</SelectItem><SelectItem value="admin">Administradores</SelectItem></SelectContent>
        </Select>
      </div>

      {/* Users list */}
      {loadingUsers ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !filteredUsers?.length ? (
        <Card><CardContent className="py-12 text-center"><Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Nenhum usuário encontrado</p>
          <Button variant="outline" className="mt-4 gap-1" onClick={() => { setCreateUserForm({ nome: '', telefone: '', senha: '', isAdmin: false, veiculo_marca: '', veiculo_modelo: '', veiculo_cor: '', veiculo_placa: '' }); setShowCreateUserDialog(true); }}><UserPlus className="w-4 h-4" /> Criar primeiro motorista</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((u, i) => {
            const rideCount = rides?.filter(r => r.cliente_id === u.id || r.motorista_id === u.id).length || 0;
            const isAdmin = u.roles?.includes('admin') || u.tipo === 'admin';
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}>
                <Card className={`transition-colors hover:border-white/10 ${u.status === 'banido' ? 'border-red-500/30 bg-red-500/5 opacity-60' : ''}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-accent/20 flex items-center justify-center">
                        {u.avatar_url ? <img src={u.avatar_url} alt={u.nome} className="w-full h-full object-cover" /> : <Car className="w-5 h-5 text-accent" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate text-sm">{u.nome || 'Sem nome'}</p>
                          {isAdmin && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-400 border-purple-500/30">Admin</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {u.telefone}</span>
                          <span className="text-[10px] text-muted-foreground">{rideCount} corrida{rideCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="icon" variant="ghost" className={`h-8 w-8 ${isAdmin ? 'text-purple-400' : 'text-muted-foreground hover:text-purple-400'}`} title={isAdmin ? 'Remover admin' : 'Tornar admin'}
                          onClick={() => { const nR = isAdmin ? ['motorista'] : ['motorista', 'admin']; const nT = isAdmin ? 'motorista' : 'admin'; updateUserMutation.mutate({ userId: u.id, updates: { roles: nR, tipo: nT } }); }}>
                          <Shield className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-white" title="Editar" onClick={() => openEditUserDialog(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className={`h-8 w-8 ${u.status === 'ativo' ? 'text-green-400 hover:text-red-400' : 'text-red-400 hover:text-green-400'}`} title={u.status === 'ativo' ? 'Desativar' : 'Ativar'}
                          onClick={() => updateUserMutation.mutate({ userId: u.id, updates: { status: u.status === 'ativo' ? 'banido' : 'ativo', ativo: u.status !== 'ativo' } })}>
                          {u.status === 'ativo' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-400" title="Excluir" onClick={() => { setDeleteTarget({ id: u.id, label: u.nome }); setShowDeleteConfirm(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ EDIT USER DIALOG ═══ */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-accent" />Editar Motorista</DialogTitle><DialogDescription>Altere os dados do motorista.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs">Nome</Label><Input value={editUserForm.nome} onChange={(e) => setEditUserForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label className="text-xs">Telefone</Label><Input value={editUserForm.telefone} onChange={(e) => setEditUserForm(f => ({ ...f, telefone: formatPhone(e.target.value) }))} placeholder="(81) 9 9613.8924" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Permissão Admin</Label>
                <div className={`flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer transition-colors ${editUserForm.isAdmin ? 'bg-purple-500/10 border-purple-500/30' : 'bg-muted/30'}`} onClick={() => setEditUserForm(f => ({ ...f, isAdmin: !f.isAdmin }))}>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${editUserForm.isAdmin ? 'bg-purple-500' : 'bg-white/20'}`}><div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editUserForm.isAdmin ? 'translate-x-4' : ''}`} /></div>
                  <span className="text-xs">{editUserForm.isAdmin ? 'Ativado' : 'Desativado'}</span>
                </div>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={editUserForm.status} onValueChange={(v) => setEditUserForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">✅ Ativo</SelectItem><SelectItem value="banido">❌ Inativo</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div><Label className="text-xs">Nova Senha (opcional)</Label><Input type="password" value={editUserForm.senha} onChange={(e) => setEditUserForm(f => ({ ...f, senha: e.target.value }))} placeholder="Deixe em branco para manter" /></div>
            <Separator /><p className="text-xs text-muted-foreground font-medium">DADOS DO VEÍCULO</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Marca</Label><Select value={editUserForm.veiculo_marca} onValueChange={(v) => setEditUserForm(f => ({ ...f, veiculo_marca: v, veiculo_modelo: '' }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{VEHICLE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Modelo</Label><Select value={editUserForm.veiculo_modelo} onValueChange={(v) => setEditUserForm(f => ({ ...f, veiculo_modelo: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(VEHICLE_MODELS[editUserForm.veiculo_marca] || ['Outro']).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Cor</Label><Select value={editUserForm.veiculo_cor} onValueChange={(v) => setEditUserForm(f => ({ ...f, veiculo_cor: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{VEHICLE_COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Placa</Label><Input value={editUserForm.veiculo_placa} onChange={(e) => setEditUserForm(f => ({ ...f, veiculo_placa: formatPlate(e.target.value) }))} placeholder="ABC-1234" maxLength={8} /></div>
            </div>
            {/* Vehicle photo upload */}
            <div>
              <Label className="text-xs">Foto do Veículo</Label>
              <div className="flex items-center gap-3 mt-1">
                {selectedUser?.veiculo_foto ? (
                  <img src={selectedUser.veiculo_foto} alt="Veículo" className="w-24 h-16 rounded-lg object-cover border border-white/10" />
                ) : (
                  <div className="w-24 h-16 rounded-lg bg-muted/30 border border-dashed border-white/10 flex items-center justify-center">
                    <Car className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => veiculoFotoRef.current?.click()} disabled={uploadingVeiculoFoto}>
                  {uploadingVeiculoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {selectedUser?.veiculo_foto ? 'Alterar' : 'Enviar'}
                </Button>
                <input ref={veiculoFotoRef} type="file" accept="image/*" className="hidden" onChange={handleVeiculoFotoUpload} />
              </div>
            </div>
            {selectedUser && <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1"><p>ID: <span className="font-mono text-[10px]">{selectedUser.id}</span></p><p>Cadastro: {new Date(selectedUser.created_at).toLocaleString('pt-BR')}</p></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending || !editUserForm.nome.trim() || !editUserForm.telefone.trim()} className="gap-1">
              {updateUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CREATE USER DIALOG ═══ */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-accent" />Novo Motorista</DialogTitle><DialogDescription>Preencha os dados para criar um novo motorista.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs">Nome *</Label><Input value={createUserForm.nome} onChange={(e) => setCreateUserForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" /></div>
            <div><Label className="text-xs">Telefone *</Label><Input value={createUserForm.telefone} onChange={(e) => setCreateUserForm(f => ({ ...f, telefone: formatPhone(e.target.value) }))} placeholder="(81) 9 9613.8924" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Permissão Admin</Label>
                <div className={`flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer transition-colors ${createUserForm.isAdmin ? 'bg-purple-500/10 border-purple-500/30' : 'bg-muted/30'}`} onClick={() => setCreateUserForm(f => ({ ...f, isAdmin: !f.isAdmin }))}>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${createUserForm.isAdmin ? 'bg-purple-500' : 'bg-white/20'}`}><div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${createUserForm.isAdmin ? 'translate-x-4' : ''}`} /></div>
                  <span className="text-xs">{createUserForm.isAdmin ? 'Ativado' : 'Desativado'}</span>
                </div>
              </div>
              <div><Label className="text-xs">Senha *</Label><Input type="password" value={createUserForm.senha} onChange={(e) => setCreateUserForm(f => ({ ...f, senha: e.target.value }))} placeholder="Senha de acesso" /></div>
            </div>
            <Separator /><p className="text-xs text-muted-foreground font-medium">DADOS DO VEÍCULO (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Marca</Label><Select value={createUserForm.veiculo_marca} onValueChange={(v) => setCreateUserForm(f => ({ ...f, veiculo_marca: v, veiculo_modelo: '' }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{VEHICLE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Modelo</Label><Select value={createUserForm.veiculo_modelo} onValueChange={(v) => setCreateUserForm(f => ({ ...f, veiculo_modelo: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(VEHICLE_MODELS[createUserForm.veiculo_marca] || ['Outro']).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Cor</Label><Select value={createUserForm.veiculo_cor} onValueChange={(v) => setCreateUserForm(f => ({ ...f, veiculo_cor: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{VEHICLE_COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Placa</Label><Input value={createUserForm.veiculo_placa} onChange={(e) => setCreateUserForm(f => ({ ...f, veiculo_placa: formatPlate(e.target.value) }))} placeholder="ABC-1234" maxLength={8} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>Cancelar</Button>
            <Button onClick={() => createUserMutation.mutate(createUserForm)} disabled={createUserMutation.isPending || !createUserForm.nome.trim() || !createUserForm.telefone.trim() || !createUserForm.senha.trim()} className="gap-1">
              {createUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<UserPlus className="w-4 h-4" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRM ═══ */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-400"><Trash2 className="w-5 h-5" />Confirmar Exclusão</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          {deleteTarget && <div className="py-2"><p className="text-sm">Tem certeza que deseja excluir o usuário <strong>{deleteTarget.label}</strong>?</p></div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="gap-1">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsuarios;
