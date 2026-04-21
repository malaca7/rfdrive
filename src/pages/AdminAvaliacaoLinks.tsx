import React, { useState, useMemo, useCallback } from 'react';
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
  Phone, X, ChevronLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';
import { logActivityEvent, logAuditEvent, logSystemEvent } from '@/lib/logging';

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
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ativa: { label: 'Ativa', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Clock className="w-3 h-3" /> },
  respondida: { label: 'Respondida', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Check className="w-3 h-3" /> },
  expirada: { label: 'Expirada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
};

function getEvalUrl(token: string): string {
  return `https://malaca7.github.io/rfdrive/#/avaliar/${token}`;
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

function buildWhatsAppUrl(phone: string, clienteNome: string, motoristaNome: string, evalUrl: string): string {
  const num = phone.replace(/\D/g, '');
  const fullNum = num.startsWith('55') ? num : `55${num}`;
  const msg = `Olá${clienteNome ? ` ${clienteNome}` : ''}! 😊\n\nObrigado por utilizar nosso serviço de transporte com o motorista *${motoristaNome}*.\n\nGostaríamos muito de saber como foi sua experiência! Por favor, avalie a viagem clicando no link abaixo:\n\n👉 ${evalUrl}\n\nSua avaliação é muito importante para nós! ⭐`;
  return `https://wa.me/${encodeURIComponent(fullNum)}?text=${encodeURIComponent(msg)}`;
}

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);

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
    cliente_nome: '',
    cliente_telefone: '',
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
      const insertData: any = {
        motorista_id: form.motorista_id,
        admin_id: user?.id || null,
        permite_comentario: form.permite_comentario,
        expira_em: expiresAt,
      };
      if (form.cliente_nome.trim()) insertData.cliente_nome = form.cliente_nome.trim();
      if (form.cliente_telefone.trim()) insertData.cliente_telefone = form.cliente_telefone.trim();
      const { data, error } = await supabase
        .from('evaluation_links')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      await logActivityEvent({
        userId: user?.id,
        action: 'criar_link_avaliacao',
        entity: 'evaluation_links',
        entityId: data.id,
        after: {
          motorista_id: form.motorista_id,
          permite_comentario: form.permite_comentario,
          expira_em: expiresAt,
        },
        source: 'AdminAvaliacaoLinks.createMutation',
      });

      await logAuditEvent({
        userId: user?.id,
        action: 'enviar_avaliacao_link',
        entity: 'evaluation_links',
        entityId: data.id,
        after: {
          motorista_id: form.motorista_id,
          cliente_nome: form.cliente_nome || null,
          cliente_telefone: form.cliente_telefone || null,
        },
        source: 'AdminAvaliacaoLinks.createMutation',
      });

      return data as EvalLink;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['eval-links'] });
      toast({ title: 'Avaliação gerada!', description: 'Copie e envie ao cliente.' });
      setShowCreateDialog(false);
      setCopiedToken(data.token);
      copyToClipboard(getEvalUrl(data.token));
      setCreateForm({ motorista_id: '', permite_comentario: true, expira_minutos: 60, cliente_nome: '', cliente_telefone: '' });
    },
    onError: async (e: any) => {
      await logSystemEvent({
        userId: user?.id,
        action: 'criar_link_avaliacao_error',
        entity: 'evaluation_links',
        details: { message: e?.message || 'Erro desconhecido' },
        level: 'error',
        errorMessage: e?.message || 'Erro desconhecido',
        stackTrace: e?.stack || null,
        source: 'AdminAvaliacaoLinks.createMutation',
      });
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    },
  });

  // Delete link
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const target = links?.find(l => l.id === id) || null;
      const { error } = await supabase.from('evaluation_links').delete().eq('id', id);
      if (error) throw error;

      await logActivityEvent({
        userId: user?.id,
        action: 'excluir_link_avaliacao',
        entity: 'evaluation_links',
        entityId: id,
        before: target
          ? {
            motorista_id: target.motorista_id,
            status: target.status,
            nota: target.nota,
          }
          : null,
        source: 'AdminAvaliacaoLinks.deleteMutation',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eval-links'] });
      toast({ title: 'Avaliação excluída' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Link copiado!' });
    } catch {
      // Fallback for insecure contexts / mobile webview
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast({ title: 'Link copiado!' });
      } catch {
        toast({ title: 'Erro ao copiar', description: 'Copie manualmente o link.', variant: 'destructive' });
      }
    }
  }, [toast]);

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
        l.token.includes(searchTerm) ||
        l.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
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

  // ═══════ DETAIL VIEW (full-screen vertical, app-like) ═══════
  if (detailLink) {
    const motorista = motoristaMap[detailLink.motorista_id];
    const statusInfo = STATUS_MAP[detailLink.status] || STATUS_MAP.ativa;
    const isExpiredNow = new Date(detailLink.expira_em).getTime() < Date.now() && detailLink.status === 'ativa';
    const effectiveStatus = isExpiredNow ? STATUS_MAP.expirada : statusInfo;
    const url = getEvalUrl(detailLink.token);
    const canWhatsApp = !!(detailLink.cliente_nome && detailLink.cliente_telefone);

    return (
      <AdminLayout>
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <button
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/40 transition-colors text-muted-foreground/60 hover:text-foreground shrink-0"
              onClick={() => setDetailLink(null)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold tracking-tight">Detalhes</h1>
              <p className="text-[10px] text-muted-foreground/40 font-mono">{detailLink.token.slice(0, 12)}...</p>
            </div>
            <Badge className={`text-[8px] px-2 py-0.5 shrink-0 ${effectiveStatus.color}`}>
              {effectiveStatus.icon}
              <span className="ml-1">{isExpiredNow ? 'Expirada' : effectiveStatus.label}</span>
            </Badge>
          </div>

          {/* Motorista Card */}
          <Card>
            <CardContent className="py-3 px-3.5">
              <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2">Motorista</p>
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-xl shrink-0 overflow-hidden bg-muted/40 ring-1 ring-border/30">
                  {motorista?.avatar_url ? (
                    <img src={motorista.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <img src={getAnimalAvatarUrl(motorista?.id || 'unknown')} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[14px] tracking-tight">{motorista?.nome || 'Removido'}</p>
                  <p className="text-[11px] text-muted-foreground/50">{motorista?.telefone || ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cliente info (se disponível) */}
          {(detailLink.cliente_nome || detailLink.cliente_telefone) && (
            <Card>
              <CardContent className="py-3 px-3.5">
                <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2">Cliente</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center shrink-0 ring-1 ring-border/20">
                    <User className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {detailLink.cliente_nome && <p className="text-[13px] font-medium tracking-tight">{detailLink.cliente_nome}</p>}
                    {detailLink.cliente_telefone && <p className="text-[11px] text-muted-foreground/50">{detailLink.cliente_telefone}</p>}
                  </div>
                  {canWhatsApp && (
                    <a
                      href={buildWhatsAppUrl(detailLink.cliente_telefone!, detailLink.cliente_nome!, motorista?.nome || 'nosso motorista', url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <button className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors">
                        <WhatsAppIcon className="w-3 h-3" />
                        WhatsApp
                      </button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Criado em', value: new Date(detailLink.created_at).toLocaleString('pt-BR') },
              { label: 'Expira em', value: new Date(detailLink.expira_em).toLocaleString('pt-BR') },
              { label: 'Comentário', value: detailLink.permite_comentario ? 'Habilitado' : 'Desabilitado' },
              { label: 'Gerado por', value: detailLink.admin_id && adminMap[detailLink.admin_id] ? adminMap[detailLink.admin_id].nome : 'Sistema' },
            ].map(item => (
              <Card key={item.label} className="card-hover">
                <CardContent className="py-2.5 px-3">
                  <p className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-wider mb-0.5">{item.label}</p>
                  <p className="font-medium text-[11px] tracking-tight truncate">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rating se respondida */}
          {detailLink.status === 'respondida' && detailLink.nota && (
            <Card className="border-amber-500/10">
              <CardContent className="py-3 px-3.5 space-y-2.5">
                <p className="text-[9px] text-amber-400/80 font-medium uppercase tracking-wider">Resposta do Cliente</p>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-px">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        className={`w-5 h-5 ${s <= detailLink.nota! ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]' : 'text-muted-foreground/15'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xl font-bold text-amber-400 tracking-tight">{detailLink.nota}</span>
                </div>
                {detailLink.respondida_em && (
                  <p className="text-[10px] text-muted-foreground/40">
                    {new Date(detailLink.respondida_em).toLocaleString('pt-BR')}
                  </p>
                )}
                {detailLink.comentario && (
                  <div className="bg-muted/20 rounded-xl p-2.5 border border-border/20">
                    <p className="text-[12px] italic text-foreground/70">"{detailLink.comentario}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {(detailLink.status === 'ativa' && !isExpiredNow) && (
              <>
                <Card>
                  <CardContent className="py-3 px-3.5">
                    <p className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-wider mb-1.5">Link da avaliação</p>
                    <code className="text-[9px] text-muted-foreground/40 bg-muted/20 rounded-lg px-2.5 py-1.5 block truncate mb-2.5 border border-border/20">
                      {url}
                    </code>
                    <div className="flex gap-1.5">
                      <button
                        className="flex-1 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                        onClick={async () => {
                          await copyToClipboard(url);
                          setCopiedToken(detailLink.token);
                          setTimeout(() => setCopiedToken(null), 2000);
                        }}
                      >
                        {copiedToken === detailLink.token ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedToken === detailLink.token ? 'Copiado!' : 'Copiar'}
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <button className="w-full h-8 rounded-lg border border-border/30 hover:bg-muted/30 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3 h-3" /> Abrir
                        </button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
                {canWhatsApp && (
                  <a
                    href={buildWhatsAppUrl(detailLink.cliente_telefone!, detailLink.cliente_nome!, motorista?.nome || 'nosso motorista', url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <button className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-medium flex items-center justify-center gap-2 transition-colors">
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      Compartilhar Avaliações
                    </button>
                  </a>
                )}
              </>
            )}

            <button
              className="w-full h-8 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
              onClick={() => { deleteMutation.mutate(detailLink.id); setDetailLink(null); }}
            >
              <Trash2 className="w-3 h-3" /> Excluir
            </button>
          </div>
        </motion.div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            Avaliações
          </h1>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 ml-9">
            Links de avaliação para clientes
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-medium shadow-md shadow-indigo-500/20 h-8 text-[12px] rounded-lg"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Nova Avaliação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Total', value: stats.total, icon: Star, color: 'text-muted-foreground/70', bg: 'bg-muted/30' },
          { label: 'Ativas', value: stats.ativas, icon: Clock, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
          { label: 'Respondidas', value: stats.respondidas, icon: Check, color: 'text-blue-400', bg: 'bg-blue-500/8' },
          { label: 'Expiradas', value: stats.expiradas, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/8' },
        ].map(s => (
          <Card key={s.label} className="card-hover">
            <CardContent className="py-2.5 px-3 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-3 h-3 ${s.color}`} />
              </div>
              <div>
                <p className={`text-base font-bold leading-none tracking-tight ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 h-8 text-[12px] bg-muted/20 border-border/20 rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-8 text-[12px] bg-muted/20 border-border/20 rounded-lg">
            <Filter className="w-3 h-3 mr-1.5 text-muted-foreground/40" />
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
          <CardContent className="py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground/60 mb-4">Nenhuma avaliação encontrada</p>
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white h-8 text-[12px] rounded-lg"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-3.5 h-3.5" /> Nova Avaliação
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
              const canWhatsApp = !!(link.cliente_nome && link.cliente_telefone);

              return (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ delay: i * 0.015, duration: 0.25 }}
                >
                  <Card className={`card-hover ${link.status === 'expirada' || isExpiredNow ? 'opacity-40' : ''}`}>
                    <CardContent className="py-3 px-3.5">
                      <div className="flex items-start gap-2.5">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden bg-muted/40 ring-1 ring-border/30">
                          {motorista?.avatar_url ? (
                            <img src={motorista.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <img src={getAnimalAvatarUrl(motorista?.id || 'unknown')} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-[13px] tracking-tight truncate">{motorista?.nome || 'Removido'}</p>
                            <Badge className={`text-[8px] px-1.5 py-0 ${effectiveStatus.color}`}>
                              {effectiveStatus.icon}
                              <span className="ml-0.5">{isExpiredNow ? 'Expirada' : effectiveStatus.label}</span>
                            </Badge>
                            {link.permite_comentario && (
                              <Badge className="text-[8px] px-1.5 py-0 bg-muted/20 border-border/30 text-muted-foreground/60">
                                <MessageSquare className="w-2 h-2 mr-0.5" /> Com.
                              </Badge>
                            )}
                          </div>

                          {link.cliente_nome && (
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5 flex items-center gap-1">
                              <User className="w-2 h-2" /> {link.cliente_nome}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/40">
                            {link.admin_id && adminMap[link.admin_id] && (
                              <><span>{adminMap[link.admin_id].nome}</span><span>·</span></>
                            )}
                            <span>{timeAgo(link.created_at)}</span>
                            <span>·</span>
                            {link.status === 'ativa' && !isExpiredNow ? (
                              <span className="text-emerald-400/70">{timeLeft(link.expira_em)}</span>
                            ) : link.status === 'respondida' ? (
                              <span className="text-blue-400/70">{timeAgo(link.respondida_em!)}</span>
                            ) : (
                              <span className="text-red-400/60">Expirada</span>
                            )}
                          </div>

                          {/* Rating */}
                          {link.status === 'respondida' && link.nota && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="flex items-center gap-px">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star
                                    key={s}
                                    className={`w-3 h-3 ${s <= link.nota! ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/15'}`}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] font-semibold text-amber-400">{link.nota}</span>
                              {link.comentario && (
                                <span className="text-[9px] text-muted-foreground/40 truncate max-w-[160px]">
                                  "{link.comentario}"
                                </span>
                              )}
                            </div>
                          )}

                          {/* Link actions (inline) */}
                          {link.status === 'ativa' && !isExpiredNow && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <code className="text-[8px] text-muted-foreground/30 bg-muted/20 rounded px-1.5 py-0.5 truncate max-w-[180px]">
                                {url}
                              </code>
                              <button
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/40 transition-colors text-muted-foreground/40 hover:text-foreground"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await copyToClipboard(url);
                                  setCopiedToken(link.token);
                                  setTimeout(() => setCopiedToken(null), 2000);
                                }}
                              >
                                {copiedToken === link.token ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/40 transition-colors text-muted-foreground/40 hover:text-foreground">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </a>
                              {canWhatsApp && (
                                <a
                                  href={buildWhatsAppUrl(link.cliente_telefone!, link.cliente_nome!, motorista?.nome || 'nosso motorista', url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-emerald-500/20 transition-colors text-emerald-500/60 hover:text-emerald-400">
                                    <WhatsAppIcon className="w-3 h-3" />
                                  </button>
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Side actions */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground/40 hover:text-foreground"
                            onClick={() => setDetailLink(link)}
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground/40 hover:text-red-400"
                            onClick={() => deleteMutation.mutate(link.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
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
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              Nova Avaliação
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Configure o link de avaliação para o cliente.
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

            {/* Cliente Nome (opcional) */}
            <div>
              <Label className="text-xs">Nome do Cliente <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                value={createForm.cliente_nome}
                onChange={(e) => setCreateForm(f => ({ ...f, cliente_nome: e.target.value }))}
                placeholder="Ex: João Silva"
              />
            </div>

            {/* Cliente WhatsApp (opcional) */}
            <div>
              <Label className="text-xs">WhatsApp do Cliente <span className="text-muted-foreground">(opcional)</span></Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={createForm.cliente_telefone}
                  onChange={(e) => setCreateForm(f => ({ ...f, cliente_telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="pl-9"
                />
              </div>
              {createForm.cliente_nome && createForm.cliente_telefone && (
                <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Botão WhatsApp será habilitado no card
                </p>
              )}
            </div>

            {/* Permite comentário */}
            <div>
              <Label className="text-xs">Comentário do Cliente</Label>
              <div
                className={`flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer transition-colors ${createForm.permite_comentario ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'}`}
                onClick={() => setCreateForm(f => ({ ...f, permite_comentario: !f.permite_comentario }))}
              >
                <div className={`w-9 h-5 rounded-full transition-colors relative ${createForm.permite_comentario ? 'bg-green-500' : 'bg-border'}`}>
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
                <div className="bg-muted/20 rounded-xl p-3 space-y-1.5 border border-border/20">
                  <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">Preview</p>
                  <p className="text-[12px]">
                    <span className="text-muted-foreground/60">Motorista:</span>{' '}
                    <span className="font-medium">{motoristaMap[createForm.motorista_id]?.nome}</span>
                  </p>
                  {createForm.cliente_nome && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Cliente:</span>{' '}
                      <span className="font-medium">{createForm.cliente_nome}</span>
                    </p>
                  )}
                  {createForm.cliente_telefone && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">WhatsApp:</span>{' '}
                      <span className="font-medium">{createForm.cliente_telefone}</span>
                    </p>
                  )}
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
            <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(false)} className="text-[12px]">Cancelar</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.motorista_id}
              className="gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white h-8 text-[12px] rounded-lg"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Star className="w-3.5 h-3.5" /> Gerar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAvaliacaoLinks;
