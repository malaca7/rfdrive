-- Migration: Add advanced theme columns to config_plataforma

ALTER TABLE public.config_plataforma
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '#FFD000',
  ADD COLUMN IF NOT EXISTS cor_secundaria text DEFAULT '#0a0a0a',
  ADD COLUMN IF NOT EXISTS cor_terciaria text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS cor_sucesso text DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS cor_alerta text DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS cor_erro text DEFAULT '#ef4444',
  ADD COLUMN IF NOT EXISTS cor_info text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS tema_border_radius integer DEFAULT 16,
  ADD COLUMN IF NOT EXISTS tema_card_opacidade integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tema_fonte text DEFAULT 'Plus Jakarta Sans',
  ADD COLUMN IF NOT EXISTS tema_muted_offset integer DEFAULT 46,
  ADD COLUMN IF NOT EXISTS tema_gradiente_direcao text DEFAULT '135deg',
  ADD COLUMN IF NOT EXISTS tema_botao_estilo text DEFAULT 'gradient',
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge_bg_url text DEFAULT '';
