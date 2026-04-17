import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Search, Plus, Loader2, Link2, Copy, Check, Clock, ExternalLink,
  MessageSquare, Filter, Trash2, User, Car, TrendingUp, AlertCircle, Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type UserRecord = {
  id: string; nome: string; telefone: string; tipo: string; status: string;
  roles?: string[] | null; avatar_url?: string | null;
};

type EvalLink = {
  id: string;
  motorista_id: string;
  admin_id: string | null;
  permite_comentario: boolean;
  expira_em: string;
  token: string;
  status: string;
  nota: number | null;
  comentario: string | null;
  respondida_em: string | null;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ativa: { label: 'Ativa', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Clock className="w-3 h-3" /> },
  respondida: { label: 'Respondida', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Check className="w-3 h-3" /> },
  expirada: { label: 'Expirada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
};

function getEvalUrl(token: string): string {
  const origin = window.location.origin;
  const basePath = import.meta.env.BASE_URL || '/';
  return `${origin}${basePath}#/avaliar/${token}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function timeLeft(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const AdminAvaliacaoLinks: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [detailLink, setDetailLink] = useState<EvalLink | null>(null);
  const [createForm, setCreateForm] = useState({
    motorista_id: '',
    permite_comentario: true,
    expira_minutos: 60,
  });

  // Fetch motoristas
  const { data: motoristas } = useQuery({
    queryKey: ['eval-motoristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, status, roles, avatar_url')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return (data || []).filter((u: any) => u.tipo === 'motorista' || u.tipo === 'admin' || u.roles?.includes('motorista'));
    },
  });

  // Fetch admins para exibir quem gerou o link
  const { data: admins } = useQuery({
    queryKey: ['eval-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, status, roles, avatar_url')
        .eq('tipo', 'admin')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch eval links
  const { data: links, isLoading } = useQuery({
    queryKey: ['eval-links'],
    queryFn: async () => {
      // Mark expired links first
      await supabase.rpc('mark_expired_eval_links');
      const { data, error } = await supabase
        .from('evaluation_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EvalLink[];
    },
    refetchInterval: 15000,
  });

  // Create link
  const createMutation = useMutation({
    mutationFn: async (form: typeof createForm) => {
      const expiresAt = new Date(Date.now() + form.expira_minutos * 60000).toISOString();
      const { data, error } = await supabase
        .from('evaluation_links')
        .insert({
          motorista_id: form.motorista_id,
          admin_id: user?.id || null,
          permite_comentario: form.permite_comentario,
          expira_em: expiresAt,
        })
        .select()
        .single();
      if (error) throw error;
      return data as EvalLink;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['eval-links'] });
      toast({ title: 'Link criado!', description: 'Copie e envie ao cliente.' });
      setShowCreateDialog(false);
      setCopiedToken(data.token);
      copyToClipboard(getEvalUrl(data.token));
      setCreateForm({ motorista_id: '', permite_comentario: true, expira_minutos: 60 });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  // Delete link
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('evaluation_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eval-links'] });
      toast({ title: 'Link excluído' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Link copiado!' });
    });
  };

  // Motorista name lookup
  const motoristaMap = useMemo(() => {
    const map: Record<string, UserRecord> = {};
    motoristas?.forEach(m => { map[m.id] = m; });
    return map;
  }, [motoristas]);

  // Admin name lookup
  const adminMap = useMemo(() => {
    const map: Record<string, UserRecord> = {};
    admins?.forEach((a: any) => { map[a.id] = a; });
    return map;
  }, [admins]);

  // Filter links
  const filteredLinks = useMemo(() => {
    return links?.filter(l => {
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const motorista = motoristaMap[l.motorista_id];
      const matchSearch = !searchTerm ||
        motorista?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.token.includes(searchTerm);
      return matchStatus && matchSearch;
    });
  }, [links, statusFilter, searchTerm, motoristaMap]);

  // Stats
  const stats = useMemo(() => ({
    total: links?.length || 0,
    ativas: links?.filter(l => l.status === 'ativa').length || 0,
    respondidas: links?.filter(l => l.status === 'respondida').length || 0,
    expiradas: links?.filter(l => l.status === 'expirada').length || 0,
    mediaNotas: (() => {
      const respondidas = links?.filter(l => l.nota) || [];
      if (!respondidas.length) return 0;
      return respondidas.reduce((s, l) => s + (l.nota || 0), 0) / respondidas.length;
    })(),
  }), [links]);

  const EXPIRY_OPTIONS = [
    { label: '15 minutos', value: 15 },
    { label: '30 minutos', value: 30 },
    { label: '1 hora', value: 60 },
    { label: '2 horas', value: 120 },
    { label: '6 horas', value: 360 },
    { label: '12 horas', value: 720 },
    { label: '24 horas', value: 1440 },
    { label: '48 horas', value: 2880 },
    { label: '7 dias', value: 10080 },
  ];

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent" /> Links de Avaliação
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gere links únicos para clientes avaliarem motoristas
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" /> Novo Link
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <Link2 className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-green-400">{stats.ativas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-blue-400">{stats.respondidas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Respondidas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-red-400">{stats.expiradas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Expiradas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por motorista..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="respondida">Respondidas</SelectItem>
            <SelectItem value="expirada">Expiradas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Links list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !filteredLinks?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum link de avaliação encontrado</p>
            <Button variant="outline" className="mt-4 gap-1" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4" /> Criar primeiro link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredLinks.map((link, i) => {
              const motorista = motoristaMap[link.motorista_id];
              const statusInfo = STATUS_MAP[link.status] || STATUS_MAP.ativa;
              const url = getEvalUrl(link.token);
              const isExpiredNow = new Date(link.expira_em).getTime() < Date.now() && link.status === 'ativa';
              const effectiveStatus = isExpiredNow ? STATUS_MAP.expirada : statusInfo;

              return (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Card className={`transition-colors hover:border-white/10 ${link.status === 'expirada' || isExpiredNow ? 'opacity-50' : ''}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-accent/20 flex items-center justify-center">
                          {motorista?.avatar_url ? (
                            <img src={motorista.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Car className="w-5 h-5 text-accent" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{motorista?.nome || 'Motorista removido'}</p>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${effectiveStatus.color}`}>
                              {effectiveStatus.icon}
                              <span className="ml-1">{isExpiredNow ? 'Expirada' : effectiveStatus.label}</span>
                            </Badge>
                            {link.permite_comentario && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white/5 border-white/10">
                                <MessageSquare className="w-2.5 h-2.5 mr-0.5" /> Comentário
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {link.admin_id && adminMap[link.admin_id] && (
                              <><span>Por {adminMap[link.admin_id].nome}</span><span>•</span></>
                            )}
                            <span>Criado {timeAgo(link.created_at)}</span>
                            <span>•</span>
                            {link.status === 'ativa' && !isExpiredNow ? (
                              <span className="text-green-400">Expira em {timeLeft(link.expira_em)}</span>
                            ) : link.status === 'respondida' ? (
                              <span className="text-blue-400">Respondida {timeAgo(link.respondida_em!)}</span>
                            ) : (
                              <span className="text-red-400">Expirada</span>
                            )}
                          </div>

                          {/* Nota se respondida */}
                          {link.status === 'respondida' && link.nota && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star
                                    key={s}
                                    className={`w-3.5 h-3.5 ${s <= link.nota! ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-yellow-400">{link.nota}/5</span>
                              {link.comentario && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                  "{link.comentario}"
                                </span>
                              )}
                            </div>
                          )}

                          {/* Link URL */}
                          {link.status === 'ativa' && !isExpiredNow && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <code className="text-[9px] text-muted-foreground bg-white/5 rounded px-2 py-0.5 truncate max-w-[250px]">
                                {url}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => { copyToClipboard(url); setCopiedToken(link.token); setTimeout(() => setCopiedToken(null), 2000); }}
                              >
                                {copiedToken === link.token ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              </Button>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-accent"
                            onClick={() => setDetailLink(link)}
                            title="Detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            onClick={() => deleteMutation.mutate(link.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ═══════ CREATE DIALOG ═══════ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-accent" />
              Novo Link de Avaliação
            </DialogTitle>
            <DialogDescription>
              Selecione o motorista e configure o link de avaliação para o cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Motorista */}
            <div>
              <Label className="text-xs">Motorista *</Label>
              <Select
                value={createForm.motorista_id}
                onValueChange={(v) => setCreateForm(f => ({ ...f, motorista_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motorista" />
                </SelectTrigger>
                <SelectContent>
                  {motoristas?.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        {m.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permite comentário */}
            <div>
              <Label className="text-xs">Comentário do Cliente</Label>
              <div
                className={`flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer transition-colors ${createForm.permite_comentario ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'}`}
                onClick={() => setCreateForm(f => ({ ...f, permite_comentario: !f.permite_comentario }))}
              >
                <div className={`w-9 h-5 rounded-full transition-colors relative ${createForm.permite_comentario ? 'bg-green-500' : 'bg-white/20'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${createForm.permite_comentario ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-xs">{createForm.permite_comentario ? 'Habilitado' : 'Desabilitado'}</span>
              </div>
            </div>

            {/* Expiração */}
            <div>
              <Label className="text-xs">Tempo de Expiração *</Label>
              <Select
                value={String(createForm.expira_minutos)}
                onValueChange={(v) => setCreateForm(f => ({ ...f, expira_minutos: Number(v) }))}
              >
                <SelectTrigger>
                  <Clock className="w-3.5 h-3.5 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {createForm.motorista_id && (
              <>
                <Separator />
                <div className="bg-white/[0.03] rounded-xl p-3 space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium">PREVIEW</p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Motorista:</span>{' '}
                    <span className="font-medium">{motoristaMap[createForm.motorista_id]?.nome}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Comentário:</span>{' '}
                    <span className="font-medium">{createForm.permite_comentario ? '✅ Habilitado' : '❌ Desabilitado'}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Expira em:</span>{' '}
                    <span className="font-medium">{EXPIRY_OPTIONS.find(o => o.value === createForm.expira_minutos)?.label}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.motorista_id}
              className="gap-1"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Link2 className="w-4 h-4" /> Gerar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ DETAIL DIALOG ═══════ */}
      <Dialog open={!!detailLink} onOpenChange={(open) => { if (!open) setDetailLink(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent" />
              Detalhes da Avaliação
            </DialogTitle>
            <DialogDescription>
              Informações completas do link de avaliação.
            </DialogDescription>
          </DialogHeader>
          {detailLink && (() => {
            const motorista = motoristaMap[detailLink.motorista_id];
            const statusInfo = STATUS_MAP[detailLink.status] || STATUS_MAP.ativa;
            const isExpiredNow = new Date(detailLink.expira_em).getTime() < Date.now() && detailLink.status === 'ativa';
            const effectiveStatus = isExpiredNow ? STATUS_MAP.expirada : statusInfo;
            const url = getEvalUrl(detailLink.token);
            return (
              <div className="space-y-4 py-2">
                {/* Motorista */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-accent/20 flex items-center justify-center">
                    {motorista?.avatar_url ? (
                      <img src={motorista.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-6 h-6 text-accent" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{motorista?.nome || 'Motorista removido'}</p>
                    <p className="text-xs text-muted-foreground">{motorista?.telefone || ''}</p>
                  </div>
                  <Badge variant="outline" className={`ml-auto text-[10px] px-2 py-0.5 ${effectiveStatus.color}`}>
                    {effectiveStatus.icon}
                    <span className="ml-1">{isExpiredNow ? 'Expirada' : effectiveStatus.label}</span>
                  </Badge>
                </div>

                <Separator />

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">CRIADO EM</p>
                    <p className="font-medium text-xs">{new Date(detailLink.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">EXPIRA EM</p>
                    <p className="font-medium text-xs">{new Date(detailLink.expira_em).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">COMENTÁRIO</p>
                    <p className="font-medium text-xs">{detailLink.permite_comentario ? '✅ Habilitado' : '❌ Desabilitado'}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">TOKEN</p>
                    <p className="font-mono font-medium text-[10px] truncate">{detailLink.token}</p>
                  </div>
                </div>

                {/* Rating se respondida */}
                {detailLink.status === 'respondida' && detailLink.nota && (
                  <>
                    <Separator />
                    <div className="bg-yellow-500/[0.05] border border-yellow-500/20 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">RESPOSTA DO CLIENTE</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star
                              key={s}
                              className={`w-5 h-5 ${s <= detailLink.nota! ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`}
                            />
                          ))}
                        </div>
                        <span className="text-lg font-bold text-yellow-400">{detailLink.nota}/5</span>
                      </div>
                      {detailLink.respondida_em && (
                        <p className="text-[10px] text-muted-foreground">
                          Respondida em {new Date(detailLink.respondida_em).toLocaleString('pt-BR')}
                        </p>
                      )}
                      {detailLink.comentario && (
                        <div className="bg-white/[0.03] rounded-lg p-3 mt-2">
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">COMENTÁRIO</p>
                          <p className="text-sm italic text-white/80">"{detailLink.comentario}"</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Link URL */}
                {(detailLink.status === 'ativa' && !isExpiredNow) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium mb-1.5">LINK</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] text-muted-foreground bg-white/5 rounded px-2 py-1 flex-1 truncate">
                          {url}
                        </code>
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => { copyToClipboard(url); setCopiedToken(detailLink.token); setTimeout(() => setCopiedToken(null), 2000); }}>
                          {copiedToken === detailLink.token ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          Copiar
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAvaliacaoLinks;
