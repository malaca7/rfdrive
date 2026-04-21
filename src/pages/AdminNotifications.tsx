import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/AdminLayout';
import {
  Bell, Plus, Send, Info, AlertTriangle, CheckCircle, Users, Loader2,
  Trash2, Search, Clock, ArrowLeft, Sparkles, Megaphone, Eye, EyeOff,
  TrendingUp, UserCheck, Shield, ChevronDown, ChevronUp, X, User, CheckCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Notification = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'alerta' | 'sucesso';
  destinatario: 'todos' | 'motoristas' | 'admins' | 'usuario';
  user_id: string | null;
  created_by: string | null;
  created_at: string;
};

type UserOption = { id: string; nome: string; telefone: string; tipo: string };

const NOTIFICATION_ICONS = [
  '🔔', '📢', '⚠️', '✅', '❌', '🚗', '🚕', '💰', '📍', '🛠️',
  '📱', '🎉', '🏆', '⏰', '📋', '💡', '🔥', '⭐', '🛑', '🔄',
  '👋', '📊', '🗺️', '🔑', '💬', '🤝', '🎯', '💼', '🏅', '📌',
  '🆕', '✨', '❗', '‼️', '🔴', '🟡', '🟢', '💯', '🎊', '📣',
  '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣',
];

// ── Text rendering (safe: HTML-escaped before pattern apply) ──
const renderMessage = (text: string): string => {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
};

const TIPO_CONFIG: Record<string, { label: string; color: string; bgCard: string; icon: React.ReactNode; gradient: string }> = {
  info: {
    label: 'Informação',
    color: 'text-blue-400 border-blue-500/30',
    bgCard: 'bg-blue-500/5 border-blue-500/20',
    icon: <Info className="w-4 h-4" />,
    gradient: 'from-blue-500/20 to-blue-600/5',
  },
  alerta: {
    label: 'Alerta',
    color: 'text-amber-400 border-amber-500/30',
    bgCard: 'bg-amber-500/5 border-amber-500/20',
    icon: <AlertTriangle className="w-4 h-4" />,
    gradient: 'from-amber-500/20 to-amber-600/5',
  },
  sucesso: {
    label: 'Sucesso',
    color: 'text-green-400 border-green-500/30',
    bgCard: 'bg-green-500/5 border-green-500/20',
    icon: <CheckCircle className="w-4 h-4" />,
    gradient: 'from-green-500/20 to-green-600/5',
  },
};

const DEST_CONFIG: Record<string, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  todos: { label: 'Todos', desc: 'Motoristas e Admins', icon: <Users className="w-4 h-4" />, color: 'text-purple-400' },
  motoristas: { label: 'Motoristas', desc: 'Apenas motoristas', icon: <UserCheck className="w-4 h-4" />, color: 'text-blue-400' },
  admins: { label: 'Admins', desc: 'Apenas administradores', icon: <Shield className="w-4 h-4" />, color: 'text-amber-400' },
  usuario: { label: 'Individual', desc: 'Usuário específico', icon: <User className="w-4 h-4" />, color: 'text-cyan-400' },
};

