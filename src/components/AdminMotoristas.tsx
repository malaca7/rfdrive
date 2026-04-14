import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import {
  Car, Users, Shield, Loader2, Phone, Search, Filter, CheckCircle,
  User, Ban, Star, Pencil, UserPlus, XCircle, MapPin, Activity,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

type UserRecord = {
  id: string;
  nome: string;
  telefone: string;
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

type Ride = {
  id: string;
  status: string;
  valor: number | null;
  valor_estimado: number | null;
  motorista_id: string | null;
  avaliacao_cliente?: { nota: number } | null;
};

interface AdminMotoristasProps {
  users: UserRecord[];
  rides: Ride[];
  loading: boolean;
}

const AdminMotoristas: React.FC<AdminMotoristasProps> = ({ users, rides, loading }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilterLocal, setStatusFilterLocal] = useState<string>('all');

  // ── Promote dialog ──
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoteSearch, setPromoteSearch] = useState('');

  // ── Edit driver dialog ──
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    nome: '',
    telefone: '',
    status: '',
    veiculo_marca: '',
    veiculo_modelo: '',
    veiculo_cor: '',
    veiculo_placa: '',
  });

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

  // ── Update mutation ──
  const updateMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      await resilientUpdate('users', updates, 'id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      toast({ title: 'Motorista atualizado!' });
      setShowEditDialog(false);
      setSelectedDriver(null);
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' });
    },
  });

  // ── Promote mutation ──
  const promoteMutation = useMutation({
    mutationFn: async ({ userId, currentRoles }: { userId: string; currentRoles: string[] }) => {
      const newRoles = Array.from(new Set([...currentRoles, 'motorista']));
      await resilientUpdate('users', { tipo: 'motorista', roles: newRoles }, 'id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuário promovido a motorista!' });
      setShowPromoteDialog(false);
      setPromoteSearch('');
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao promover', description: e?.message, variant: 'destructive' });
    },
  });

  // ── Demote mutation ──
  const demoteMutation = useMutation({
    mutationFn: async ({ userId, currentRoles }: { userId: string; currentRoles: string[] }) => {
      const newRoles = currentRoles.filter(r => r !== 'motorista');
      const newTipo = newRoles.includes('admin') ? 'admin' : 'cliente';
      await resilientUpdate('users', {
        tipo: newTipo,
        roles: newRoles.length > 0 ? newRoles : ['cliente'],
        veiculo_marca: null,
        veiculo_modelo: null,
        veiculo_cor: null,
        veiculo_placa: null,
      }, 'id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rides'] });
      toast({ title: 'Role de motorista removida!' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao remover role', description: e?.message, variant: 'destructive' });
    },
  });

  // ── Computed data ──
  const allDrivers = useMemo(() =>
    users.filter(u => u.tipo === 'motorista' || u.roles?.includes('motorista')),
    [users]
  );

  const driverStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; ratings: number[] }> = {};
    rides.forEach(r => {
      if (!r.motorista_id) return;
      if (!map[r.motorista_id]) map[r.motorista_id] = { count: 0, revenue: 0, ratings: [] };
      map[r.motorista_id].count++;
      if (r.status === 'aprovada' || r.status === 'em_analise') {
        map[r.motorista_id].revenue += r.valor || r.valor_estimado || 0;
      }
      if (r.avaliacao_cliente?.nota) map[r.motorista_id].ratings.push(r.avaliacao_cliente.nota);
    });
    return map;
  }, [rides]);

  const filteredDrivers = useMemo(() => {
    return allDrivers.filter(d => {
      const matchStatus =
        statusFilterLocal === 'all' ||
        (statusFilterLocal === 'ativo' && d.status === 'ativo' && d.ativo) ||
        (statusFilterLocal === 'inativo' && (d.status !== 'ativo' || !d.ativo)) ||
        (statusFilterLocal === 'banido' && d.status === 'banido');
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const matchSearch = !searchTerm ||
        norm(d.nome || '').includes(norm(searchTerm)) ||
        d.telefone?.includes(searchTerm) ||
        norm(d.veiculo_placa || '').includes(norm(searchTerm));
      return matchStatus && matchSearch;
    });
  }, [allDrivers, statusFilterLocal, searchTerm]);

  // Users NOT yet motoristas (for promote dialog)
  const nonDriverUsers = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return users
      .filter(u => u.tipo !== 'motorista' && !u.roles?.includes('motorista'))
      .filter(u => !promoteSearch ||
        norm(u.nome || '').includes(norm(promoteSearch)) ||
        u.telefone?.includes(promoteSearch)
      );
  }, [users, promoteSearch]);

  const summaryStats = useMemo(() => {
    const ativos = allDrivers.filter(d => d.status === 'ativo' && d.ativo).length;
    const inativos = allDrivers.filter(d => d.status !== 'ativo' || !d.ativo).length;
    const banidos = allDrivers.filter(d => d.status === 'banido').length;
    const semVeiculo = allDrivers.filter(d => !d.veiculo_marca && !d.veiculo_placa).length;
    return { total: allDrivers.length, ativos, inativos, banidos, semVeiculo };
  }, [allDrivers]);

  const openEditDialog = (driver: UserRecord) => {
    setSelectedDriver(driver);
    setEditForm({
      nome: driver.nome || '',
      telefone: driver.telefone || '',
      status: driver.status,
      veiculo_marca: driver.veiculo_marca || '',
      veiculo_modelo: driver.veiculo_modelo || '',
      veiculo_cor: driver.veiculo_cor || '',
      veiculo_placa: driver.veiculo_placa || '',
    });
    setShowEditDialog(true);
  };

  const handleSave = () => {
    if (!selectedDriver) return;
    const updates: Record<string, unknown> = {
      nome: editForm.nome.trim(),
      telefone: editForm.telefone.trim(),
      status: editForm.status,
      ativo: editForm.status === 'ativo',
      veiculo_marca: editForm.veiculo_marca.trim() || null,
      veiculo_modelo: editForm.veiculo_modelo.trim() || null,
      veiculo_cor: editForm.veiculo_cor.trim() || null,
      veiculo_placa: editForm.veiculo_placa.trim().toUpperCase() || null,
    };
    updateMutation.mutate({ userId: selectedDriver.id, updates });
  };

  const availableModels = VEHICLE_MODELS[editForm.veiculo_marca] || [];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Total', value: summaryStats.total, icon: Car, color: 'text-accent' },
          { label: 'Ativos', value: summaryStats.ativos, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Inativos', value: summaryStats.inativos, icon: XCircle, color: 'text-gray-400' },
          { label: 'Banidos', value: summaryStats.banidos, icon: Ban, color: 'text-red-400' },
          { label: 'Sem Veículo', value: summaryStats.semVeiculo, icon: Activity, color: 'text-yellow-400' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-3 text-center">
              <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
              <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters + Promote button ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, telefone ou placa..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilterLocal} onValueChange={setStatusFilterLocal}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="banido">Banidos</SelectItem>
          </SelectContent>
        </Select>
        <Button className="gap-1.5 shrink-0" onClick={() => setShowPromoteDialog(true)}>
          <UserPlus className="w-4 h-4" /> Novo Motorista
        </Button>
      </div>

      {/* ── Driver List ── */}
      {!filteredDrivers.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum motorista encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDrivers.map((driver, i) => {
            const ds = driverStats[driver.id] || { count: 0, revenue: 0, ratings: [] };
            const avgRating = ds.ratings.length > 0
              ? (ds.ratings.reduce((a, b) => a + b, 0) / ds.ratings.length)
              : null;
            const hasVehicle = driver.veiculo_marca || driver.veiculo_placa;

            return (
              <motion.div key={driver.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className={
                  driver.status === 'banido' ? 'border-red-500/30 bg-red-500/5' :
                  !driver.ativo ? 'border-yellow-500/30 bg-yellow-500/5' : ''
                }>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                          <Car className="w-5 h-5 text-accent" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Name + phone */}
                          <p className="font-medium truncate">{driver.nome || 'Sem nome'}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {driver.telefone}
                          </div>

                          {/* Vehicle info */}
                          {hasVehicle ? (
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                              <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
                                🚗 {driver.veiculo_marca} {driver.veiculo_modelo}
                              </Badge>
                              {driver.veiculo_cor && (
                                <Badge variant="outline" className="text-[10px] px-1.5">
                                  🎨 {driver.veiculo_cor}
                                </Badge>
                              )}
                              {driver.veiculo_placa && (
                                <Badge variant="outline" className="text-[10px] px-1.5 font-mono">
                                  {driver.veiculo_placa}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 mt-1.5 text-yellow-400 border-yellow-500/30">
                              ⚠️ Veículo não cadastrado
                            </Badge>
                          )}

                          {/* Stats row */}
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {ds.count} corrida{ds.count !== 1 ? 's' : ''}
                            </Badge>
                            {ds.revenue > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 text-green-400 border-green-500/30">
                                R$ {ds.revenue.toFixed(0)}
                              </Badge>
                            )}
                            {avgRating != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 text-yellow-400 border-yellow-500/30 gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-yellow-400" /> {avgRating.toFixed(1)} ({ds.ratings.length})
                              </Badge>
                            )}
                            <Badge
                              variant={driver.status === 'ativo' && driver.ativo ? 'outline' : 'destructive'}
                              className="text-[10px] px-1.5"
                            >
                              {driver.status === 'banido' ? '🚫 Banido' : driver.ativo ? '✅ Ativo' : '⏸️ Inativo'}
                            </Badge>
                          </div>

                          <p className="text-[10px] text-muted-foreground mt-1">
                            Desde: {new Date(driver.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openEditDialog(driver)}>
                          <Pencil className="w-3 h-3" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant={driver.status === 'ativo' && driver.ativo ? 'destructive' : 'default'}
                          className="text-xs gap-1"
                          onClick={() =>
                            updateMutation.mutate({
                              userId: driver.id,
                              updates: {
                                status: driver.status === 'ativo' ? 'banido' : 'ativo',
                                ativo: driver.status !== 'ativo',
                              },
                            })
                          }
                        >
                          {driver.status === 'ativo' && driver.ativo
                            ? <><Ban className="w-3 h-3" /> Desativar</>
                            : <><CheckCircle className="w-3 h-3" /> Ativar</>}
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => {
                            const roles = driver.roles && driver.roles.length > 0 ? driver.roles : [driver.tipo];
                            demoteMutation.mutate({ userId: driver.id, currentRoles: roles });
                          }}
                        >
                          <XCircle className="w-3 h-3" /> Remover Motorista
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

      {/* ═══════════════════ PROMOTE DIALOG ═══════════════════ */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent" />
              Promover Usuário a Motorista
            </DialogTitle>
            <DialogDescription>
              Selecione um usuário existente para torná-lo motorista.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={promoteSearch}
              onChange={e => setPromoteSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="pl-9"
            />
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {nonDriverUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {promoteSearch ? 'Nenhum usuário encontrado' : 'Todos os usuários já são motoristas'}
              </p>
            ) : (
              nonDriverUsers.slice(0, 20).map(u => (
                <div key={u.id} className="flex items-center justify-between gap-3 bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      u.tipo === 'admin' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                    }`}>
                      {u.tipo === 'admin' ? <Shield className="w-4 h-4 text-purple-400" /> : <User className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.nome || 'Sem nome'}</p>
                      <p className="text-[10px] text-muted-foreground">{u.telefone}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs gap-1 shrink-0"
                    disabled={promoteMutation.isPending}
                    onClick={() => {
                      const roles = u.roles && u.roles.length > 0 ? u.roles : [u.tipo];
                      promoteMutation.mutate({ userId: u.id, currentRoles: roles });
                    }}
                  >
                    <Car className="w-3 h-3" /> Tornar Motorista
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ EDIT DRIVER DIALOG ═══════════════════ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" />
              Editar Motorista
            </DialogTitle>
            <DialogDescription>
              Atualize as informações e dados do veículo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={editForm.nome} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={editForm.telefone} onChange={e => setEditForm(p => ({ ...p, telefone: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">✅ Ativo</SelectItem>
                  <SelectItem value="banido">🚫 Banido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle section */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-accent" /> Dados do Veículo
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Marca</Label>
                  <Select
                    value={editForm.veiculo_marca}
                    onValueChange={v => setEditForm(p => ({ ...p, veiculo_marca: v, veiculo_modelo: '' }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Modelo</Label>
                  <Select
                    value={editForm.veiculo_modelo}
                    onValueChange={v => setEditForm(p => ({ ...p, veiculo_modelo: v }))}
                    disabled={!editForm.veiculo_marca}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Cor</Label>
                  <Select
                    value={editForm.veiculo_cor}
                    onValueChange={v => setEditForm(p => ({ ...p, veiculo_cor: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Placa</Label>
                  <Input
                    value={editForm.veiculo_placa}
                    onChange={e => setEditForm(p => ({ ...p, veiculo_placa: e.target.value.toUpperCase() }))}
                    placeholder="ABC1D23"
                    maxLength={7}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMotoristas;
