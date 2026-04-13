import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  FileText, ChevronDown, ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  observacao_motorista: string | null;
  canal_origem: string;
  observacoes: string | null;
  confianca_ia: number | null;
  created_at: string;
  concluida_at: string | null;
  cliente?: { nome: string; telefone: string; tipo: string } | null;
  motorista?: { nome: string; telefone: string } | null;
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
};

const AdminDashboard: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRide, setSelectedRide] = useState<Solicitacao | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<string>('');
  const [approvalObs, setApprovalObs] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [rideAprovacoes, setRideAprovacoes] = useState<Aprovacao[]>([]);

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

          return { ...ride, cliente, motorista } as Solicitacao;
        })
      );

      return enriched;
    },
  });

  // ── Fetch all users ──
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Approval mutation ──
  const approvalMutation = useMutation({
    mutationFn: async ({ rideId, statusAdmin, observacao }: { rideId: string; statusAdmin: string; observacao: string }) => {
      // Insert approval record
      const { error: apError } = await supabase.from('aprovacoes').insert({
        solicitacao_id: rideId,
        admin_id: adminUser!.id,
        status_admin: statusAdmin,
        observacao,
      });
      if (apError) throw apError;

      // Update ride status
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

  // ── User mutation ──
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuário atualizado!' });
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
    // Load approval history
    const { data } = await supabase
      .from('aprovacoes')
      .select('*')
      .eq('solicitacao_id', ride.id)
      .order('created_at', { ascending: false });
    setRideAprovacoes(data || []);
    setShowDetailDialog(true);
  };

  const handleApproval = () => {
    if (!selectedRide || !approvalObs.trim()) {
      toast({ title: 'Observação obrigatória', description: 'Adicione uma observação para registrar a ação.', variant: 'destructive' });
      return;
    }
    approvalMutation.mutate({
      rideId: selectedRide.id,
      statusAdmin: approvalAction,
      observacao: approvalObs.trim(),
    });
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
    ].some(f => f?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchSearch;
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
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Controle completo de solicitações, motoristas e clientes</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: 'text-white' },
            { label: 'Novas', value: stats.novas, icon: AlertTriangle, color: 'text-purple-400' },
            { label: 'Ag. Motorista', value: stats.aguardando, icon: Clock, color: 'text-yellow-400' },
            { label: 'Em Análise', value: stats.emAnalise, icon: Eye, color: 'text-orange-400' },
            { label: 'Aprovadas', value: stats.aprovadas, icon: CheckCircle, color: 'text-green-400' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="py-3 text-center">
                <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Channel stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.whatsapp}</p>
                <p className="text-[10px] text-muted-foreground">Via WhatsApp</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.app}</p>
                <p className="text-[10px] text-muted-foreground">Via App</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.motoristas}</p>
                <p className="text-[10px] text-muted-foreground">Motoristas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.clientes}</p>
                <p className="text-[10px] text-muted-foreground">Clientes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="solicitacoes">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="solicitacoes" className="flex-1 gap-2">
              <Car className="w-4 h-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex-1 gap-2">
              <Users className="w-4 h-4" /> Usuários
            </TabsTrigger>
          </TabsList>

          {/* ═══ SOLICITAÇÕES TAB ═══ */}
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
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="aguardando_motorista">Aguardando Motorista</SelectItem>
                  <SelectItem value="aceita">Aceita</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="nao_realizada">Não Realizada</SelectItem>
                  <SelectItem value="recusada">Recusada</SelectItem>
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
                  const canValidate = ['aceita', 'em_analise', 'aguardando_motorista'].includes(ride.status);

                  return (
                    <motion.div key={ride.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <Card className={needsAction ? 'border-orange-500/30 bg-orange-500/5' : ''}>
                        <CardContent className="py-4">
                          <div className="flex flex-col gap-3">
                            {/* Top row: status, channel, date */}
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
                            {(ride.valor != null || ride.observacao_motorista) && (
                              <div className="flex items-center gap-4 text-xs">
                                {ride.valor != null && (
                                  <span className="flex items-center gap-1 text-green-400 font-semibold">
                                    <DollarSign className="w-3 h-3" />
                                    R$ {Number(ride.valor).toFixed(2)}
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

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1"
                                onClick={() => openDetailDialog(ride)}
                              >
                                <Eye className="w-3 h-3" /> Detalhes
                              </Button>

                              {canValidate && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                                    onClick={() => openApprovalDialog(ride, 'aprovada')}
                                  >
                                    <CheckCircle className="w-3 h-3" /> Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                                    onClick={() => openApprovalDialog(ride, 'nao_realizada')}
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Não Realizada
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                                    onClick={() => openApprovalDialog(ride, 'recusada')}
                                  >
                                    <XCircle className="w-3 h-3" /> Recusar
                                  </Button>
                                </>
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

          {/* ═══ USUÁRIOS TAB ═══ */}
          <TabsContent value="usuarios">
            <div className="mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  className="pl-9"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              {users?.filter(u => !searchTerm || u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || u.telefone?.includes(searchTerm)).map((u) => (
                <Card key={u.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          u.tipo === 'motorista' ? 'bg-accent/20' : u.tipo === 'admin' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                        }`}>
                          {u.tipo === 'motorista' ? <Car className="w-5 h-5 text-accent" /> :
                           u.tipo === 'admin' ? <Shield className="w-5 h-5 text-purple-400" /> :
                           <User className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div>
                          <p className="font-medium">{u.nome || 'Sem nome'}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {u.telefone}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              {u.tipo === 'motorista' ? '🚗 Motorista' : u.tipo === 'admin' ? '🛡️ Admin' : '👤 Cliente'}
                            </Badge>
                            <Badge
                              variant={u.status === 'ativo' ? 'outline' : 'destructive'}
                              className="text-[10px] px-1.5"
                            >
                              {u.status === 'ativo' ? '✅ Ativo' : '🚫 Banido'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant={u.status === 'ativo' ? 'destructive' : 'default'}
                          className="text-xs"
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
                          {u.status === 'ativo' ? <><Ban className="w-3 h-3 mr-1" /> Banir</> : <><CheckCircle className="w-3 h-3 mr-1" /> Ativar</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ APPROVAL DIALOG ═══ */}
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
                  Observação (obrigatória)
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
              disabled={approvalMutation.isPending || !approvalObs.trim()}
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

      {/* ═══ DETAIL DIALOG ═══ */}
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

              {/* Value */}
              {selectedRide.valor != null && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">VALOR</p>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-400">R$ {Number(selectedRide.valor).toFixed(2)}</p>
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminDashboard;
