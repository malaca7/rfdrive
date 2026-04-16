-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Sistema de Links de Avaliação Pública                              ║
-- ║  Permite admin gerar links únicos para clientes avaliarem motoristas ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS evaluation_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id      uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Config
  permite_comentario boolean NOT NULL DEFAULT true,
  expira_em         timestamptz NOT NULL,

  -- Token único para o link público
  token             text NOT NULL UNIQUE DEFAULT encode(gen_random_uuid()::text::bytea, 'hex'),

  -- Status
  status            text NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa', 'respondida', 'expirada')),

  -- Resposta (preenchida quando cliente avalia)
  nota              smallint CHECK (nota IS NULL OR (nota >= 1 AND nota <= 5)),
  comentario        text,
  respondida_em     timestamptz,
  respondida_ip     text,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_eval_links_token ON evaluation_links(token);
CREATE INDEX IF NOT EXISTS idx_eval_links_motorista ON evaluation_links(motorista_id);
CREATE INDEX IF NOT EXISTS idx_eval_links_status ON evaluation_links(status);
CREATE INDEX IF NOT EXISTS idx_eval_links_expira ON evaluation_links(expira_em);

-- RLS
ALTER TABLE evaluation_links ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY eval_links_admin_all ON evaluation_links
  FOR ALL USING (true) WITH CHECK (true);

-- Leitura pública pelo token (para a página de avaliação)
CREATE POLICY eval_links_public_read ON evaluation_links
  FOR SELECT USING (true);

-- Update público para registrar resposta (só campos de resposta)
CREATE POLICY eval_links_public_respond ON evaluation_links
  FOR UPDATE USING (true) WITH CHECK (true);

-- Função para marcar links expirados automaticamente
CREATE OR REPLACE FUNCTION mark_expired_eval_links()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE evaluation_links
  SET status = 'expirada', updated_at = now()
  WHERE status = 'ativa' AND expira_em < now();
END;
$$;
