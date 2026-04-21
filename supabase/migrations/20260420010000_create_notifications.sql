-- ================================================================
-- Sistema de Notificações
-- ================================================================

-- Tabela principal de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'alerta', 'sucesso')),
  destinatario text NOT NULL DEFAULT 'todos' CHECK (destinatario IN ('todos', 'motoristas', 'admins')),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  lida boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela para tracking de leitura por usuário
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tipo ON public.notifications (tipo);
CREATE INDEX IF NOT EXISTS idx_notifications_destinatario ON public.notifications (destinatario);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON public.notification_reads (notification_id);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_all_access" ON public.notifications;
CREATE POLICY "notifications_all_access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notification_reads_all_access" ON public.notification_reads;
CREATE POLICY "notification_reads_all_access" ON public.notification_reads FOR ALL USING (true) WITH CHECK (true);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_publication p ON pr.prpubid = p.oid
    WHERE c.relname = 'notifications' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
