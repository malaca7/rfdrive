import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, CheckCircle, ChevronDown, Info, Shield, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const APP_NAME = 'Escritório RF';
const ICON_URL = import.meta.env.BASE_URL + 'app-icon.png';

type PublicAppRelease = Pick<
  Database['public']['Tables']['app_releases']['Row'],
  'version_name' | 'file_name' | 'public_url' | 'size_bytes' | 'published_at'
>;

const INSTALL_STEPS = [
  { step: 1, title: 'Baixe o APK', desc: 'Toque no botão acima' },
  { step: 2, title: 'Permita a instalação', desc: 'Configurações > Fontes desconhecidas' },
  { step: 3, title: 'Instale e abra', desc: 'Faça login com sua conta' },
];

export default function DownloadApp() {
  const [downloading, setDownloading] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const { data: currentRelease, isLoading } = useQuery({
    queryKey: ['public-app-release'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('version_name, file_name, public_url, size_bytes, published_at')
        .eq('is_current', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PublicAppRelease | null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatVersion = (value: string) => (value.toLowerCase().startsWith('v') ? value : `v${value}`);

  const apkSize = currentRelease?.size_bytes ? `${(currentRelease.size_bytes / (1024 * 1024)).toFixed(1)}` : null;

  const handleDownload = () => {
    if (!currentRelease?.public_url) return;
    setDownloading(true);
    const a = document.createElement('a');
    a.href = currentRelease.public_url;
    a.download = currentRelease.file_name;
    a.click();
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white flex items-center justify-center p-4">
      {/* BG glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[40%] h-[40%] bg-violet-600/6 rounded-full blur-[100px]" />
      </div>

      <div
        className="relative z-10 w-full max-w-sm space-y-5"
        style={{
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header — icon + name */}
        <div className="text-center space-y-2">
          <img
            src={ICON_URL}
            alt={APP_NAME}
            className="w-20 h-20 mx-auto rounded-[20px] shadow-2xl shadow-indigo-500/20"
          />
          <h1 className="text-xl font-extrabold tracking-tight">{APP_NAME}</h1>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-4 space-y-3.5">
          {/* Version row */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-bold text-lg">{currentRelease ? formatVersion(currentRelease.version_name) : 'Sem release'}</span>
              {apkSize && <span className="text-white/30 text-xs ml-1.5">({apkSize} MB)</span>}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              {currentRelease ? formatDateTime(currentRelease.published_at) : 'Aguardando publicação'}
            </div>
          </div>

          {/* Features mini */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-2 text-[11px] text-white/50">
              <Bell className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              Push em tempo real
            </div>
            <div className="flex-1 flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-2 text-[11px] text-white/50">
              <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              Seguro & confiável
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading || !currentRelease || isLoading}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all relative overflow-hidden group disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)',
              boxShadow: '0 6px 24px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Baixando...
              </>
            ) : isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Carregando release...
              </>
            ) : !currentRelease ? (
              <>
                <Info className="w-4 h-4" />
                Release indisponível
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Baixar APK
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-white/20">Android 6.0+ {currentRelease ? `• ${currentRelease.file_name}` : ''}</p>
        </div>

        {/* Install steps — collapsible */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <button
            onClick={() => setShowSteps(s => !s)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Como instalar?
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-300 ${showSteps ? 'rotate-180' : ''}`} />
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: showSteps ? '200px' : '0', opacity: showSteps ? 1 : 0 }}
          >
            <div className="px-3.5 pb-3 space-y-2">
              {INSTALL_STEPS.map(s => (
                <div key={s.step} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{s.title}</p>
                    <p className="text-[10px] text-white/35">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/15">{APP_NAME} © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
