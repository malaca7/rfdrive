import { useQuery } from '@tanstack/react-query';
import {
  getActiveTimeRule,
  applyTimeAdjustment,
  type RegraHorario,
} from '@/lib/pricing-engine';

export interface DynamicAdjustment {
  regra: RegraHorario;
  label: string; // e.g. "+20% Noturno"
  aplicar: (precoBase: number) => number;
}

/**
 * Hook que retorna a regra de horário ativa (se houver).
 * Re-avalia a cada 60s para capturar mudanças de faixa horária.
 */
export function useDynamicAdjustment(): DynamicAdjustment | null {
  const { data: regra } = useQuery({
    queryKey: ['active-time-rule'],
    queryFn: getActiveTimeRule,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!regra) return null;

  const label =
    regra.tipo_ajuste === 'percentual'
      ? `+${regra.valor_ajuste}% ${regra.nome}`
      : `+R$ ${regra.valor_ajuste.toFixed(2)} ${regra.nome}`;

  return {
    regra,
    label,
    aplicar: (precoBase: number) =>
      Math.round(applyTimeAdjustment(precoBase, regra) * 100) / 100,
  };
}
