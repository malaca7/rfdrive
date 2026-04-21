import React, { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  Camera, Loader2, Save, User, Phone, Lock, Car,
  ZoomIn, ZoomOut, Eye, EyeOff, Calendar, AtSign, ShieldCheck,
  ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VEHICLE_BRANDS, VEHICLE_MODELS, VEHICLE_COLORS } from '@/lib/vehicle-data';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';

// ── Crop helper ──
async function getCroppedBlob(imageSrc: string, crop: Area, outputSize = 400): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to blob failed'))),
      'image/jpeg', 0.9,
    );
  });
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}`;
  return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}.${digits.slice(7)}`;
}

function formatPlate(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (clean.length <= 3) return clean;
  return clean.slice(0, 3) + '-' + clean.slice(3);
}

const MotoristaEditPerfil: React.FC = () => {
  const { user, updateProfile, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load profile ──
  const { data: fullProfile, isLoading } = useQuery({
    queryKey: ['driver-full-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, status, veiculo_marca, veiculo_modelo, veiculo_cor, veiculo_placa, avatar_url, veiculo_foto, apelido, data_nascimento')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── Form state ──
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  // Password change
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [cor, setCor] = useState('');
  const [placa, setPlaca] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Sync avatarUrl: prioritize AuthContext (same source as top bar)
  React.useEffect(() => {
    const best = authProfile?.avatar_url || fullProfile?.avatar_url;
    if (best && !avatarUrl) setAvatarUrl(best);
  }, [authProfile?.avatar_url, fullProfile?.avatar_url]);

  // ── Avatar crop ──
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);

  // Initialize form from profile
  if (fullProfile && !initialized) {
    setNome(fullProfile.nome || '');
    setApelido((fullProfile as any).apelido || '');
    setDataNascimento((fullProfile as any).data_nascimento || '');
    setTelefone(formatPhone(fullProfile.telefone || ''));
    setMarca(fullProfile.veiculo_marca || '');
    setModelo(fullProfile.veiculo_modelo || '');
    setCor(fullProfile.veiculo_cor || '');
    setPlaca(fullProfile.veiculo_placa ? formatPlate(fullProfile.veiculo_placa) : '');
    setAvatarUrl(fullProfile.avatar_url || '');
    setInitialized(true);
  }

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione uma imagem', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande (máx. 10MB)', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!rawImage || !croppedArea || !user) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(rawImage, croppedArea);
      const filePath = `avatars/${user.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
      updateProfile({ avatar_url: publicUrl });
      queryClient.invalidateQueries({ queryKey: ['driver-full-profile'] });
      toast({ title: 'Foto atualizada!' });
      setShowCropDialog(false);
      setRawImage(null);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Erro ao enviar foto', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ── Save profile ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (novaSenha.trim() && novaSenha !== confirmarSenha) {
        throw new Error('As senhas não coincidem');
      }
      const updates: Record<string, unknown> = {
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
        apelido: apelido.trim() || null,
        data_nascimento: dataNascimento || null,
      };
      if (novaSenha.trim()) {
        updates.senha = novaSenha.trim();
      }
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Perfil atualizado!' });
      setNovaSenha('');
      setConfirmarSenha('');
      setShowPasswordSection(false);
      updateProfile({ nome: nome.trim(), telefone: telefone.replace(/\D/g, '') });
      queryClient.invalidateQueries({ queryKey: ['driver-full-profile'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0) return { level: 0, label: '', bars: 0 };
    if (pass.length < 6) return { level: 1, label: 'Muito fraca', bars: 1, color: 'bg-red-500' };
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const variety = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (pass.length >= 8 && variety >= 3) return { level: 4, label: 'Forte', bars: 4, color: 'bg-green-500' };
    if (pass.length >= 8 && variety >= 2) return { level: 3, label: 'Boa', bars: 3, color: 'bg-blue-500' };
    return { level: 2, label: 'Fraca', bars: 2, color: 'bg-amber-500' };
  };

  const passwordStrength = getPasswordStrength(novaSenha);
  const passwordsMatch = novaSenha.length > 0 && confirmarSenha.length > 0 && novaSenha === confirmarSenha;
  const passwordsMismatch = confirmarSenha.length > 0 && novaSenha !== confirmarSenha;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto space-y-[4%]">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[clamp(1.3rem,4.5vw,1.75rem)] font-extrabold leading-tight flex items-center gap-2">
            <User className="w-6 h-6 text-accent" />
            Editar Perfil
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            Atualize suas informações pessoais e do veículo
          </p>
        </motion.div>

        {/* Avatar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl">
            <CardContent className="py-6 flex flex-col items-center gap-3">
              <div
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-accent/40 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={getAnimalAvatarUrl(user?.id || '')} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-4 h-4" /> Alterar Foto
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Personal info */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl">
            <CardContent className="pt-5 pb-4 px-[4%] space-y-4">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> INFORMAÇÕES PESSOAIS
              </p>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><AtSign className="w-3 h-3" /> Apelido (opcional)</Label>
                <Input value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Como prefere ser chamado" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Data de Nascimento</Label>
                <Input
                  type="date"
                  value={dataNascimento}
                  onChange={e => setDataNascimento(e.target.value)}
                  className="block"
                />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={telefone}
                  onChange={e => setTelefone(formatPhone(e.target.value))}
                  placeholder="(81) 9 9613.8924"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Password change */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card className="rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPasswordSection(v => !v)}
              className="w-full px-[4%] py-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Alterar Senha</p>
                  <p className="text-[11px] text-muted-foreground">Defina uma nova senha de acesso</p>
                </div>
              </div>
              {showPasswordSection
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showPasswordSection && (
              <CardContent className="pt-0 pb-5 px-[4%] space-y-4 border-t border-border/30">
                {/* Nova senha */}
                <div className="space-y-1.5 pt-4">
                  <Label className="text-xs flex items-center gap-1"><Lock className="w-3 h-3" /> Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={showNovaSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNovaSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {novaSenha.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all ${i <= passwordStrength.bars ? passwordStrength.color : 'bg-muted/40'}`}
                          />
                        ))}
                      </div>
                      <p className={`text-[10px] font-medium ${
                        passwordStrength.bars >= 4 ? 'text-green-400' :
                        passwordStrength.bars === 3 ? 'text-blue-400' :
                        passwordStrength.bars === 2 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {passwordStrength.label}
                        {passwordStrength.bars >= 3 && ' · Use letras maiúsculas, números e símbolos para uma senha mais segura'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmarSenha ? 'text' : 'password'}
                      value={confirmarSenha}
                      onChange={e => setConfirmarSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={`pr-10 ${passwordsMismatch ? 'border-red-500/50' : passwordsMatch ? 'border-green-500/50' : ''}`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordsMatch && (
                    <p className="text-[11px] text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Senhas conferem
                    </p>
                  )}
                  {passwordsMismatch && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> As senhas não coincidem
                    </p>
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground/60 bg-muted/20 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  Deixe em branco se não deseja alterar a senha atual. As alterações serão salvas ao clicar em "Salvar Alterações".
                </div>
              </CardContent>
            )}
          </Card>
        </motion.div>

        {/* Vehicle info */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="rounded-2xl">
            <CardContent className="pt-5 pb-4 px-[4%] space-y-4">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <Car className="w-3.5 h-3.5" /> DADOS DO VEÍCULO
              </p>
              <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Dados do veículo gerenciados pelo administrador</span>
              </div>
              <div className="grid grid-cols-2 gap-3 opacity-60 pointer-events-none select-none">
                <div>
                  <Label className="text-xs">Marca</Label>
                  <Select value={marca} onValueChange={v => { setMarca(v); setModelo(''); }} disabled>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Modelo</Label>
                  <Select value={modelo} onValueChange={v => setModelo(v)} disabled>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(VEHICLE_MODELS[marca] || ['Outro']).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cor</Label>
                  <Select value={cor} onValueChange={v => setCor(v)} disabled>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Placa</Label>
                  <Input
                    value={placa}
                    readOnly
                    placeholder="ABC-1234"
                    maxLength={8}
                  />
                </div>
              </div>

              {/* Vehicle preview illustration */}
              {fullProfile?.veiculo_foto ? (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <img
                    src={fullProfile.veiculo_foto}
                    alt="Foto do veículo"
                    className="max-h-[160px] w-full object-contain rounded-xl"
                    style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Foto definida pelo administrador
                  </p>
                </div>
              ) : marca && modelo ? (() => {
                const corMap: Record<string, string> = {
                  'Preto': 'pspc0029', 'Preta': 'pspc0029',
                  'Branco': 'pspc0001', 'Branca': 'pspc0001',
                  'Prata': 'pspc0022',
                  'Cinza': 'pspc0032',
                  'Vermelho': 'pspc0015', 'Vermelha': 'pspc0015',
                  'Azul': 'pspc0012',
                  'Verde': 'pspc0005',
                  'Amarelo': 'pspc0004', 'Amarela': 'pspc0004',
                  'Marrom': 'pspc0031', 'Bege': 'pspc0031',
                  'Dourado': 'pspc0025', 'Dourada': 'pspc0025',
                  'Vinho': 'pspc0017', 'Bordo': 'pspc0017',
                  'Laranja': 'pspc0021',
                  'Rosa': 'pspc0020',
                };
                const paintId = corMap[cor] || 'pspc0029';
                const carUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&make=${encodeURIComponent(marca)}&modelFamily=${encodeURIComponent(modelo)}&paintId=${paintId}&angle=01&width=900&zoomType=fullscreen`;
                return (
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <img
                      src={carUrl}
                      alt={`${marca} ${modelo}`}
                      className="max-h-[120px] w-full object-contain"
                      style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {[marca, modelo, cor].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                );
              })() : null}
            </CardContent>
          </Card>
        </motion.div>

        {/* Save button */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Button
            className="w-full h-12 rounded-2xl font-bold text-base btn-themed gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !nome.trim() || !telefone.trim()}
          >
            {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Salvar Alterações
          </Button>
        </motion.div>
      </div>

      {/* ── Avatar Crop Dialog ── */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Foto</DialogTitle>
            <DialogDescription>Arraste e ajuste o zoom para recortar sua foto de perfil.</DialogDescription>
          </DialogHeader>
          <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
            {rawImage && (
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="flex items-center gap-3 px-4">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1} max={3} step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowCropDialog(false); setRawImage(null); }}>Cancelar</Button>
            <Button onClick={handleCropConfirm} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Salvar Foto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default MotoristaEditPerfil;
