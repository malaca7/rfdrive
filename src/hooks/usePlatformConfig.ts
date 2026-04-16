import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PlatformConfig = {
  id: string;
  nome_plataforma: string;
  taxa_semanal_motorista: number;
  cor_primaria: string;
  cor_secundaria: string;
  cor_terciaria: string;
};

const DEFAULTS: Omit<PlatformConfig, 'id'> = {
  nome_plataforma: 'RF Drive',
  taxa_semanal_motorista: 0,
  cor_primaria: '#FFD000',
  cor_secundaria: '#0a0a0a',
  cor_terciaria: '#ffffff',
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
  };
}
