import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const GEO_INTERVAL_MS = 15_000; // 15 seconds

interface UseDriverLocationOptions {
  driverId: string | undefined;
  enabled: boolean; // true when driver is "disponível"
}

/**
 * Etapa 7 — Background geolocation tracking for drivers.
 * Captures GPS every 15s and upserts to `localizacao_motorista`.
 * Only runs when `enabled=true` (driver is "ativo").
 */
export function useDriverLocation({ driverId, enabled }: UseDriverLocationOptions) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const upsertLocation = useCallback(async (lat: number, lng: number) => {
    if (!driverId) return;
    // Avoid duplicate writes if coords haven't changed significantly
    const last = lastCoordsRef.current;
    if (last && Math.abs(last.lat - lat) < 0.00005 && Math.abs(last.lng - lng) < 0.00005) return;
    lastCoordsRef.current = { lat, lng };

    await supabase
      .from('localizacao_motorista' as any)
      .upsert({
        motorista_id: driverId,
        latitude: lat,
        longitude: lng,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'motorista_id' })
      .then(({ error }) => {
        if (error) console.warn('[geo] upsert error:', error.message);
      });
  }, [driverId]);

  const captureOnce = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => upsertLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn('[geo] position error:', err.message),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  }, [upsertLocation]);

  useEffect(() => {
    if (!enabled || !driverId) {
      // Cleanup
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Capture immediately on enable
    captureOnce();

    // Set interval for periodic captures
    intervalRef.current = setInterval(captureOnce, GEO_INTERVAL_MS);

    // Also use watchPosition for opportunistic updates
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => upsertLocation(pos.coords.latitude, pos.coords.longitude),
        () => {}, // silent fail for watch
        { enableHighAccuracy: true, maximumAge: 10_000 },
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, driverId, captureOnce, upsertLocation]);

  return { captureOnce };
}
