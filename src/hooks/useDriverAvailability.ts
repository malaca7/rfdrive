import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type DisponibilidadeStatus = 'ativo' | 'inativo';

/**
 * Etapa 8 — Driver availability toggle.
 * Reads/writes `status_disponibilidade` + `ultima_atividade` on `users`.
 */
export function useDriverAvailability(driverId: string | undefined) {
  const qc = useQueryClient();

  const { data: disponibilidade, isLoading } = useQuery({
    queryKey: ['driver-availability', driverId],
    queryFn: async (): Promise<DisponibilidadeStatus> => {
      const { data, error } = await supabase
        .from('users')
        .select('status_disponibilidade')
        .eq('id', driverId!)
        .single();
      if (error) throw error;
      return ((data as any)?.status_disponibilidade as DisponibilidadeStatus) || 'inativo';
    },
    enabled: !!driverId,
  });

  const mutation = useMutation({
    mutationFn: async (newStatus: DisponibilidadeStatus) => {
      const { error } = await supabase
        .from('users')
        .update({
          status_disponibilidade: newStatus,
          ultima_atividade: new Date().toISOString(),
        } as any)
        .eq('id', driverId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-availability', driverId] });
      qc.invalidateQueries({ queryKey: ['admin-drivers-tracking'] });
    },
  });

  const isAtivo = disponibilidade === 'ativo';

  const toggle = useCallback(() => {
    mutation.mutate(isAtivo ? 'inativo' : 'ativo');
  }, [isAtivo, mutation]);

  const setStatus = useCallback((s: DisponibilidadeStatus) => {
    mutation.mutate(s);
  }, [mutation]);

  return {
    isAtivo,
    disponibilidade: disponibilidade || 'inativo',
    isLoading,
    isPending: mutation.isPending,
    toggle,
    setStatus,
  };
}
