import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PlatformConfig = {
  id: string;
  nome_plataforma: string;
  taxa_semanal_motorista: number;
  cor_primaria: string;
  cor_secundaria: string;
  cor_terciaria: string;
  cor_sucesso: string;
  cor_alerta: string;
  cor_erro: string;
  cor_info: string;
  cor_botao_texto: string;
  cor_botao_fundo: string;
  cor_botao_borda: string;
  botao_borda_ativa: boolean;
  tema_border_radius: number;
  tema_card_opacidade: number;
  tema_fonte: string;
  tema_muted_offset: number;
  tema_gradiente_direcao: string;
  tema_botao_estilo: string;
  logo_url: string;
  badge_bg_url: string;
};

const DEFAULTS: Omit<PlatformConfig, 'id'> = {
  nome_plataforma: 'RF Drive',
  taxa_semanal_motorista: 0,
  cor_primaria: '#FFD000',
  cor_secundaria: '#0a0a0a',
  cor_terciaria: '#ffffff',
  cor_sucesso: '#22c55e',
  cor_alerta: '#f59e0b',
  cor_erro: '#ef4444',
  cor_info: '#3b82f6',
  cor_botao_texto: '#0a0a0a',
  cor_botao_fundo: '#FFD000',
  cor_botao_borda: '#FFD000',
  botao_borda_ativa: true,
  tema_border_radius: 16,
  tema_card_opacidade: 100,
  tema_fonte: 'Plus Jakarta Sans',
  tema_muted_offset: 46,
  tema_gradiente_direcao: '135deg',
  tema_botao_estilo: 'gradient',
  logo_url: '',
  badge_bg_url: '',
};

export function usePlatformConfig() {
  const { data } = useQuery({
    queryKey: ['config-plataforma'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_plataforma')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PlatformConfig | null;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    config: data,
    nomePlataforma: data?.nome_plataforma || DEFAULTS.nome_plataforma,
    corPrimaria: (data as any)?.cor_primaria || DEFAULTS.cor_primaria,
    corSecundaria: (data as any)?.cor_secundaria || DEFAULTS.cor_secundaria,
    corTerciaria: (data as any)?.cor_terciaria || DEFAULTS.cor_terciaria,
    corSucesso: (data as any)?.cor_sucesso || DEFAULTS.cor_sucesso,
    corAlerta: (data as any)?.cor_alerta || DEFAULTS.cor_alerta,
    corErro: (data as any)?.cor_erro || DEFAULTS.cor_erro,
    corInfo: (data as any)?.cor_info || DEFAULTS.cor_info,
    corBotaoTexto: (data as any)?.cor_botao_texto || DEFAULTS.cor_botao_texto,
    corBotaoFundo: (data as any)?.cor_botao_fundo || DEFAULTS.cor_botao_fundo,
    corBotaoBorda: (data as any)?.cor_botao_borda || DEFAULTS.cor_botao_borda,
    botaoBordaAtiva: (data as any)?.botao_borda_ativa ?? DEFAULTS.botao_borda_ativa,
    temaBorderRadius: (data as any)?.tema_border_radius ?? DEFAULTS.tema_border_radius,
    temaCardOpacidade: (data as any)?.tema_card_opacidade ?? DEFAULTS.tema_card_opacidade,
    temaFonte: (data as any)?.tema_fonte || DEFAULTS.tema_fonte,
    temaMutedOffset: (data as any)?.tema_muted_offset ?? DEFAULTS.tema_muted_offset,
    temaGradienteDirecao: (data as any)?.tema_gradiente_direcao || DEFAULTS.tema_gradiente_direcao,
    temaBotaoEstilo: (data as any)?.tema_botao_estilo || DEFAULTS.tema_botao_estilo,
    logoUrl: (data as any)?.logo_url || DEFAULTS.logo_url,
    badgeBgUrl: (data as any)?.badge_bg_url || DEFAULTS.badge_bg_url,
  };
}
