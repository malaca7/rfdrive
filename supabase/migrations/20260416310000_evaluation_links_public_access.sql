-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Permitir acesso público (anon) aos links de avaliação              ║
-- ║  Necessário para que qualquer pessoa possa abrir e responder        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Tabela evaluation_links: leitura e escrita via anon key
GRANT SELECT, UPDATE ON public.evaluation_links TO anon;
GRANT ALL    ON public.evaluation_links TO authenticated;

-- Tabela users: leitura via anon (necessário para buscar nome do motorista)
GRANT SELECT ON public.users TO anon;

-- Tabela avaliacoes_admin: inserção via anon (gravar avaliação)
GRANT SELECT, INSERT ON public.avaliacoes_admin TO anon;

-- Função mark_expired_eval_links: executável por qualquer role
GRANT EXECUTE ON FUNCTION public.mark_expired_eval_links() TO anon, authenticated;
