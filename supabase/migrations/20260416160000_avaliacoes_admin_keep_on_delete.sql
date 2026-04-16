-- Fix: avaliacoes_admin.admin_id deve usar SET NULL ao invés de CASCADE
-- Quando admin é excluído, avaliações ficam salvas no motorista
ALTER TABLE public.avaliacoes_admin
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.avaliacoes_admin
  DROP CONSTRAINT IF EXISTS avaliacoes_admin_admin_id_fkey;

ALTER TABLE public.avaliacoes_admin
  ADD CONSTRAINT avaliacoes_admin_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES public.users(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
