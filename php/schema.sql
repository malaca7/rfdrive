-- ==================== SCHEMA DO BANCO DE DADOS MYSQL ====================
-- Este arquivo contém todas as tabelas necessárias para migrar de Supabase para MySQL
-- Importe este arquivo no phpMyAdmin para criar a estrutura do banco

-- ==================== USERS ====================
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `telefone` VARCHAR(20) UNIQUE NOT NULL,
  `senha` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `tipo` ENUM('cliente', 'motorista', 'admin') DEFAULT 'cliente',
  `roles` JSON,
  `status` ENUM('ativo', 'banido', 'suspenso') DEFAULT 'ativo',
  `ativo` BOOLEAN DEFAULT TRUE,
  `veiculo_marca` VARCHAR(100),
  `veiculo_modelo` VARCHAR(100),
  `veiculo_cor` VARCHAR(50),
  `veiculo_placa` VARCHAR(20),
  `documento_cpf` VARCHAR(20),
  `documento_cnh` VARCHAR(20),
  `documento_crv` VARCHAR(50),
  `data_nascimento` DATE,
  `endereco` TEXT,
  `foto_url` VARCHAR(500),
  `rating_media` DECIMAL(3,2),
  `total_avaliacoes` INT DEFAULT 0,
  `banco_dados` VARCHAR(50),
  `conta_banco` VARCHAR(50),
  `chave_pix` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_telefone (telefone),
  INDEX idx_tipo (tipo),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CORRIDAS (RIDES) ====================
CREATE TABLE IF NOT EXISTS `corridas` (
  `id` VARCHAR(36) PRIMARY KEY,
  `cliente_id` VARCHAR(36) NOT NULL,
  `motorista_id` VARCHAR(36),
  `origem_texto` VARCHAR(500) NOT NULL,
  `destino_texto` VARCHAR(500) NOT NULL,
  `origem_id` VARCHAR(36),
  `destino_id` VARCHAR(36),
  `horario_estimado` DATETIME,
  `status` ENUM('em_analise', 'aprovada', 'nao_realizada', 'em_progresso', 'concluida', 'cancelada') DEFAULT 'em_analise',
  `aprovado_admin` BOOLEAN DEFAULT FALSE,
  `valor` DECIMAL(10,2),
  `valor_estimado` DECIMAL(10,2),
  `distancia_km` DECIMAL(10,2),
  `observacao_motorista` TEXT,
  `origem_editada` VARCHAR(500),
  `destino_editado` VARCHAR(500),
  `edicao_pendente` BOOLEAN DEFAULT FALSE,
  `edicao_aprovada` BOOLEAN,
  `concluida_at` DATETIME,
  `origem_audio_url` VARCHAR(500),
  `observacoes` TEXT,
  `confianca_ia` DECIMAL(5,2),
  `whatsapp_message_id` VARCHAR(100),
  `preco_regra_aplicada` VARCHAR(100),
  `preco_detalhes` JSON,
  `tem_bagagem` BOOLEAN,
  `tracking_ativo` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES users(id),
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_motorista (motorista_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== APROVAÇÕES ====================
CREATE TABLE IF NOT EXISTS `aprovacoes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `solicitacao_id` VARCHAR(36) NOT NULL,
  `admin_id` VARCHAR(36) NOT NULL,
  `status_admin` ENUM('aprovada', 'nao_realizada', 'recusada') DEFAULT 'aprovada',
  `observacao` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (solicitacao_id) REFERENCES corridas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== AVALIAÇÕES ====================
CREATE TABLE IF NOT EXISTS `avaliacoes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `corrida_id` VARCHAR(36) NOT NULL,
  `cliente_id` VARCHAR(36) NOT NULL,
  `motorista_id` VARCHAR(36) NOT NULL,
  `nota` DECIMAL(3,2) NOT NULL,
  `comentario` TEXT,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (corrida_id) REFERENCES corridas(id),
  FOREIGN KEY (cliente_id) REFERENCES users(id),
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_motorista (motorista_id),
  INDEX idx_corrida (corrida_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== EVALUATION LINKS (Links Públicos de Avaliação) ====================
CREATE TABLE IF NOT EXISTS `evaluation_links` (
  `id` VARCHAR(36) PRIMARY KEY,
  `motorista_id` VARCHAR(36) NOT NULL,
  `corrida_id` VARCHAR(36),
  `link_token` VARCHAR(100) UNIQUE NOT NULL,
  `visitado` BOOLEAN DEFAULT FALSE,
  `avaliado` BOOLEAN DEFAULT FALSE,
  `expira_em` DATETIME,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  FOREIGN KEY (corrida_id) REFERENCES corridas(id),
  INDEX idx_token (link_token),
  INDEX idx_motorista (motorista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== APP RELEASES ====================
CREATE TABLE IF NOT EXISTS `app_releases` (
  `id` VARCHAR(36) PRIMARY KEY,
  `version_name` VARCHAR(50) NOT NULL,
  `version_code` INT,
  `file_name` VARCHAR(255) NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `public_url` VARCHAR(500),
  `mime_type` VARCHAR(100),
  `size_bytes` BIGINT,
  `is_current` BOOLEAN DEFAULT FALSE,
  `is_beta` BOOLEAN DEFAULT FALSE,
  `changelog` TEXT,
  `uploaded_by` VARCHAR(36),
  `published_at` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_current (is_current),
  INDEX idx_version (version_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== LOCALIDADES ====================
CREATE TABLE IF NOT EXISTS `localidades` (
  `id` VARCHAR(36) PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` ENUM('bairro', 'local', 'rua', 'ponto', 'cidade', 'zona', 'endereco') DEFAULT 'bairro',
  `parent_id` VARCHAR(36),
  `latitude` DECIMAL(10,8),
  `longitude` DECIMAL(11,8),
  `ativo` BOOLEAN DEFAULT TRUE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES localidades(id),
  INDEX idx_nome (nome),
  INDEX idx_tipo (tipo),
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== PREÇOS DE ROTAS ====================
CREATE TABLE IF NOT EXISTS `precos_rotas` (
  `id` VARCHAR(36) PRIMARY KEY,
  `origem_id` VARCHAR(36) NOT NULL,
  `destino_id` VARCHAR(36) NOT NULL,
  `preco_fixo` DECIMAL(10,2),
  `preco_minimo` DECIMAL(10,2),
  `preco_km` DECIMAL(10,2),
  `prioridade` INT DEFAULT 0,
  `ativo` BOOLEAN DEFAULT TRUE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (origem_id) REFERENCES localidades(id),
  FOREIGN KEY (destino_id) REFERENCES localidades(id),
  INDEX idx_rota (origem_id, destino_id),
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== REGRAS DE HORÁRIO ====================
CREATE TABLE IF NOT EXISTS `regras_horario` (
  `id` VARCHAR(36) PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `hora_inicio` TIME NOT NULL,
  `hora_fim` TIME NOT NULL,
  `tipo_ajuste` ENUM('percentual', 'fixo') DEFAULT 'percentual',
  `valor_ajuste` DECIMAL(10,2) NOT NULL,
  `descricao` TEXT,
  `ativo` BOOLEAN DEFAULT TRUE,
  `data_inicio` DATE,
  `data_fim` DATE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ativo (ativo),
  INDEX idx_horario (hora_inicio, hora_fim)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== TABELA DE PREÇOS (alternativa) ====================
CREATE TABLE IF NOT EXISTS `tabela_precos` (
  `id` VARCHAR(36) PRIMARY KEY,
  `origem` VARCHAR(255) NOT NULL,
  `destino` VARCHAR(255) NOT NULL,
  `valor` DECIMAL(10,2) NOT NULL,
  `regiao` VARCHAR(100),
  `ativo` BOOLEAN DEFAULT TRUE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_origem_destino (origem, destino),
  INDEX idx_regiao (regiao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== REGIÕES DE PREÇOS ====================
CREATE TABLE IF NOT EXISTS `regioes_precos` (
  `id` VARCHAR(36) PRIMARY KEY,
  `nome` VARCHAR(100) NOT NULL UNIQUE,
  `ativo` BOOLEAN DEFAULT TRUE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== HISTÓRICO DE PREÇOS ====================
CREATE TABLE IF NOT EXISTS `historico_precos` (
  `id` VARCHAR(36) PRIMARY KEY,
  `corrida_id` VARCHAR(36),
  `origem_localidade_id` VARCHAR(36),
  `destino_localidade_id` VARCHAR(36),
  `preco_rota_id` VARCHAR(36),
  `regra_horario_id` VARCHAR(36),
  `preco_base` DECIMAL(10,2),
  `ajuste_aplicado` VARCHAR(255),
  `preco_final` DECIMAL(10,2) NOT NULL,
  `origem_regra` VARCHAR(100),
  `detalhes` JSON,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (corrida_id) REFERENCES corridas(id),
  FOREIGN KEY (origem_localidade_id) REFERENCES localidades(id),
  FOREIGN KEY (destino_localidade_id) REFERENCES localidades(id),
  FOREIGN KEY (preco_rota_id) REFERENCES precos_rotas(id),
  FOREIGN KEY (regra_horario_id) REFERENCES regras_horario(id),
  INDEX idx_corrida (corrida_id),
  INDEX idx_data (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== LOCALIZAÇÃO DE MOTORISTAS ====================
CREATE TABLE IF NOT EXISTS `localizacao_motorista` (
  `motorista_id` VARCHAR(36) PRIMARY KEY,
  `latitude` DECIMAL(10,8) NOT NULL,
  `longitude` DECIMAL(11,8) NOT NULL,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_localizacao (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== OFERTAS DE CORRIDA ====================
CREATE TABLE IF NOT EXISTS `ofertas_corrida` (
  `id` VARCHAR(36) PRIMARY KEY,
  `corrida_id` VARCHAR(36) NOT NULL,
  `motorista_id` VARCHAR(36) NOT NULL,
  `status` ENUM('enviada', 'aceita', 'recusada', 'expirada', 'cancelada') DEFAULT 'enviada',
  `rodada_disparo` INT DEFAULT 1,
  `score_ranking` DECIMAL(10,2),
  `distancia_km` DECIMAL(10,2),
  `enviado_em` DATETIME NOT NULL,
  `respondido_em` DATETIME,
  `tempo_resposta_segundos` INT,
  `motivo_rodada` VARCHAR(255),
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (corrida_id) REFERENCES corridas(id),
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_corrida (corrida_id),
  INDEX idx_motorista (motorista_id),
  INDEX idx_status (status),
  INDEX idx_rodada (rodada_disparo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MÉTRICAS DE MOTORISTA ====================
CREATE TABLE IF NOT EXISTS `metricas_motorista` (
  `id` VARCHAR(36) PRIMARY KEY,
  `motorista_id` VARCHAR(36) UNIQUE NOT NULL,
  `media_tempo_aceite` DECIMAL(10,2),
  `total_corridas_aceitas` INT DEFAULT 0,
  `total_corridas_recusadas` INT DEFAULT 0,
  `total_corridas_expiradas` INT DEFAULT 0,
  `taxa_aceite` DECIMAL(5,2),
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_motorista (motorista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== RECIBOS ====================
CREATE TABLE IF NOT EXISTS `recibos` (
  `id` VARCHAR(36) PRIMARY KEY,
  `corrida_id` VARCHAR(36) NOT NULL,
  `cliente_id` VARCHAR(36) NOT NULL,
  `motorista_id` VARCHAR(36) NOT NULL,
  `valor_total` DECIMAL(10,2) NOT NULL,
  `taxa_plataforma` DECIMAL(10,2),
  `valor_motorista` DECIMAL(10,2),
  `forma_pagamento` ENUM('dinheiro', 'cartao', 'pix', 'credito') DEFAULT 'dinheiro',
  `observacoes` TEXT,
  `gerado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (corrida_id) REFERENCES corridas(id),
  FOREIGN KEY (cliente_id) REFERENCES users(id),
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_corrida (corrida_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_motorista (motorista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== NOTIFICAÇÕES ====================
CREATE TABLE IF NOT EXISTS `notificacoes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `usuario_id` VARCHAR(36) NOT NULL,
  `titulo` VARCHAR(255),
  `mensagem` TEXT NOT NULL,
  `tipo` VARCHAR(50),
  `lida` BOOLEAN DEFAULT FALSE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES users(id),
  INDEX idx_usuario (usuario_id),
  INDEX idx_lida (lida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== LOGS ====================
CREATE TABLE IF NOT EXISTS `logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `usuario_id` VARCHAR(36),
  `acao` VARCHAR(255) NOT NULL,
  `tabela` VARCHAR(100),
  `registro_id` VARCHAR(36),
  `detalhes` JSON,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES users(id),
  INDEX idx_usuario (usuario_id),
  INDEX idx_acao (acao),
  INDEX idx_data (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CONFIG TARIFAS ====================
CREATE TABLE IF NOT EXISTS `config_tarifas` (
  `id` VARCHAR(36) PRIMARY KEY,
  `chave` VARCHAR(255) UNIQUE NOT NULL,
  `valor` JSON NOT NULL,
  `tipo` VARCHAR(50),
  `descricao` TEXT,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chave (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MENSAGENS WHATSAPP ====================
CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `telefone` VARCHAR(20) NOT NULL,
  `mensagem` TEXT,
  `tipo` ENUM('entrada', 'saida') DEFAULT 'entrada',
  `status` VARCHAR(50),
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_telefone (telefone),
  INDEX idx_data (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== PAGAMENTOS MERCADOPAGO ====================
CREATE TABLE IF NOT EXISTS `pagamentos_mercadopago` (
  `id` VARCHAR(36) PRIMARY KEY,
  `mercadopago_id` VARCHAR(100) UNIQUE,
  `usuario_id` VARCHAR(36),
  `status` VARCHAR(50),
  `valor` DECIMAL(10,2),
  `dados` JSON,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES users(id),
  INDEX idx_usuario (usuario_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CREDENCIAIS ====================
CREATE TABLE IF NOT EXISTS `credenciais` (
  `id` VARCHAR(36) PRIMARY KEY,
  `motorista_id` VARCHAR(36) NOT NULL,
  `tipo` VARCHAR(50),
  `numero` VARCHAR(100),
  `vencimento` DATE,
  `arquivo_url` VARCHAR(500),
  `status` ENUM('valida', 'vencida', 'pendente_analise', 'rejeitada') DEFAULT 'pendente_analise',
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_id) REFERENCES users(id),
  INDEX idx_motorista (motorista_id),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar índices adicionais para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_document ON users(documento_cpf);
CREATE INDEX idx_corridas_motorista_status ON corridas(motorista_id, status);
CREATE INDEX idx_corridas_cliente_status ON corridas(cliente_id, status);
