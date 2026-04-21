/**
 * Etapa 19 — Hook que monitora corridas aguardando motorista
 * e dispara o motor de despacho automaticamente.
 * Gerencia ciclo de vida: dispatch → timeout → fallback.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  dispatchRide,
  expireStaleOffers,
  checkAndFallback,
  DISPATCH_CONFIG,
} from '@/lib/dispatch-engine';

/**
 * Runs in the admin/system context.
 * Polls for rides in 'em_analise' status and dispatches them.
 */
export function useDispatchEngine(enabled: boolean = true) {
  const qc = useQueryClient();
  const activeDispatches = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dispatch-offers'] });
    qc.invalidateQueries({ queryKey: ['pending-rides'] });
    qc.invalidateQueries({ queryKey: ['admin-dispatch'] });
    qc.invalidateQueries({ queryKey: ['driver-offers'] });
    qc.invalidateQueries({ queryKey: ['my-active-rides'] });
    qc.invalidateQueries({ queryKey: ['active-ride'] });
  }, [qc]);

  // Handle a single ride dispatch cycle
  const handleDispatch = useCallback(
    async (corridaId: string) => {
      if (activeDispatches.current.has(corridaId)) return;
      activeDispatches.current.add(corridaId);

      try {
        // Get ride details for coordinates (use localidades lat/lng if available)
        // For now, dispatch without specific coordinates (engine handles no-coord case)
        const result = await dispatchRide(corridaId, 0, 0, 1);

        if (!result.success || result.motoristas_notificados === 0) {
          activeDispatches.current.delete(corridaId);
          return;
        }

        invalidateAll();

        // Set up expiration + fallback timer
        const timer = setTimeout(async () => {
          try {
            // Expire stale offers
            await expireStaleOffers(corridaId);

            // Check if need fallback
            const fallback = await checkAndFallback(corridaId, 0, 0);
            if (fallback?.success) {
              invalidateAll();

              // Set another timer for round 2
              const timer2 = setTimeout(async () => {
                try {
                  await expireStaleOffers(corridaId);
                  invalidateAll();
                } finally {
                  activeDispatches.current.delete(corridaId);
                  timers.current.delete(corridaId);
                }
              }, (DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS + 3) * 1000);

              timers.current.set(corridaId, timer2);
            } else {
              activeDispatches.current.delete(corridaId);
              timers.current.delete(corridaId);
            }
          } catch {
            activeDispatches.current.delete(corridaId);
            timers.current.delete(corridaId);
          }

          invalidateAll();
        }, (DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS + 3) * 1000);

        timers.current.set(corridaId, timer);
      } catch {
        activeDispatches.current.delete(corridaId);
      }
    },
    [invalidateAll],
  );

  // Listen for new rides via Supabase Realtime
  useEffect(() => {
    if (!enabled) return;

    // Initial check for rides waiting
    const checkPending = async () => {
      const { data } = await supabase
        .from('corridas')
        .select('id')
        .eq('status', 'em_analise')
        .order('created_at', { ascending: true });

      if (!data) return;

      for (const ride of data) {
        // Check if already has offers
        const { data: existing } = await supabase
          .from('ofertas_corrida')
          .select('id')
          .eq('corrida_id', ride.id)
          .limit(1);

        if (!existing || existing.length === 0) {
          handleDispatch(ride.id);
        }
      }
    };

    checkPending();

    // Realtime listener for new rides
    const channel = supabase
      .channel('dispatch-engine')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'corridas',
          filter: 'status=eq.em_analise',
        },
        (payload) => {
          const rideId = (payload.new as any)?.id;
          if (rideId) {
            // Small delay to let the DB settle
            setTimeout(() => handleDispatch(rideId), 500);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'corridas',
          filter: 'status=eq.em_analise',
        },
        (payload) => {
          const rideId = (payload.new as any)?.id;
          if (rideId && !activeDispatches.current.has(rideId)) {
            setTimeout(() => handleDispatch(rideId), 500);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
      activeDispatches.current.clear();
    };
  }, [enabled, handleDispatch]);
}
