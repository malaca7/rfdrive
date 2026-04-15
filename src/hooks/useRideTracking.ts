import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type RideTrackingStatus = 'aceita' | 'a_caminho' | 'em_corrida' | 'finalizada';

/**
 * Etapa 10 — Ride tracking status transitions.
 * Handles: aceita → a_caminho → em_corrida → finalizada
 * Activates/deactivates `tracking_ativo`.
 */
export function useRideTracking(driverId: string | undefined) {
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['pending-rides'] });
    qc.invalidateQueries({ queryKey: ['my-active-rides'] });
    qc.invalidateQueries({ queryKey: ['my-completed-rides'] });
    qc.invalidateQueries({ queryKey: ['admin-drivers-tracking'] });
  };

  // Accept ride: sets motorista_id, status=aceita, tracking_ativo=true
  const acceptRide = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({
          motorista_id: driverId!,
          status: 'aceita' as any,
          tracking_ativo: true,
        } as any)
        .eq('id', rideId)
        .eq('status', 'aguardando_motorista');
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  // Transition to "a_caminho" (heading to pick up client)
  const startPickup = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({ status: 'a_caminho' as any, tracking_ativo: true } as any)
        .eq('id', rideId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  // Transition to "em_corrida" (client in car, driving to destination)
  const startTrip = useMutation({
    mutationFn: async (rideId: string) => {
      const { error } = await supabase
        .from('corridas')
        .update({ status: 'em_corrida' as any, tracking_ativo: true } as any)
        .eq('id', rideId);
      if (error) throw error;
    },
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
