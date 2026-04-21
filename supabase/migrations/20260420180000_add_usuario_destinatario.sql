-- Allow 'usuario' as a destinatario value for individual notifications
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_destinatario_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_destinatario_check
  CHECK (destinatario IN ('todos', 'motoristas', 'admins', 'usuario'));

-- Index for user-specific notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id) WHERE user_id IS NOT NULL;
