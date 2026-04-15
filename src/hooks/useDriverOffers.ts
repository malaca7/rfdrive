/**
 * Etapa 20/22/25 — Hook para motorista receber ofertas de corrida
 * com timer de 30s, aceite e recusa.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { acceptOffer, declineOffer, DISPATCH_CONFIG } from '@/lib/dispatch-engine';

export interface DriverOffer {
  id: string;
  corrida_id: string;
  motorista_id: string;
  status: string;
  rodada_disparo: number;
  score_ranking: number | null;
  distancia_km: number | null;
  enviado_em: string;
  // Joined ride data
  corrida?: {
    id: string;
    origem_texto: string;
    destino_texto: string;
    valor_estimado: number | null;
    distancia_km: number | null;
    tem_bagagem: boolean | null;
    cliente_nome?: string;
    cliente_telefone?: string;
  };
  // Timer state
  secondsLeft: number;
}

export function useDriverOffers(driverId: string | undefined) {
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [tick, setTick] = useState(0);

  // Tick every second for countdown
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Query active offers for this driver
  const { data: rawOffers, refetch } = useQuery({
    queryKey: ['driver-offers', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ofertas_corrida')
        .select('*')
        .eq('motorista_id', driverId!)
        .eq('status', 'enviada')
        .order('enviado_em', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Enrich with ride info
      const enriched = await Promise.all(
        data.map(async (offer) => {
          const { data: ride } = await supabase
            .from('corridas')
            .select('id, origem_texto, destino_texto, valor_estimado, distancia_km, tem_bagagem, cliente_id')
            .eq('id', offer.corrida_id)
            .single();

          let clienteNome = '';
          let clienteTelefone = '';
          if (ride?.cliente_id) {
            const { data: cliente } = await supabase
              .from('users')
              .select('nome, telefone')
              .eq('id', ride.cliente_id)
              .single();
            clienteNome = cliente?.nome || '';
            clienteTelefone = cliente?.telefone || '';
          }

          return {
            ...offer,
            corrida: ride
              ? {
                  ...ride,
                  cliente_nome: clienteNome,
                  cliente_telefone: clienteTelefone,
                }
              : undefined,
          };
        }),
      );

      return enriched;
    },
    enabled: !!driverId,
    refetchInterval: 5000,
  });

  // Calculate seconds left for each offer
  const offers: DriverOffer[] = (rawOffers || []).map((offer) => {
    const sentAt = new Date(offer.enviado_em).getTime();
    const elapsed = (Date.now() - sentAt) / 1000;
    const secondsLeft = Math.max(0, Math.ceil(DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS - elapsed));
    return { ...offer, secondsLeft };
  }).filter((o) => o.secondsLeft > 0); // Hide expired

  // Auto-expire locally expired offers
  useEffect(() => {
    if (!rawOffers) return;
    for (const offer of rawOffers) {
      const elapsed = (Date.now() - new Date(offer.enviado_em).getTime()) / 1000;
      if (elapsed > DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS && offer.status === 'enviada') {
        // Trigger refetch to get server state
        refetch();
        break;
      }
    }
  }, [tick, rawOffers, refetch]);

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['driver-offers'] });
    qc.invalidateQueries({ queryKey: ['pending-rides'] });
    qc.invalidateQueries({ queryKey: ['my-active-rides'] });
    qc.invalidateQueries({ queryKey: ['active-ride'] });
    qc.invalidateQueries({ queryKey: ['admin-dispatch'] });
    qc.invalidateQueries({ queryKey: ['dispatch-offers'] });
  }, [qc]);

  const handleAccept = useCallback(
    async (offerId: string) => {
      if (!driverId) return { success: false, error: 'Não autenticado' };
      setAccepting(offerId);
      try {
        const result = await acceptOffer(offerId, driverId);
        invalidateAll();
        return result;
      } finally {
        setAccepting(null);
      }
    },
    [driverId, invalidateAll],
  );

  const handleDecline = useCallback(
    async (offerId: string) => {
      if (!driverId) return { success: false, error: 'Não autenticado' };
      setDeclining(offerId);
      try {
        const result = await declineOffer(offerId, driverId);
        invalidateAll();
        return result;
      } finally {
        setDeclining(null);
      }
    },
    [driverId, invalidateAll],
  );

  // Realtime subscription for new offers
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-offers-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ofertas_corrida',
          filter: `motorista_id=eq.${driverId}`,
        },
        () => {
          refetch();
          invalidateAll();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, refetch, invalidateAll]);

  return {
    offers,
    hasOffers: offers.length > 0,
    accepting,
    declining,
    handleAccept,
    handleDecline,
    refetch,
  };
}
