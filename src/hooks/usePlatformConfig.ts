import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PlatformConfig = {
  id: string;
  nome_plataforma: string;
  taxa_semanal_motorista: number;
  telefone_suporte: string;
  horario_funcionamento_inicio: string;
  horario_funcionamento_fim: string;
};

const DEFAULTS: Omit<PlatformConfig, 'id'> = {
  nome_plataforma: 'RF Drive',
  taxa_semanal_motorista: 0,
  telefone_suporte: '',
  horario_funcionamento_inicio: '06:00',
  horario_funcionamento_fim: '22:00',
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
  };
}