export default function AdminNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<'list' | 'create'>('list');
  const [form, setForm] = useState({ titulo: '', mensagem: '', tipo: 'info', destinatario: 'todos' });
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [icone, setIcone] = useState('🔔');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch all active users for individual target ──
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('users')
        .select('id, nome, telefone, tipo')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as UserOption[];
    },
    enabled: view === 'create',
  });

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(u =>
      u.nome.toLowerCase().includes(q) || u.telefone.includes(q)
    );
  }, [allUsers, userSearch]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    allUsers.forEach(u => map.set(u.id, u.nome));
    return map;
  }, [allUsers]);

  // ── Fetch notifications ──
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Notification[];
    },
  });

  // ── Fetch read receipts for expanded notification ──
  type ReadReceipt = { user_id: string; read_at: string; user_nome: string };
  const { data: readReceipts = [] } = useQuery({
    queryKey: ['notification-reads-admin', expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await (supabase as any)
        .from('notification_reads')
        .select('user_id, read_at')
        .eq('notification_id', expandedId)
        .order('read_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];
      // Fetch user names
      const userIds = data.map((r: any) => r.user_id);
      const { data: users } = await (supabase as any)
        .from('users')
        .select('id, nome')
        .in('id', userIds);
      const nameMap = new Map((users || []).map((u: any) => [u.id, u.nome]));
      return data.map((r: any) => ({
        user_id: r.user_id,
        read_at: r.read_at,
        user_nome: nameMap.get(r.user_id) || 'Usuário',
      })) as ReadReceipt[];
    },
    enabled: !!expandedId,
  });

  // ── Stats ──
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = notifications.filter(n => new Date(n.created_at) >= today).length;
    return {
      total: notifications.length,
      today: todayCount,
      info: notifications.filter(n => n.tipo === 'info').length,
      alerta: notifications.filter(n => n.tipo === 'alerta').length,
      sucesso: notifications.filter(n => n.tipo === 'sucesso').length,
      individual: notifications.filter(n => n.destinatario === 'usuario').length,
    };
  }, [notifications]);

  // ── Create notification ──
  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const insertData: any = {
        titulo: icone + ' ' + payload.titulo.trim(),
        mensagem: payload.mensagem.trim(),
        tipo: payload.tipo,
        destinatario: payload.destinatario,
        created_by: user?.id || null,
      };
      if (payload.destinatario === 'usuario' && selectedUser) {
        insertData.user_id = selectedUser.id;
      }
      const { error } = await (supabase as any)
        .from('notifications')
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({ title: 'Notificação enviada com sucesso!' });
      setForm({ titulo: '', mensagem: '', tipo: 'info', destinatario: 'todos' });
      setSelectedUser(null);
      setUserSearch('');
      setIcone('🔔');
      setView('list');
    },
    onError: (e: any) => toast({ title: 'Erro ao enviar', description: e?.message, variant: 'destructive' }),
  });

  // ── Delete notification ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({ title: 'Notificação removida' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const insertFormat = (before: string, after: string) => {
    const el = msgRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = form.mensagem;
    const newText = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
    setForm(f => ({ ...f, mensagem: newText }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertAtCursor = (str: string) => {
    const el = msgRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? form.mensagem.length;
    const newText = form.mensagem.slice(0, pos) + str + form.mensagem.slice(pos);
    setForm(f => ({ ...f, mensagem: newText }));
    setTimeout(() => { el.focus(); el.setSelectionRange(pos + str.length, pos + str.length); }, 0);
  };

  const handleCreate = () => {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }
    if (form.destinatario === 'usuario' && !selectedUser) {
      toast({ title: 'Selecione um usuário', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  const filtered = useMemo(() => {
    let list = notifications;
    if (filterTipo !== 'all') list = list.filter(n => n.tipo === filterTipo);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(n => n.titulo.toLowerCase().includes(q) || n.mensagem.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, filterTipo, searchTerm]);

  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Agora';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  // ══════════════════════════════════════════════
  //  CREATE VIEW
  // ══════════════════════════════════════════════
  if (view === 'create') {
    const tc = TIPO_CONFIG[form.tipo] || TIPO_CONFIG.info;
    const dc = DEST_CONFIG[form.destinatario] || DEST_CONFIG.todos;
    const canSend = form.titulo.trim().length > 0 && form.mensagem.trim().length > 0 && (form.destinatario !== 'usuario' || !!selectedUser);

    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Back header */}
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-accent" />
                Nova Notificação
              </h1>
              <p className="text-xs text-muted-foreground">Envie uma mensagem para os usuários</p>
            </div>
          </div>

          {/* Form card */}
          <Card className="border-border/30 overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${tc.gradient}`} />
            <CardContent className="p-4 sm:p-5 space-y-5">
              {/* Icon picker */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ícone</Label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(v => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/40 transition-all w-full text-left"
                  >
                    <span className="text-2xl">{icone}</span>
                    <span className="text-xs text-muted-foreground flex-1">{showIconPicker ? 'Fechar seleção' : 'Trocar ícone'}</span>
                    {showIconPicker ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  {showIconPicker && (
                    <div className="grid grid-cols-8 gap-1 p-3 bg-muted/20 rounded-xl border border-border/20">
                      {NOTIFICATION_ICONS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => { setIcone(emoji); setShowIconPicker(false); }}
                          className={`text-xl p-1.5 rounded-lg transition-all hover:bg-accent/10 ${icone === emoji ? 'bg-accent/20 ring-1 ring-accent/40' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</Label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl shrink-0">{icone}</span>
                  <Input
                    value={form.titulo}
                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex: Atualização de horários"
                    className="h-11 text-base font-medium"
                    maxLength={100}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/60 text-right">{form.titulo.length}/100</p>
              </div>

              {/* Message with formatting toolbar */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 bg-muted/30 rounded-t-lg border border-b-0 border-border/30">
                  <button type="button" title="Negrito (**texto**)" onClick={() => insertFormat('**', '**')}
                    className="px-2 py-1 rounded text-xs font-bold hover:bg-muted/60 transition-all border border-transparent hover:border-border/30">B</button>
                  <button type="button" title="Itálico (_texto_)" onClick={() => insertFormat('_', '_')}
                    className="px-2 py-1 rounded text-xs italic hover:bg-muted/60 transition-all border border-transparent hover:border-border/30">I</button>
                  <div className="w-px h-4 bg-border/40 mx-0.5" />
                  {['✅', '⚠️', '🚗', '💰', '📍', '🎉', '⏰', '🔔', '❗', '🆕'].map(e => (
                    <button key={e} type="button" title={`Inserir ${e}`} onClick={() => insertAtCursor(e)}
                      className="text-sm px-1 py-0.5 rounded hover:bg-muted/60 transition-all">{e}</button>
                  ))}
                </div>
                <Textarea
                  ref={msgRef}
                  value={form.mensagem}
                  onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                  placeholder="Escreva a mensagem... Use **negrito** ou _itálico_ para formatação."
                  rows={5}
                  className="text-sm resize-none rounded-t-none border-t-0"
                  maxLength={500}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground/50">**negrito** · _itálico_</p>
                  <p className="text-[10px] text-muted-foreground/60">{form.mensagem.length}/500</p>
                </div>
              </div>

              <Separator className="opacity-30" />

              {/* Type selector — card chips */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo da Notificação</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, tipo: key }))}
                      className={`p-3 rounded-xl border-2 transition-all text-center space-y-1 ${
                        form.tipo === key
                          ? `${cfg.bgCard} border-current ${cfg.color} shadow-sm`
                          : 'border-border/20 text-muted-foreground hover:border-border/40 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex justify-center">{cfg.icon}</div>
                      <p className="text-xs font-medium">{cfg.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Destinatario selector — card chips */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Destinatários</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(DEST_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setForm(f => ({ ...f, destinatario: key }));
                        if (key !== 'usuario') { setSelectedUser(null); setUserSearch(''); }
                      }}
                      className={`p-3 rounded-xl border-2 transition-all text-center space-y-1 ${
                        form.destinatario === key
                          ? `bg-accent/5 border-accent/40 text-accent shadow-sm`
                          : 'border-border/20 text-muted-foreground hover:border-border/40 hover:bg-muted/20'
                      }`}
                    >
                      <div className={`flex justify-center ${form.destinatario === key ? 'text-accent' : cfg.color}`}>{cfg.icon}</div>
                      <p className="text-xs font-medium">{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight">{cfg.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* User picker — shows when destinatario is 'usuario' */}
              {form.destinatario === 'usuario' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Selecionar Usuário</Label>

                  {selectedUser ? (
                    <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-2.5">
                      <User className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{selectedUser.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-muted-foreground">{selectedUser.telefone}</p>
                          <Badge variant="secondary" className="text-[9px] capitalize px-1 py-0">{selectedUser.tipo}</Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                        className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                        <Input
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          placeholder="Buscar por nome ou telefone..."
                          className="pl-9 h-10 text-sm"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-border/20 divide-y divide-border/10">
                        {filteredUsers.length === 0 ? (
                          <div className="py-6 text-center text-xs text-muted-foreground/50">
                            {allUsers.length === 0 ? 'Carregando usuários...' : 'Nenhum usuário encontrado'}
                          </div>
                        ) : (
                          filteredUsers.map(u => (
                            <button
                              key={u.id}
                              onClick={() => { setSelectedUser(u); setUserSearch(''); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-accent/5 transition-colors"
                            >
                              <div className="p-1.5 rounded-lg bg-cyan-500/10">
                                <User className="w-3.5 h-3.5 text-cyan-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{u.nome}</p>
                                <p className="text-[10px] text-muted-foreground">{u.telefone}</p>
                              </div>
                              <Badge variant="secondary" className="text-[9px] capitalize shrink-0 px-1 py-0">{u.tipo}</Badge>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <Separator className="opacity-30" />

              {/* Live preview */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3 h-3" /> Preview
                </Label>
                <div className={`rounded-xl border ${tc.bgCard} p-3.5 space-y-1.5`}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl shrink-0 leading-none mt-0.5">{icone}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {form.titulo.trim() || 'Título da notificação'}
                      </p>
                      <div
                        className="text-xs text-muted-foreground mt-0.5 [&_strong]:font-semibold [&_strong]:text-foreground/90 [&_em]:italic"
                        dangerouslySetInnerHTML={{ __html: renderMessage(form.mensagem.trim() || 'A mensagem aparecerá aqui...') }}
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Agora
                        </span>
                        <span className={`text-[10px] flex items-center gap-1 ${dc.color}`}>
                          {dc.icon} {dc.label}
                          {form.destinatario === 'usuario' && selectedUser && (
                            <span className="text-muted-foreground ml-1">— {selectedUser.nome}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" onClick={() => setView('list')} className="flex-1 h-11">
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!canSend || createMutation.isPending}
                  className="flex-1 h-11 gap-2 text-sm font-semibold"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar Notificação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  // ══════════════════════════════════════════════
  //  LIST VIEW
  // ══════════════════════════════════════════════
  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent" />
              Central de Notificações
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerencie e envie notificações para a plataforma
            </p>
          </div>
          <Button onClick={() => setView('create')} className="gap-1.5 text-sm h-9 shadow-lg shadow-accent/20">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Card className="border-border/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-accent/10">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{stats.today}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Hoje</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Info className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{stats.info}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Info</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{stats.alerta}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Alertas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{stats.individual}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Individuais</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar notificações..."
              className="pl-9 h-9"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {['all', 'info', 'alerta', 'sucesso'].map(t => {
              const isActive = filterTipo === t;
              const cfg = t === 'all' ? null : TIPO_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => setFilterTipo(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'text-muted-foreground hover:bg-muted/30 border border-transparent'
                  }`}
                >
                  {t === 'all' ? 'Todos' : cfg?.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-border/30">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground font-medium">Nenhuma notificação encontrada</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchTerm ? 'Tente outro termo de busca' : 'Crie a primeira notificação'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setView('create')} className="mt-4 gap-1.5" size="sm">
                  <Plus className="w-4 h-4" /> Criar
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => {
              const tc = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info;
              const dc = DEST_CONFIG[n.destinatario] || DEST_CONFIG.todos;
              const isExpanded = expandedId === n.id;
              const targetName = n.user_id ? (userNameById.get(n.user_id) || 'Usuário') : null;
              const creatorName = n.created_by ? (userNameById.get(n.created_by) || 'Sistema') : 'Sistema';
              const readCount = expandedId === n.id ? readReceipts.length : 0;

              return (
                <Card
                  key={n.id}
                  className={`border-border/20 overflow-hidden transition-all hover:border-border/40 ${isExpanded ? 'ring-1 ring-accent/20' : ''}`}
                >
                  <div className={`h-0.5 bg-gradient-to-r ${tc.gradient}`} />
                  <CardContent className="p-0">
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/10 transition-colors"
                    >
                      <div className={`p-2 rounded-xl ${tc.bgCard} ${tc.color} shrink-0`}>
                        {tc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{n.titulo}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.mensagem}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                            <span className={dc.color}>{dc.icon}</span>
                            {dc.label}
                          </Badge>
                          {n.destinatario === 'usuario' && targetName && (
                            <Badge variant="outline" className="text-[10px] h-5 border-cyan-500/30 text-cyan-300">
                              Enviado para {targetName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
                          <p className="text-[10px] text-muted-foreground/60">por {creatorName}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/10">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
                          <div className="rounded-lg border border-border/20 bg-muted/20 p-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Destinatário</p>
                            <p className="text-xs font-semibold mt-1">{dc.label}</p>
                          </div>
                          <div className="rounded-lg border border-border/20 bg-muted/20 p-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Enviado Para</p>
                            <p className="text-xs font-semibold mt-1">{n.destinatario === 'usuario' ? (targetName || 'Usuário') : 'Grupo'}</p>
                          </div>
                          <div className="rounded-lg border border-border/20 bg-muted/20 p-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Criado Por</p>
                            <p className="text-xs font-semibold mt-1">{creatorName}</p>
                          </div>
                          <div className="rounded-lg border border-border/20 bg-muted/20 p-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Leituras</p>
                            <p className="text-xs font-semibold mt-1 flex items-center gap-1.5">
                              {readCount > 0 ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                              {readCount}
                            </p>
                          </div>
                        </div>

                        <div className="bg-muted/20 rounded-xl p-3 mt-2">
                          <p className="text-xs text-foreground whitespace-pre-wrap">{n.mensagem}</p>
                        </div>

                        {/* Read receipts */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <CheckCheck className="w-3 h-3" />
                            Lido por {readReceipts.length > 0 ? `(${readReceipts.length})` : ''}
                          </p>
                          {readReceipts.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground/50 italic">Ninguém leu ainda</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {readReceipts.map(r => (
                                <div
                                  key={r.user_id}
                                  className="flex items-center gap-1.5 bg-green-500/5 border border-green-500/15 rounded-lg px-2 py-1"
                                >
                                  <CheckCheck className="w-3 h-3 text-green-400 shrink-0" />
                                  <span className="text-[11px] font-medium text-foreground">{r.user_nome}</span>
                                  <span className="text-[9px] text-muted-foreground/60">
                                    {new Date(r.read_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(n.created_at)}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${tc.color}`}>
                              {tc.icon} {tc.label}
                            </Badge>
                            <Badge variant="secondary" className={`text-[10px] gap-1`}>
                              <span className={dc.color}>{dc.icon}</span> {dc.label}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 gap-1"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                          >
                            <Trash2 className="w-3 h-3" /> Excluir
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Footer count */}
            <p className="text-center text-[10px] text-muted-foreground/50 pt-2">
              {filtered.length} de {notifications.length} notificação(ões)
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
