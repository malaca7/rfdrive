-- =============================================
-- Migration: Fix missing tables and columns
-- for AdminCorridas ride management system
-- Run this in phpMyAdmin
-- =============================================

SET NAMES 'utf8mb4';

-- 1. Create `logs` table (missing entirely)
CREATE TABLE IF NOT EXISTS `logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `usuario_id` VARCHAR(36),
  `acao` VARCHAR(255) NOT NULL,
  `tabela` VARCHAR(100),
  `registro_id` VARCHAR(36),
  `detalhes` TEXT,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario (usuario_id),
  INDEX idx_acao (acao),
  INDEX idx_data (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create `ofertas_corrida` table (missing entirely)
CREATE TABLE IF NOT EXISTS `ofertas_corrida` (
  `id` VARCHAR(36) PRIMARY KEY,
  `corrida_id` VARCHAR(36) NOT NULL,
  `motorista_id` VARCHAR(36) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'enviada',
  `rodada_disparo` INT DEFAULT 1,
  `score_ranking` DECIMAL(10,2),
  `distancia_km` DECIMAL(10,2),
  `enviado_em` DATETIME,
  `respondido_em` DATETIME,
  `tempo_resposta_segundos` INT,
  `motivo_rodada` VARCHAR(255),
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_corrida (corrida_id),
  INDEX idx_motorista (motorista_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create `platform_activity_log` table (used by logPlatformActivity)
CREATE TABLE IF NOT EXISTS `platform_activity_log` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36),
  `action` VARCHAR(255) NOT NULL,
  `category` VARCHAR(50),
  `entity` VARCHAR(100),
  `entity_id` VARCHAR(36),
  `details` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_category (category),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Fix `avaliacoes` table - add missing columns
-- Current: id, cliente, rating, comentario, criado_em
-- Needed: corrida_id, cliente_id, motorista_id, nota, tipo
ALTER TABLE `avaliacoes` ADD COLUMN IF NOT EXISTS `corrida_id` VARCHAR(36) AFTER `id`;
ALTER TABLE `avaliacoes` ADD COLUMN IF NOT EXISTS `cliente_id` VARCHAR(36) AFTER `corrida_id`;
ALTER TABLE `avaliacoes` ADD COLUMN IF NOT EXISTS `motorista_id` VARCHAR(36) AFTER `cliente_id`;
ALTER TABLE `avaliacoes` ADD COLUMN IF NOT EXISTS `nota` DECIMAL(3,1) AFTER `motorista_id`;
ALTER TABLE `avaliacoes` ADD COLUMN IF NOT EXISTS `tipo` VARCHAR(20) AFTER `comentario`;
ALTER TABLE `avaliacoes` ADD INDEX IF NOT EXISTS idx_corrida (`corrida_id`);
ALTER TABLE `avaliacoes` ADD INDEX IF NOT EXISTS idx_motorista (`motorista_id`);

-- 5. Fix `config_tarifas` - add missing columns
ALTER TABLE `config_tarifas` ADD COLUMN IF NOT EXISTS `taxa_bagagem_pequena` DECIMAL(10,2) DEFAULT 2.00;
ALTER TABLE `config_tarifas` ADD COLUMN IF NOT EXISTS `taxa_bagagem_media` DECIMAL(10,2) DEFAULT 5.00;
ALTER TABLE `config_tarifas` ADD COLUMN IF NOT EXISTS `taxa_bagagem_grande` DECIMAL(10,2) DEFAULT 7.00;

-- 6. Fix `recibos` table - add missing columns
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `corrida_id` VARCHAR(36) AFTER `id`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `cliente_id` VARCHAR(36) AFTER `corrida_id`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `valor_total` DECIMAL(10,2) AFTER `cliente_id`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `taxa_plataforma` DECIMAL(10,2) AFTER `valor_total`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `valor_motorista` DECIMAL(10,2) AFTER `taxa_plataforma`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `forma_pagamento` VARCHAR(20) DEFAULT 'dinheiro' AFTER `valor_motorista`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `observacoes` TEXT AFTER `forma_pagamento`;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `gerado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE `recibos` ADD COLUMN IF NOT EXISTS `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE `recibos` ADD INDEX IF NOT EXISTS idx_corrida (`corrida_id`);
ALTER TABLE `recibos` ADD INDEX IF NOT EXISTS idx_cliente (`cliente_id`);

-- 7. Fix `historico_precos` - add missing columns
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `origem_localidade_id` VARCHAR(36) AFTER `corrida_id`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `destino_localidade_id` VARCHAR(36) AFTER `origem_localidade_id`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `preco_rota_id` VARCHAR(36) AFTER `destino_localidade_id`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `regra_horario_id` VARCHAR(36) AFTER `preco_rota_id`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `preco_base` DECIMAL(10,2) AFTER `regra_horario_id`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `ajuste_aplicado` VARCHAR(255) AFTER `preco_base`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `origem_regra` VARCHAR(100) AFTER `preco_final`;
ALTER TABLE `historico_precos` ADD COLUMN IF NOT EXISTS `detalhes` TEXT AFTER `origem_regra`;

-- 8. Fix `corridas` table - ensure updated_at exists
ALTER TABLE `corridas` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Done!
SELECT 'Migration completed successfully' AS status;
