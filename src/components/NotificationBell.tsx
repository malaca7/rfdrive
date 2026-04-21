import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Info, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { requestNotificationPermission, showNativeNotification } from '@/lib/native-notifications';
import { createPortal } from 'react-dom';

type Notification = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'alerta' | 'sucesso';
  created_at: string;
};

const TIPO_ICON: Record<string, React.ReactNode> = {
  info: <Info className="w-3.5 h-3.5 text-blue-400" />,
  alerta: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  sucesso: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
};

export default function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);

  // Capture bell position when opening (for desktop dropdown)
  useEffect(() => {
    if (open && bellRef.current) {
      setBellRect(bellRef.current.getBoundingClientRect());
    }
  }, [open]);

  // Close on outside click/touch
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (bellRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // Lock scroll properly for both mobile browsers and Capacitor WebView
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    // Save originals
    const origBodyOverflow = body.style.overflow;
    const origBodyPos = body.style.position;
    const origBodyTop = body.style.top;
    const origBodyWidth = body.style.width;
    const origHtmlOverflow = html.style.overflow;
    // Apply lock
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = origBodyOverflow;
      body.style.position = origBodyPos;
      body.style.top = origBodyTop;
      body.style.width = origBodyWidth;
      html.style.overflow = origHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const userTipo = String(user?.tipo || '').toLowerCase();
  const isAdmin = userTipo === 'admin' || userTipo === 'ceo';

  const { data: notifications = [] } = useQuery({
    queryKey: ['user-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Fetch group notifications + user-specific ones
      let q = (supabase as any)
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (isAdmin) {
        q = q.or(`destinatario.eq.todos,destinatario.eq.admins,user_id.eq.${user.id}`);
      } else {
        q = q.or(`destinatario.eq.todos,destinatario.eq.motoristas,user_id.eq.${user.id}`);
      }
      // Only show notifications created after user registration
      if (user.created_at) {
        q = q.gte('created_at', user.created_at);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: reads = [] } = useQuery({
    queryKey: ['notification-reads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await (supabase as any)
        .from('notification_reads')
        .select('notification_id, read_at')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []) as { notification_id: string; read_at: string }[];
    },
    enabled: !!user?.id,
  });

  // Build read lookup — hide all read notifications immediately
  const readMap = new Map(reads.map(r => [r.notification_id, r.read_at]));
  const visibleNotifications = notifications.filter(n => !readMap.has(n.id));
  const unreadCount = visibleNotifications.length;

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) return;
      const { error } = await (supabase as any)
        .from('notification_reads')
        .upsert({ notification_id: notificationId, user_id: user.id }, { onConflict: 'notification_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-reads'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      if (!visibleNotifications.length) return;
      const rows = visibleNotifications.map(n => ({ notification_id: n.id, user_id: user!.id }));
      const { error } = await (supabase as any)
        .from('notification_reads')
        .upsert(rows, { onConflict: 'notification_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-reads'] }),
  });

  // Realtime — only refresh queries, native push is handled by FCM
  useEffect(() => {
    requestNotificationPermission();
    const channel = supabase.channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        const row = payload?.new;
        if (!row) return;
        // Only process notifications relevant to this user
        const dest = row.destinatario;
        const isForMe =
          dest === 'todos' ||
          (dest === 'motoristas' && !isAdmin) ||
          (dest === 'admins' && isAdmin) ||
          (dest === 'usuario' && row.user_id === user?.id);
        if (!isForMe) return;
        qc.invalidateQueries({ queryKey: ['user-notifications'] });
        // Fallback: show local notification if FCM push didn't arrive (web or fallback)
        if (row.titulo) showNativeNotification({ title: row.titulo, body: row.mensagem || '' });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, isAdmin, user?.id]);

  const close = useCallback(() => setOpen(false), []);

  // ── Notification list (shared between mobile & desktop) ──
  const notifList = (
    <div className="overflow-y-auto overscroll-contain flex-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      {visibleNotifications.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhuma notificação
        </div>
      ) : (
        visibleNotifications.map(n => {
          return (
            <div
              key={n.id}
              className="px-3 py-2.5 border-b border-border/20 flex items-start gap-2.5 transition-colors active:bg-muted/30 bg-accent/5"
            >
              <div className="mt-0.5 shrink-0">{TIPO_ICON[n.tipo] || TIPO_ICON.info}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">{n.titulo}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.mensagem}</p>
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button
                onClick={() => markReadMutation.mutate(n.id)}
                className="mt-1 p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all shrink-0"
                title="Marcar como lida"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  // ── Header (shared) ──
  const header = (
    <div className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between shrink-0">
      <span className="text-sm font-semibold">Notificações</span>
      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full hover:bg-accent/20 transition-all"
          >
            Ler todas
          </button>
        )}
        <button
          onClick={close}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ── Portal overlay ──
  const overlay = open ? createPortal(
    <>
      {/* Backdrop — full screen, blocks interaction */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 notif-backdrop-enter"
        onClick={close}
        style={{ touchAction: 'none' }}
      />

      {/* Mobile: centered card overlay. Desktop: dropdown below bell */}
      <div
        ref={panelRef}
        className="fixed z-[9999] notif-panel-enter
          inset-x-3 top-16 bottom-auto max-h-[70vh]
          sm:inset-auto sm:max-h-[420px] sm:w-80"
        style={
          bellRect && window.innerWidth >= 640
            ? { top: bellRect.bottom + 8, right: Math.max(12, window.innerWidth - bellRect.right) }
            : undefined
        }
      >
        <div className="bg-background rounded-2xl border border-border/40 shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
          style={{ maxHeight: 'inherit' }}
        >
          {header}
          {notifList}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={bellRef}
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all relative"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 sm:px-1 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {overlay}
    </>
  );
}
