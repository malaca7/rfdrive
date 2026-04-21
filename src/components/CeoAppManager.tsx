import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Download, Loader2, Package, Smartphone, Upload } from 'lucide-react';

type AppRelease = Database['public']['Tables']['app_releases']['Row'];

const APP_RELEASES_QUERY_KEY = ['app-releases'];

const formatSize = (bytes: number | null) => {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ensureApkName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase().endsWith('.apk') ? trimmed : `${trimmed}.apk`;
};

const sanitizeStorageName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_');

const triggerDownload = (release: Pick<AppRelease, 'public_url' | 'file_name'>) => {
  const link = document.createElement('a');
  link.href = release.public_url;
  link.download = release.file_name;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
};

const CeoAppManager: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ versionName: '', fileName: '' });

  const { data: releases = [], isLoading } = useQuery({
    queryKey: APP_RELEASES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('*')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as AppRelease[];
    },
    staleTime: 5_000,
  });

  const currentRelease = useMemo(
    () => releases.find((release) => release.is_current) ?? releases[0] ?? null,
    [releases]
  );

  const uploadRelease = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário inválido para publicar release.');
      if (!selectedFile) throw new Error('Selecione o arquivo APK.');

      const normalizedVersion = form.versionName.trim();
      const normalizedFileName = ensureApkName(form.fileName || selectedFile.name);

      if (!normalizedVersion) throw new Error('Informe a versão do app.');
      if (!normalizedFileName) throw new Error('Informe o nome do arquivo.');
      if (!selectedFile.name.toLowerCase().endsWith('.apk')) throw new Error('O arquivo precisa ser um APK.');

      const storagePath = `releases/${Date.now()}_${sanitizeStorageName(normalizedFileName)}`;
      const contentType = selectedFile.type || 'application/vnd.android.package-archive';

      const { error: uploadError } = await supabase.storage
        .from('app-releases')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('app-releases').getPublicUrl(storagePath);

      const { data: insertedRelease, error: insertError } = await supabase
        .from('app_releases')
        .insert({
          uploaded_by: user.id,
          version_name: normalizedVersion,
          file_name: normalizedFileName,
          storage_path: storagePath,
          public_url: publicUrlData.publicUrl,
          mime_type: contentType,
          size_bytes: selectedFile.size,
          is_current: true,
        })
        .select('*')
        .single();

      if (insertError) {
        await supabase.storage.from('app-releases').remove([storagePath]);
        throw insertError;
      }

      const { error: cleanupError } = await supabase
        .from('app_releases')
        .update({ is_current: false })
        .neq('id', insertedRelease.id)
        .eq('is_current', true);

      if (cleanupError) throw cleanupError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APP_RELEASES_QUERY_KEY });
      setSelectedFile(null);
      setForm({ versionName: '', fileName: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: 'Nova versão publicada com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao publicar APK',
        description: error?.message || 'Não foi possível salvar a nova versão.',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setForm((prev) => ({
        ...prev,
        fileName: ensureApkName(file.name),
      }));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border bg-sky-500/5 border-sky-500/20">
        <CardContent className="py-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-sky-400 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Release atual do app
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                O APK publicado aqui passa a ser a versão atual exibida na página de download.
              </p>
            </div>
            {currentRelease ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Atual
              </Badge>
            ) : null}
          </div>

          {currentRelease ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <p className="text-[10px] text-muted-foreground">Versão</p>
                <p className="text-base font-bold text-foreground mt-1">{currentRelease.version_name}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <p className="text-[10px] text-muted-foreground">Arquivo</p>
                <p className="text-sm font-semibold text-foreground mt-1 truncate">{currentRelease.file_name}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <p className="text-[10px] text-muted-foreground">Publicado em</p>
                <p className="text-sm font-semibold text-foreground mt-1">{formatDateTime(currentRelease.published_at)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-sm text-muted-foreground text-center">
              Nenhum APK publicado ainda.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">Versão</p>
              <Input
                value={form.versionName}
                onChange={(event) => setForm((prev) => ({ ...prev, versionName: event.target.value }))}
                placeholder="Ex: v1.12"
              />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">Nome do arquivo</p>
              <Input
                value={form.fileName}
                onChange={(event) => setForm((prev) => ({ ...prev, fileName: event.target.value }))}
                placeholder="Ex: escritoriorf-v1.12.apk"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-sky-500/30 bg-sky-500/10 px-3 py-3 text-sm font-medium text-sky-400 cursor-pointer hover:bg-sky-500/15 transition-colors">
              <Upload className="w-4 h-4" />
              {selectedFile ? selectedFile.name : 'Selecionar APK'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
            <Button
              onClick={() => uploadRelease.mutate()}
              disabled={uploadRelease.isPending || !selectedFile || !form.versionName.trim() || !form.fileName.trim()}
              className="sm:w-auto gap-2 bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold hover:from-sky-400 hover:to-cyan-300"
            >
              {uploadRelease.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Publicar versão
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            A data e hora da publicação são definidas automaticamente ao salvar a nova versão.
          </p>
        </CardContent>
      </Card>

      <Card className="border">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Histórico de versões</p>
              <p className="text-[11px] text-muted-foreground mt-1">As versões mais recentes ficam no topo.</p>
            </div>
            <Badge variant="outline">{releases.length} versão(ões)</Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : releases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-sm text-muted-foreground text-center">
              Nenhum release cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {releases.map((release) => (
                <div key={release.id} className="rounded-xl border border-border/60 bg-background/40 p-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{release.version_name}</p>
                      {release.is_current ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Atual
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{release.file_name}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{formatDateTime(release.published_at)}</span>
                      <span>{formatSize(release.size_bytes)}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => triggerDownload(release)}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoAppManager;