-- =============================================
-- CÁLCULO DE ROTA: distância e valor estimado
-- =============================================

ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS distancia_km numeric(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(10,2) DEFAULT NULL;
