import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type RideTrackingStatus = 'em_analise' | 'aprovada' | 'nao_realizada';

/**
 * Etapa 10 — Ride tracking status transitions.
 * Simplified: only em_analise, aprovada, nao_realizada.
 */
export function useRideTracking(driverId: string | undefined) {
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['pending-rides'] });
    qc.invalidateQueries({ queryKey: ['my-active-rides'] });
    qc.invalidateQueries({ queryKey: ['my-completed-rides'] });
    qc.invalidateQueries({ queryKey: ['admin-drivers-tracking'] });
  };

  // Accept ride: sets motorista_id, status=em_analise
  const acceptRide = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({
          motorista_id: driverId!,
          status: 'em_analise' as any,
        } as any)
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  // No-op stubs for compatibility
  const startPickup = useMutation({
    mutationFn: async (_rideId: string) => {},
    onSuccess: invalidateAll,
  });

  const startTrip = useMutation({
    mutationFn: async (_rideId: string) => {},
    onSuccess: invalidateAll,
  });

  // Finish ride: status=em_analise, tracking off
  const finishRide = useMutation({
    mutationFn: async ({ rideId, valor, observacao }: { rideId: string; valor: number | null; observacao: string }) => {
      const { error } = await supabase
        .from('corridas')
        .update({
          status: 'em_analise' as any,
          valor,
          observacao_motorista: observacao || null,
          concluida_at: new Date().toISOString(),
          tracking_ativo: false,
        } as any)
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  return { acceptRide, startPickup, startTrip, finishRide };
}
