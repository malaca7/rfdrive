-- ==================== SQL INICIAL - RIDE-AI ====================
-- Importar este arquivo após schema.sql para adicionar dados iniciais
-- 
-- Importe em: phpMyAdmin → SQL → Colar conteúdo e executar
-- ou via: mysql -u malacaco_rfdrive -p malacaco_rfdrive < init-data.sql

-- ==================== LIMPEZA (OPCIONAL) ====================
-- Descomente se quiser resetar tudo:
-- DELETE FROM users;
-- DELETE FROM corridas;
-- DELETE FROM avaliacoes;
-- DELETE FROM precos_rotas;
-- DELETE FROM localidades;

-- ==================== USUÁRIOS DE TESTE ====================

-- Admin padrão
INSERT INTO users (id, nome, telefone, senha, email, tipo, roles, status, ativo, created_at)
VALUES (
  'user_admin_001',
  'Admin System',
  '11999999999',
  '$2y$10$sFf3qPQIz3QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6',
  'admin@rfdrive.com',
  'admin',
  JSON_ARRAY('admin', 'ceo'),
  'ativo',
  true,
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Cliente de teste
INSERT INTO users (id, nome, telefone, senha, email, tipo, roles, status, ativo, created_at)
VALUES (
  'user_cliente_001',
  'João Silva',
  '11998888888',
  '$2y$10$sFf3qPQIz3QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6',
  'joao@example.com',
  'cliente',
  JSON_ARRAY('cliente'),
  'ativo',
  true,
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Motorista de teste
INSERT INTO users (id, nome, telefone, senha, email, tipo, roles, status, ativo, veiculo_marca, veiculo_modelo, veiculo_placa, created_at)
VALUES (
  'user_motorista_001',
  'Maria Santos',
  '11997777777',
  '$2y$10$sFf3qPQIz3QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6QN6',
  'maria@example.com',
  'motorista',
  JSON_ARRAY('motorista'),
  'ativo',
  true,
  'Toyota',
  'Corolla',
  'ABC1234',
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== LOCALIDADES DE TESTE ====================

INSERT INTO localidades (id, nome, latitude, longitude, tipo, ativo)
VALUES 
  ('loc_centro_001', 'Centro - São Paulo', -23.5505, -46.6333, 'hub', true),
  ('loc_aeroporto_001', 'Aeroporto - GRU', -23.4356, -46.4731, 'airport', true),
  ('loc_vila_001', 'Vila Madalena', -23.5530, -46.6897, 'neighborhood', true),
  ('loc_pinheiros_001', 'Pinheiros', -23.5596, -46.6886, 'neighborhood', true),
  ('loc_consolacao_001', 'Consolação', -23.5542, -46.6635, 'neighborhood', true)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==================== VERIFICAÇÃO ====================

-- Após executar, verifique com:
-- SELECT * FROM users;
-- SELECT * FROM localidades;
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM localidades;

-- ==================== NOTAS ====================
-- 
-- Senhas de teste (se usar com password_verify):
-- Todas usam hash genérico - em produção gerar com:
-- php -r "echo password_hash('senha123', PASSWORD_BCRYPT);"
--
-- Telefones de teste:
-- Admin: 11999999999
-- Cliente: 11998888888
-- Motorista: 11997777777
--
-- Para fazer login no aplicativo:
-- Telefone: 11999999999
-- Senha: admin123 (ou conforme definido)
--
