-- =============================================
-- SISTEMA WHATSAPP - EVOLUÇÃO DO SCHEMA
-- =============================================

-- 1. Dropar check constraint antiga de status
ALTER TABLE public.corridas DROP CONSTRAINT IF EXISTS corridas_status_check;

-- 2. Adicionar novos campos em corridas (evoluindo para solicitações)
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS canal_origem text DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS origem_audio_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS observacoes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confianca_ia numeric(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text DEFAULT NULL;

-- 3. Migrar status existentes para o novo fluxo
-- nova → aguardando_motorista → aceita → em_analise → aprovada → nao_realizada → recusada
UPDATE public.corridas SET status = 'aguardando_motorista' WHERE status = 'pendente';
UPDATE public.corridas SET status = 'em_analise' WHERE status = 'concluida';
UPDATE public.corridas SET status = 'recusada' WHERE status = 'rejeitada';

-- 4. Recriar check constraint com novos valores
ALTER TABLE public.corridas ADD CONSTRAINT corridas_status_check
  CHECK (status IN ('nova', 'aguardando_motorista', 'aceita', 'em_analise', 'aprovada', 'nao_realizada', 'recusada'));

-- 3. Adicionar campo ativo em users (se não existir via status)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

-- Sincronizar campo ativo com status existente
UPDATE public.users SET ativo = (status = 'ativo');

-- 4. Criar tabela de aprovações (audit trail admin)
CREATE TABLE IF NOT EXISTS public.aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES public.corridas(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES public.users(id) NOT NULL,
  status_admin text NOT NULL CHECK (status_admin IN ('aprovada', 'nao_realizada', 'recusada')),
  observacao text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_corridas_canal ON public.corridas(canal_origem);
CREATE INDEX IF NOT EXISTS idx_corridas_status ON public.corridas(status);
CREATE INDEX IF NOT EXISTS idx_corridas_cliente ON public.corridas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_corridas_motorista ON public.corridas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_solicitacao ON public.aprovacoes(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_admin ON public.aprovacoes(admin_id);
CREATE INDEX IF NOT EXISTS idx_users_telefone ON public.users(telefone);
CREATE INDEX IF NOT EXISTS idx_users_ativo ON public.users(ativo);

-- 6. RLS para aprovacoes
ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler aprovacoes" ON public.aprovacoes
  FOR SELECT USING (true);

CREATE POLICY "Admins podem inserir aprovacoes" ON public.aprovacoes
  FOR INSERT WITH CHECK (true);
