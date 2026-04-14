-- Adicionar coluna tem_bagagem na tabela corridas
ALTER TABLE public.corridas 
ADD COLUMN IF NOT EXISTS tem_bagagem BOOLEAN DEFAULT false;

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';