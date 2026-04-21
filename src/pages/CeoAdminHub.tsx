import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CeoLayout from '@/components/CeoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users, FolderOpen, Car, Crown, Shield, Plus, Trash2, ArrowUpCircle,
  Search, ChevronDown, Pencil, Upload, Download, Eye, Copy, FileText,
  Image, File, CheckCircle, X, Link, Truck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_BADGE_CLASS } from '@/lib/rbac';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';
import { motion, AnimatePresence } from 'framer-motion';
import { logPlatformActivity } from '@/lib/activity-log';

// ─── Types ───────────────────────────────────────────────────────────────────
type UserRecord = {
  id: string;
  nome: string;
  telefone: string;
  tipo: string;
  roles?: string[] | null;
  status: string;
  created_at: string;
  avatar_url?: string | null;
  veiculo_marca?: string | null;
  veiculo_modelo?: string | null;
  veiculo_cor?: string | null;
  veiculo_placa?: string | null;
  veiculo_foto?: string | null;
};

type PlatformFile = {
  id: string;
  created_at: string;
  uploaded_by: string | null;
  nome: string;
  descricao: string | null;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  downloads: number;
};

// ─── Administradores Tab ─────────────────────────────────────────────────────
const AdminsTab: React.FC = () => {
  const { toast } = useToast();
  const { user, roles: actorRoles } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', senha: '' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
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
    u.nome.toLowerCase().includes(search.toLowerCase()) || u.telefone.includes(search)
  );

  const logAction = async (targetId: string, action: string, details?: object) => {
    if (!user?.id) return;
    await supabase.from('rbac_audit_log').insert({ actor_id: user.id, target_id: targetId, action, details: details ?? null });
    await logPlatformActivity({ userId: user.id, action, category: 'ceo', entity: 'users', entityId: targetId, details: details ?? null });
  };

  const promoteToCeo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ tipo: 'ceo', roles: ['ceo', 'admin', 'motorista'] }).eq('id', id);
      if (error) throw error;
      await logAction(id, 'promote_to_ceo');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Promovido para CEO!' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const promoteToAdmin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ tipo: 'admin', roles: ['admin', 'motorista'] }).eq('id', id);
      if (error) throw error;
      await logAction(id, 'promote_to_admin');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Promovido para Admin!' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const demoteToMotorista = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ tipo: 'motorista', roles: ['motorista'] }).eq('id', id);
      if (error) throw error;
      await logAction(id, 'demote_to_motorista');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'Rebaixado para Motorista' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const demoteCeoToAdmin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ tipo: 'admin', roles: ['admin', 'motorista'] }).eq('id', id);
      if (error) throw error;
      await logAction(id, 'demote_ceo_to_admin');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ceo-admins'] }); toast({ title: 'CEO rebaixado para Admin' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const deleteAdmin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      await logAction(id, 'delete_admin');
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
        nome: form.nome.trim(), telefone: phone, senha: form.senha.trim(),
        tipo: 'admin', roles: ['admin', 'motorista'], status: 'ativo', ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceo-admins'] });
      toast({ title: 'Admin criado!' });
      setShowCreate(false);
      setForm({ nome: '', telefone: '', senha: '' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editTarget) throw new Error('Usuário inválido');
      const phoneDigits = editForm.telefone.replace(/\D/g, '');
      const { error } = await supabase.from('users').update({
        nome: editForm.nome.trim(), telefone: phoneDigits, status: editForm.status,
      }).eq('id', editTarget.id);
      if (error) throw error;
      await logAction(editTarget.id, 'edit_admin_user', { nome: editForm.nome.trim(), telefone: phoneDigits, status: editForm.status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceo-admins'] });
      toast({ title: 'Usuário atualizado!' });
      setShowEdit(false);
      setEditTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const startEdit = (u: UserRecord) => {
    setEditTarget(u);
    setEditForm({ nome: u.nome, telefone: u.telefone, status: u.status || 'ativo' });
    setShowEdit(true);
  };

  const getRoleBadge = (u: UserRecord) => {
    if (u.tipo === 'ceo' || u.roles?.includes('ceo')) return { label: 'CEO', cls: ROLE_BADGE_CLASS.ceo };
    return { label: 'Admin', cls: ROLE_BADGE_CLASS.admin };
  };

  return (
    <>
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold h-10 gap-1.5">
          <Plus className="w-4 h-4" /> Novo Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum admin encontrado.</p>}
          {filtered.map(u => {
            const badge = getRoleBadge(u);
            const isSelf = u.id === user?.id;
            const isTargetCeo = u.tipo === 'ceo' || u.roles?.includes('ceo');
            const canManage = !isSelf && (isActorCeo || !isTargetCeo);
            const expanded = expandedId === u.id;
            return (
              <Card key={u.id} className="border-border/40">
                <CardContent className="p-0">
                  <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setExpandedId(expanded ? null : u.id)}>
                    <img src={u.avatar_url || getAnimalAvatarUrl(u.id)} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-border flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">{u.nome}</span>
                        {isSelf && <span className="text-[10px] text-muted-foreground">(você)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.telefone}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="px-3 pb-3 flex flex-wrap gap-2 border-t border-border/30 pt-2.5">
                          {canManage && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-400/40 text-blue-400 hover:bg-blue-400/10" onClick={() => startEdit(u)}>
                              <Pencil className="w-3 h-3" /> Editar
                            </Button>
                          )}
                          {!isTargetCeo && canManage && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10" onClick={() => promoteToCeo.mutate(u.id)} disabled={promoteToCeo.isPending}>
                              <Crown className="w-3 h-3" /> Promover para CEO
                            </Button>
                          )}
                          {isTargetCeo && canManage && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-400/40 text-orange-400 hover:bg-orange-400/10" onClick={() => demoteCeoToAdmin.mutate(u.id)} disabled={demoteCeoToAdmin.isPending}>
                              <ArrowUpCircle className="w-3 h-3 rotate-180" /> Rebaixar para Admin
                            </Button>
                          )}
                          {!isTargetCeo && canManage && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-400/40 text-orange-400 hover:bg-orange-400/10" onClick={() => demoteToMotorista.mutate(u.id)} disabled={demoteToMotorista.isPending}>
                              <ArrowUpCircle className="w-3 h-3 rotate-180" /> Rebaixar para Motorista
                            </Button>
                          )}
                          {!isTargetCeo && canManage && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-400/40 text-red-400 hover:bg-red-400/10" onClick={() => setConfirmDelete(u.id)}>
                              <Trash2 className="w-3 h-3" /> Remover
                            </Button>
                          )}
                          {!canManage && <p className="text-xs text-muted-foreground italic">Sem permissão para gerenciar este usuário</p>}
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
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4 border border-border">
              <h2 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-purple-400" /> Novo Administrador</h2>
              <Input placeholder="Nome completo" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              <Input placeholder="Telefone (apenas números)" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
              <Input type="password" placeholder="Senha" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold" onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending || !form.nome || !form.telefone || !form.senha}>
                  {createAdmin.isPending ? 'Criando...' : 'Criar Admin'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: editar */}
      <AnimatePresence>
        {showEdit && editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4 border border-border">
              <h2 className="font-bold flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-400" /> Editar Usuário</h2>
              <Input placeholder="Nome" value={editForm.nome} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))} />
              <Input placeholder="Telefone" value={editForm.telefone} onChange={e => setEditForm(p => ({ ...p, telefone: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={editForm.status === 'ativo' ? 'default' : 'outline'} onClick={() => setEditForm(p => ({ ...p, status: 'ativo' }))}>Ativo</Button>
                <Button type="button" variant={editForm.status === 'inativo' ? 'default' : 'outline'} onClick={() => setEditForm(p => ({ ...p, status: 'inativo' }))}>Inativo</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEdit(false)}>Cancelar</Button>
                <Button className="flex-1 bg-blue-500 hover:bg-blue-500/90 text-white" onClick={() => updateUser.mutate()} disabled={updateUser.isPending || !editForm.nome || !editForm.telefone}>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-xs bg-card rounded-2xl p-5 space-y-4 border border-red-400/30 text-center">
              <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold">Confirmar remoção?</p>
              <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1" onClick={() => deleteAdmin.mutate(confirmDelete!)} disabled={deleteAdmin.isPending}>Remover</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Arquivos Tab ─────────────────────────────────────────────────────────────
const getFileIcon = (mime: string | null) => {
  if (!mime) return <File className="w-5 h-5 text-muted-foreground" />;
  if (mime.startsWith('image/')) return <Image className="w-5 h-5 text-blue-400" />;
  if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const fmtSize = (bytes: number | null) => {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const ArquivosTab: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ nome: '', descricao: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['platform-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_files')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PlatformFile[];
    },
    staleTime: 5_000,
  });

  const filtered = files.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.descricao || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !uploadForm.nome) setUploadForm(p => ({ ...p, nome: file.name }));
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: storageErr } = await supabase.storage
        .from('platform-files')
        .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('platform-files').getPublicUrl(path);

      const { error: dbErr } = await supabase.from('platform_files').insert({
        uploaded_by: user.id,
        nome: uploadForm.nome.trim() || selectedFile.name,
        descricao: uploadForm.descricao.trim() || null,
        storage_path: path,
        public_url: urlData?.publicUrl || null,
        mime_type: selectedFile.type,
        tamanho_bytes: selectedFile.size,
      });
      if (dbErr) throw dbErr;

      qc.invalidateQueries({ queryKey: ['platform-files'] });
      toast({ title: 'Arquivo enviado com sucesso!' });
      setSelectedFile(null);
      setUploadForm({ nome: '', descricao: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('platform-files')
      .createSignedUrl(path, 3600); // 1 hour
    if (error) return null;
    return data.signedUrl;
  };

  const handleCopyLink = async (file: PlatformFile) => {
    const url = await getSignedUrl(file.storage_path);
    if (!url) { toast({ title: 'Erro ao gerar link', variant: 'destructive' }); return; }
    await navigator.clipboard.writeText(url);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
    // increment downloads count
    await supabase.from('platform_files').update({ downloads: (file.downloads || 0) + 1 }).eq('id', file.id);
    qc.invalidateQueries({ queryKey: ['platform-files'] });
    toast({ title: 'Link copiado! (válido por 1 hora)' });
  };

  const handleDownload = async (file: PlatformFile) => {
    const url = await getSignedUrl(file.storage_path);
    if (!url) { toast({ title: 'Erro ao gerar link', variant: 'destructive' }); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = file.nome;
    a.target = '_blank';
    a.click();
    await supabase.from('platform_files').update({ downloads: (file.downloads || 0) + 1 }).eq('id', file.id);
    qc.invalidateQueries({ queryKey: ['platform-files'] });
  };

  const handleView = async (file: PlatformFile) => {
    const url = await getSignedUrl(file.storage_path);
    if (!url) { toast({ title: 'Erro ao gerar link', variant: 'destructive' }); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const deleteFile = useMutation({
    mutationFn: async (file: PlatformFile) => {
      const { error: storageErr } = await supabase.storage.from('platform-files').remove([file.storage_path]);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase.from('platform_files').delete().eq('id', file.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-files'] }); toast({ title: 'Arquivo removido' }); setConfirmDeleteId(null); },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return (
    <>
      {/* Upload form */}
      <Card className="border-border/40 mb-4">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2"><Upload className="w-4 h-4 text-yellow-400" /> Enviar Arquivo</h3>
          <div
            className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center cursor-pointer hover:border-yellow-400/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="flex items-center gap-3 justify-center">
                {getFileIcon(selectedFile.type)}
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtSize(selectedFile.size)}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Upload className="w-8 h-8 mx-auto mb-1 opacity-40" />
                <p className="text-xs">Clique para selecionar um arquivo</p>
                <p className="text-[10px] mt-0.5 opacity-60">Máx. 50MB · Imagens, PDF, ZIP, Office</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.zip,.txt,.csv,.xls,.xlsx,.doc,.docx" />
          <Input placeholder="Nome do arquivo (opcional)" value={uploadForm.nome} onChange={e => setUploadForm(p => ({ ...p, nome: e.target.value }))} className="h-9 text-sm" />
          <Input placeholder="Descrição (opcional)" value={uploadForm.descricao} onChange={e => setUploadForm(p => ({ ...p, descricao: e.target.value }))} className="h-9 text-sm" />
          <Button
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold h-9 gap-1.5"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Enviando...' : <><Upload className="w-4 h-4" /> Enviar</>}
          </Button>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar arquivos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* Files list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          {search ? 'Nenhum arquivo encontrado.' : 'Nenhum arquivo enviado ainda.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(file => (
            <Card key={file.id} className="border-border/40">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(file.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{file.nome}</p>
                    {file.descricao && <p className="text-xs text-muted-foreground truncate">{file.descricao}</p>}
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{fmtSize(file.tamanho_bytes)}</span>
                      <span className="text-[10px] text-muted-foreground">{file.downloads} downloads</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(file.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <button onClick={() => setConfirmDeleteId(file.id)} className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-1.5 mt-2.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1" onClick={() => handleView(file)}>
                    <Eye className="w-3 h-3" /> Visualizar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1" onClick={() => handleDownload(file)}>
                    <Download className="w-3 h-3" /> Download
                  </Button>
                  <Button size="sm" variant="outline" className={`h-7 text-xs gap-1 flex-1 transition-colors ${copiedId === file.id ? 'border-emerald-400/40 text-emerald-400' : ''}`} onClick={() => handleCopyLink(file)}>
                    {copiedId === file.id ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === file.id ? 'Copiado!' : 'Copiar link'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-xs bg-card rounded-2xl p-5 space-y-4 border border-red-400/30 text-center">
              <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold">Remover arquivo?</p>
              <p className="text-xs text-muted-foreground">O arquivo será excluído permanentemente.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1" onClick={() => { const f = files.find(x => x.id === confirmDeleteId); if (f) deleteFile.mutate(f); }} disabled={deleteFile.isPending}>Remover</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Veículos Tab ─────────────────────────────────────────────────────────────
const VeiculosTab: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ veiculo_marca: '', veiculo_modelo: '', veiculo_cor: '', veiculo_placa: '', veiculo_foto: '' });

  const { data: motoristas = [], isLoading } = useQuery({
    queryKey: ['ceo-motoristas-veiculos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, roles, status, created_at, avatar_url, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa, veiculo_foto')
        .eq('tipo', 'motorista')
        .order('nome');
      if (error) throw error;
      return data as UserRecord[];
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const filtered = motoristas.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.telefone.includes(search) ||
    (m.veiculo_placa || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.veiculo_modelo || '').toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (m: UserRecord) => {
    setEditTarget(m);
    setEditForm({
      veiculo_marca: m.veiculo_marca || '',
      veiculo_modelo: m.veiculo_modelo || '',
      veiculo_cor: m.veiculo_cor || '',
      veiculo_placa: m.veiculo_placa || '',
      veiculo_foto: m.veiculo_foto || '',
    });
  };

  const saveVeiculo = useMutation({
    mutationFn: async () => {
      if (!editTarget) throw new Error('Motorista inválido');
      const { error } = await supabase.from('users').update({
        veiculo_marca: editForm.veiculo_marca.trim() || null,
        veiculo_modelo: editForm.veiculo_modelo.trim() || null,
        veiculo_cor: editForm.veiculo_cor.trim() || null,
        veiculo_placa: editForm.veiculo_placa.trim().toUpperCase() || null,
        veiculo_foto: editForm.veiculo_foto.trim() || null,
      }).eq('id', editTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceo-motoristas-veiculos'] });
      toast({ title: 'Veículo atualizado!' });
      setEditTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const hasVehicle = (m: UserRecord) => m.veiculo_marca || m.veiculo_modelo || m.veiculo_placa;

  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar motorista, placa ou modelo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Card className="border-border/40">
          <CardContent className="p-3 flex items-center gap-2">
            <Car className="w-8 h-8 text-yellow-400 bg-yellow-400/10 rounded-lg p-1.5" />
            <div>
              <p className="text-xl font-extrabold">{motoristas.filter(hasVehicle).length}</p>
              <p className="text-[10px] text-muted-foreground">Com veículo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 flex items-center gap-2">
            <Truck className="w-8 h-8 text-muted-foreground bg-muted/40 rounded-lg p-1.5" />
            <div>
              <p className="text-xl font-extrabold">{motoristas.filter(m => !hasVehicle(m)).length}</p>
              <p className="text-[10px] text-muted-foreground">Sem veículo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Car className="w-10 h-10 mx-auto mb-2 opacity-30" />
          {search ? 'Nenhum motorista encontrado.' : 'Nenhum motorista cadastrado.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <Card key={m.id} className="border-border/40">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Vehicle photo or avatar */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-border flex-shrink-0 bg-muted/20">
                    {m.veiculo_foto ? (
                      <img src={m.veiculo_foto} alt="Veículo" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = getAnimalAvatarUrl(m.id); }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/40">
                        <Car className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{m.nome}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${m.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30' : 'bg-red-500/10 text-red-400 border-red-400/30'}`}>
                        {m.status}
                      </span>
                    </div>
                    {hasVehicle(m) ? (
                      <div className="mt-1 space-y-0.5">
                        {(m.veiculo_marca || m.veiculo_modelo) && (
                          <p className="text-xs text-foreground font-medium">{[m.veiculo_marca, m.veiculo_modelo].filter(Boolean).join(' ')}</p>
                        )}
                        <div className="flex gap-2">
                          {m.veiculo_placa && (
                            <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border text-foreground">{m.veiculo_placa}</span>
                          )}
                          {m.veiculo_cor && <span className="text-[10px] text-muted-foreground">{m.veiculo_cor}</span>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic mt-0.5">Sem veículo cadastrado</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-shrink-0" onClick={() => startEdit(m)}>
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-3 border border-border max-h-[85vh] overflow-y-auto">
              <h2 className="font-bold flex items-center gap-2"><Car className="w-4 h-4 text-yellow-400" /> Veículo de {editTarget.nome.split(' ')[0]}</h2>
              <Input placeholder="Marca (ex: Toyota)" value={editForm.veiculo_marca} onChange={e => setEditForm(p => ({ ...p, veiculo_marca: e.target.value }))} />
              <Input placeholder="Modelo (ex: Corolla)" value={editForm.veiculo_modelo} onChange={e => setEditForm(p => ({ ...p, veiculo_modelo: e.target.value }))} />
              <Input placeholder="Cor (ex: Prata)" value={editForm.veiculo_cor} onChange={e => setEditForm(p => ({ ...p, veiculo_cor: e.target.value }))} />
              <Input placeholder="Placa (ex: ABC1234)" value={editForm.veiculo_placa} onChange={e => setEditForm(p => ({ ...p, veiculo_placa: e.target.value }))} className="font-mono uppercase" />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Link className="w-3 h-3" /> Foto do veículo (URL)</label>
                <Input placeholder="https://..." value={editForm.veiculo_foto} onChange={e => setEditForm(p => ({ ...p, veiculo_foto: e.target.value }))} />
              </div>
              {editForm.veiculo_foto && (
                <div className="rounded-xl overflow-hidden border border-border h-32 bg-muted/20">
                  <img src={editForm.veiculo_foto} alt="Preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancelar</Button>
                <Button className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold" onClick={() => saveVeiculo.mutate()} disabled={saveVeiculo.isPending}>
                  {saveVeiculo.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Hub principal ────────────────────────────────────────────────────────────
type Tab = 'administradores' | 'arquivos' | 'veiculos';

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'administradores', label: 'Administradores', icon: Users, color: 'text-yellow-400' },
  { id: 'arquivos', label: 'Arquivos', icon: FolderOpen, color: 'text-blue-400' },
  { id: 'veiculos', label: 'Veículos', icon: Car, color: 'text-emerald-400' },
];

const CeoAdminHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('administradores');
  const current = TABS.find(t => t.id === activeTab)!;
  const Icon = current.icon;

  return (
    <CeoLayout>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-yellow-400" />
          <h1 className="text-xl font-extrabold">Administração</h1>
        </div>
        <p className="text-xs text-muted-foreground">Gerenciamento de admins, arquivos e veículos</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl mb-5 border border-border/30">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-card shadow-sm border border-border/40 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TabIcon className={`w-3.5 h-3.5 ${isActive ? tab.color : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-4 h-4 ${current.color}`} />
        <h2 className="font-bold text-sm">{current.label}</h2>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'administradores' && <AdminsTab />}
          {activeTab === 'arquivos' && <ArquivosTab />}
          {activeTab === 'veiculos' && <VeiculosTab />}
        </motion.div>
      </AnimatePresence>
    </CeoLayout>
  );
};

export default CeoAdminHub;
