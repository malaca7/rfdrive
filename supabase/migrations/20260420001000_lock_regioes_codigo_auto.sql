-- ================================================================
-- Regioes: codigo numerico unico, fixo e gerado automaticamente
-- ================================================================

CREATE OR REPLACE FUNCTION public.ensure_regioes_precos_codigo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo IS NULL THEN
    NEW.codigo := nextval('public.regioes_precos_codigo_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regioes_precos_codigo_auto ON public.regioes_precos;
CREATE TRIGGER trg_regioes_precos_codigo_auto
BEFORE INSERT ON public.regioes_precos
FOR EACH ROW
EXECUTE FUNCTION public.ensure_regioes_precos_codigo();

CREATE OR REPLACE FUNCTION public.prevent_regioes_precos_codigo_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION 'codigo da regiao e fixo e nao pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regioes_precos_codigo_immutable ON public.regioes_precos;
CREATE TRIGGER trg_regioes_precos_codigo_immutable
BEFORE UPDATE ON public.regioes_precos
FOR EACH ROW
EXECUTE FUNCTION public.prevent_regioes_precos_codigo_update();

NOTIFY pgrst, 'reload schema';
