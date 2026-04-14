-- Fix: aprovacoes.admin_id FK sem ON DELETE CASCADE / ON UPDATE CASCADE
ALTER TABLE public.aprovacoes
  DROP CONSTRAINT IF EXISTS aprovacoes_admin_id_fkey;

ALTER TABLE public.aprovacoes
  ADD CONSTRAINT aprovacoes_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES public.users(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
