import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CeoLayout from '@/components/CeoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Shield, Plus, Trash2, ArrowUpCircle, Search, Users, ChevronDown, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_BADGE_CLASS } from '@/lib/rbac';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';
import { motion, AnimatePresence } from 'framer-motion';
import { logPlatformActivity } from '@/lib/activity-log';

type UserRecord = {
  id: string;
  nome: string;
  telefone: string;
  tipo: string;
  roles?: string[] | null;
  status: string;
  created_at: string;
  avatar_url?: string | null;
};

const CeoAdmins: React.FC = () => {
  const { toast } = useToast();
  const { user, roles: actorRoles } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', senha: '' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', telefone: '', status: 'ativo' });
  const isActorCeo = actorRoles.some(r => String(r).toLowerCase() === 'ceo');

  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ['ceo-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, roles, status, created_at, avatar_url')
        .in('tipo', ['admin', 'ceo'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserRecord[];
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const filtered = adminUsers.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.telefone.includes(search)
  );

  const logAction = async (targetId: string, action: string, details?: object) => {
    if (!user?.id) return;
    await supabase.from('rbac_audit_log').insert({
      actor_id: user.id,
      target_id: targetId,
      action,
      details: details ?? null,
    });

    await logPlatformActivity({
      userId: user.id,
      action,
      category: 'ceo',
      entity: 'users',
      entityId: targetId,
      details: details ?? null,
    });
  };

  const promoteToAdmin = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from('users').update({
        tipo: 'admin',
        roles: ['admin', 'motorista'],
      }).eq('id', targetId);
      if (error) throw error;
      await logAction(targetId, 'promote_to_admin');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Promovido para Admin!' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const promoteToCeo = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from('users').update({
        tipo: 'ceo',
        roles: ['ceo', 'admin', 'motorista'],
      }).eq('id', targetId);
      if (error) throw error;
      await logAction(targetId, 'promote_to_ceo');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Promovido para CEO!' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const demoteToMotorista = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from('users').update({
        tipo: 'motorista',
        roles: ['motorista'],
      }).eq('id', targetId);
      if (error) throw error;
      await logAction(targetId, 'demote_to_motorista');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Rebaixado para Motorista' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const demoteCeoToAdmin = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from('users').update({
        tipo: 'admin',
        roles: ['admin', 'motorista'],
      }).eq('id', targetId);
      if (error) throw error;
      await logAction(targetId, 'demote_ceo_to_admin');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'CEO rebaixado para Admin' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const deleteAdmin = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from('users').delete().eq('id', targetId);
      if (error) throw error;
      await logAction(targetId, 'delete_admin');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Usuário removido' }); setConfirmDelete(null); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const createAdmin = useMutation({
    mutationFn: async () => {
      const phone = form.telefone.replace(/\D/g, '');
      const { data: ex } = await supabase.from('users').select('id').eq('telefone', phone).maybeSingle();
      if (ex) throw new Error('Telefone já cadastrado');
      const { error } = await supabase.from('users').insert({
        nome: form.nome.trim(),
        telefone: phone,
        senha: form.senha.trim(),
        tipo: 'admin',
        roles: ['admin', 'motorista'],
        status: 'ativo',
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceo-admins'] });
      toast({ title: 'Admin criado!' });
      setShowCreateDialog(false);
      setForm({ nome: '', telefone: '', senha: '' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editTarget) throw new Error('Usuário inválido');
      const phoneDigits = editForm.telefone.replace(/\D/g, '');
      const { error } = await supabase.from('users').update({
        nome: editForm.nome.trim(),
        telefone: phoneDigits,
        status: editForm.status,
      }).eq('id', editTarget.id);
      if (error) throw error;
      await logAction(editTarget.id, 'edit_admin_user', {
        nome: editForm.nome.trim(),
        telefone: phoneDigits,
        status: editForm.status,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceo-admins'] });
      toast({ title: 'Usuário atualizado com sucesso' });
      setShowEditDialog(false);
      setEditTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao editar', description: e?.message, variant: 'destructive' }),
  });

  const startEdit = (u: UserRecord) => {
    setEditTarget(u);
    setEditForm({
      nome: u.nome,
      telefone: u.telefone,
      status: u.status || 'ativo',
    });
    setShowEditDialog(true);
  };

  const getRoleBadge = (u: UserRecord) => {
    if (u.tipo === 'ceo' || u.roles?.includes('ceo')) return { label: 'CEO', cls: ROLE_BADGE_CLASS.ceo };
    return { label: 'Admin', cls: ROLE_BADGE_CLASS.admin };
  };

  return (
    <CeoLayout>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-yellow-400" />
          <h1 className="text-xl font-extrabold">Gerenciar Admins</h1>
        </div>
        <p className="text-xs text-muted-foreground">Controle total de administradores e CEOs</p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold h-10 gap-1.5"
        >
          <Plus className="w-4 h-4" /> Novo Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum admin encontrado.</p>
          )}
          {filtered.map(u => {
            const badge = getRoleBadge(u);
            const isSelf = u.id === user?.id;
            const isTargetCeo = u.tipo === 'ceo' || u.roles?.includes('ceo');
            const canManage = !isSelf && (isActorCeo || (!isTargetCeo));
            const expanded = expandedId === u.id;

            return (
              <Card key={u.id} className="border-border/40">
                <CardContent className="p-0">
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left"
                    onClick={() => setExpandedId(expanded ? null : u.id)}
                  >
                    <img
                      src={u.avatar_url || getAnimalAvatarUrl(u.id)}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover border-2 border-border flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">{u.nome}</span>
                        {isSelf && <span className="text-[10px] text-muted-foreground">(você)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.telefone}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 flex flex-wrap gap-2 border-t border-border/30 pt-2.5">
                          {canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-blue-400/40 text-blue-400 hover:bg-blue-400/10"
                              onClick={() => startEdit(u)}
                            >
                              <Pencil className="w-3 h-3" /> Editar
                            </Button>
                          )}
                          {!isTargetCeo && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10"
                              onClick={() => promoteToCeo.mutate(u.id)}
                              disabled={promoteToCeo.isPending}
                            >
                              <Crown className="w-3 h-3" /> Promover para CEO
                            </Button>
                          )}
                          {isTargetCeo && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-orange-400/40 text-orange-400 hover:bg-orange-400/10"
                              onClick={() => demoteCeoToAdmin.mutate(u.id)}
                              disabled={demoteCeoToAdmin.isPending}
                            >
                              <ArrowUpCircle className="w-3 h-3 rotate-180" /> Rebaixar para Admin
                            </Button>
                          )}
                          {!isTargetCeo && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-orange-400/40 text-orange-400 hover:bg-orange-400/10"
                              onClick={() => demoteToMotorista.mutate(u.id)}
                              disabled={demoteToMotorista.isPending}
                            >
                              <ArrowUpCircle className="w-3 h-3 rotate-180" /> Rebaixar para Motorista
                            </Button>
                          )}
                          {!isTargetCeo && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-red-400/40 text-red-400 hover:bg-red-400/10"
                              onClick={() => setConfirmDelete(u.id)}
                            >
                              <Trash2 className="w-3 h-3" /> Remover
                            </Button>
                          )}
                          {!canManage && (
                            <p className="text-xs text-muted-foreground italic">Sem permissão para gerenciar este usuário</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: criar admin */}
      <AnimatePresence>
        {showCreateDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && setShowCreateDialog(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4 border border-border"
            >
              <h2 className="font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" /> Novo Administrador
              </h2>
              <Input placeholder="Nome completo" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              <Input placeholder="Telefone (apenas números)" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
              <Input type="password" placeholder="Senha" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold"
                  onClick={() => createAdmin.mutate()}
                  disabled={createAdmin.isPending || !form.nome || !form.telefone || !form.senha}
                >
                  {createAdmin.isPending ? 'Criando...' : 'Criar Admin'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: editar usuário */}
      <AnimatePresence>
        {showEditDialog && editTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && setShowEditDialog(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4 border border-border"
            >
              <h2 className="font-bold flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-400" /> Editar Usuário
              </h2>
              <Input
                placeholder="Nome"
                value={editForm.nome}
                onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
              />
              <Input
                placeholder="Telefone"
                value={editForm.telefone}
                onChange={e => setEditForm(p => ({ ...p, telefone: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={editForm.status === 'ativo' ? 'default' : 'outline'}
                  onClick={() => setEditForm(p => ({ ...p, status: 'ativo' }))}
                >
                  Ativo
                </Button>
                <Button
                  type="button"
                  variant={editForm.status === 'inativo' ? 'default' : 'outline'}
                  onClick={() => setEditForm(p => ({ ...p, status: 'inativo' }))}
                >
                  Inativo
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-500 hover:bg-blue-500/90 text-white"
                  onClick={() => updateUser.mutate()}
                  disabled={updateUser.isPending || !editForm.nome || !editForm.telefone}
                >
                  {updateUser.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: confirmar remoção */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-card rounded-2xl p-5 space-y-4 border border-red-400/30 text-center"
            >
              <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold">Confirmar remoção?</p>
              <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => deleteAdmin.mutate(confirmDelete)}
                  disabled={deleteAdmin.isPending}
                >
                  Remover
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CeoLayout>
  );
};

export default CeoAdmins;
