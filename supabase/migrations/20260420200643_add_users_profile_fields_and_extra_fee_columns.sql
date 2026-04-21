-- Perfil do motorista
ALTER TABLE public.users
	ADD COLUMN IF NOT EXISTS apelido text,
	ADD COLUMN IF NOT EXISTS data_nascimento date;

-- Taxas extras na configuracao global de tarifas
ALTER TABLE public.config_tarifas
	ADD COLUMN IF NOT EXISTS tarifa_mesmo_bairro numeric(10,2) NOT NULL DEFAULT 10.00,
	ADD COLUMN IF NOT EXISTS taxa_carro_6_tipo text NOT NULL DEFAULT 'fixo',
	ADD COLUMN IF NOT EXISTS taxa_carro_6_valor numeric(10,2) NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS taxa_parada_trajeto numeric(10,2) NOT NULL DEFAULT 3.00,
	ADD COLUMN IF NOT EXISTS taxa_parada_comum numeric(10,2) NOT NULL DEFAULT 5.00,
	ADD COLUMN IF NOT EXISTS taxa_parada_desvio numeric(10,2) NOT NULL DEFAULT 7.00,
	ADD COLUMN IF NOT EXISTS taxa_animal_pequeno numeric(10,2) NOT NULL DEFAULT 5.00,
	ADD COLUMN IF NOT EXISTS taxa_animal_medio numeric(10,2) NOT NULL DEFAULT 7.00;

-- Garante valores consistentes para linhas antigas
UPDATE public.config_tarifas
SET
	tarifa_mesmo_bairro = COALESCE(tarifa_mesmo_bairro, 10.00),
	taxa_carro_6_tipo = COALESCE(NULLIF(taxa_carro_6_tipo, ''), 'fixo'),
	taxa_carro_6_valor = COALESCE(taxa_carro_6_valor, 0),
	taxa_parada_trajeto = COALESCE(taxa_parada_trajeto, 3.00),
	taxa_parada_comum = COALESCE(taxa_parada_comum, 5.00),
	taxa_parada_desvio = COALESCE(taxa_parada_desvio, 7.00),
	taxa_animal_pequeno = COALESCE(taxa_animal_pequeno, 5.00),
	taxa_animal_medio = COALESCE(taxa_animal_medio, 7.00);

-- Valida tipo permitido da taxa de carro 6 lugares
ALTER TABLE public.config_tarifas
	DROP CONSTRAINT IF EXISTS config_tarifas_taxa_carro_6_tipo_check;

ALTER TABLE public.config_tarifas
	ADD CONSTRAINT config_tarifas_taxa_carro_6_tipo_check
	CHECK (taxa_carro_6_tipo IN ('fixo', 'percentual'));

NOTIFY pgrst, 'reload schema';
