import React, { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Camera, Loader2, User, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAnimalAvatarUrl } from '@/lib/animal-avatars';

// ── Crop helper: canvas-based crop to blob ──
async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const size = 400; // output 400x400
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, size, size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to blob failed'))),
      'image/jpeg',
      0.85,
    );
  });
}

interface ProfileEditorProps {
  profile: {
    id: string;
    nome: string;
    telefone: string;
    avatar_url?: string | null;
  };
  onClose: () => void;
  onUpdated?: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onClose, onUpdated }) => {
  const { toast } = useToast();
  const { updateProfile } = useAuth();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState(profile.nome);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [saving, setSaving] = useState(false);

  // Crop state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!rawImage || !croppedArea) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(rawImage, croppedArea);
      const filePath = `avatars/${profile.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          upsert: true,
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache buster
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);

      // Save to users table
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', profile.id);
      updateProfile({ avatar_url: publicUrl });

      toast({ title: 'Foto atualizada!' });
      setShowCropDialog(false);
      setRawImage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar foto';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedNome = nome.trim();
    if (!trimmedNome) {
      toast({ title: 'Nome não pode ser vazio', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ nome: trimmedNome })
        .eq('id', profile.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['driver-full-profile'] });
      toast({ title: 'Perfil atualizado!' });
      onUpdated?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardContent className="pt-[5%] pb-[4%] px-[4%] space-y-[4%]">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
              <User className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-[clamp(1.1rem,3.5vw,1.35rem)] font-bold">Editar Perfil</h2>
            <p className="text-xs text-muted-foreground">Altere seu nome e foto</p>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
            >
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-accent/30 bg-muted/50 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img src={getAnimalAvatarUrl(profile.id)} alt="Avatar" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-lg">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </button>
            <p className="text-[10px] text-muted-foreground">Toque para alterar a foto</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Nome
            </label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome"
              className="h-12 text-base"
            />
          </div>

          {/* Telefone (read-only) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              Telefone
            </label>
            <Input
              value={profile.telefone}
              readOnly
              className="h-12 text-base opacity-60"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl"
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !nome.trim()}
              className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Crop Dialog ── */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="w-5 h-5 text-accent" />
              Recortar Foto
            </DialogTitle>
            <DialogDescription>
              Arraste e ajuste o zoom para enquadrar seu rosto
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full aspect-square bg-black">
            {rawImage && (
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          {/* Zoom control */}
          <div className="flex items-center gap-3 px-4 pb-2">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-2 accent-accent"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          <div className="flex gap-2 p-4 pt-0">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => { setShowCropDialog(false); setRawImage(null); }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCropConfirm}
              disabled={uploading}
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileEditor;
