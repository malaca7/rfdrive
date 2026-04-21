-- Migração: Simplificar status de corridas
-- Remove: nova, aguardando_motorista, aceita, a_caminho, em_corrida, recusada, finalizada
-- Mantém: em_analise, aprovada, nao_realizada

-- 1. Converter corridas com status antigos para os novos
UPDATE public.corridas SET status = 'em_analise'
  WHERE status IN ('nova', 'aguardando_motorista', 'aceita', 'a_caminho', 'em_corrida');

UPDATE public.corridas SET status = 'nao_realizada'
  WHERE status = 'recusada';

UPDATE public.corridas SET status = 'aprovada'
  WHERE status = 'finalizada';

-- 2. Atualizar constraint de status
ALTER TABLE public.corridas DROP CONSTRAINT IF EXISTS corridas_status_check;
ALTER TABLE public.corridas ADD CONSTRAINT corridas_status_check
  CHECK (status IN ('em_analise', 'aprovada', 'nao_realizada'));
