import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { syncCacheFromSupabase, cleanupDuplicatesSupabase } from '@/lib/tabela-preco';

/**
 * Hook global de sincronização em tempo real.
 * Escuta mudanças nas tabelas corridas, users e tabela_precos
 * e invalida os caches do react-query automaticamente.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    // Sync price table cache on mount + cleanup duplicates
    syncCacheFromSupabase();
    cleanupDuplicatesSupabase().catch(() => {});

    const channel = supabase
      .channel('global-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corridas' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-rides'] });
        qc.invalidateQueries({ queryKey: ['pending-rides'] });
        qc.invalidateQueries({ queryKey: ['my-active-rides'] });
        qc.invalidateQueries({ queryKey: ['my-completed-rides'] });
        qc.invalidateQueries({ queryKey: ['my-rides'] });
        qc.invalidateQueries({ queryKey: ['active-ride'] });
        qc.invalidateQueries({ queryKey: ['last-completed-ride'] });
        qc.invalidateQueries({ queryKey: ['motorista-info'] });
        qc.invalidateQueries({ queryKey: ['admin-drivers-tracking'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-users'] });
        qc.invalidateQueries({ queryKey: ['driver-profile'] });
        qc.invalidateQueries({ queryKey: ['motorista-info'] });
        qc.invalidateQueries({ queryKey: ['driver-availability'] });
        qc.invalidateQueries({ queryKey: ['admin-drivers-tracking'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes' }, () => {
        qc.invalidateQueries({ queryKey: ['ride-rating'] });
        qc.invalidateQueries({ queryKey: ['admin-rides'] });
        qc.invalidateQueries({ queryKey: ['my-completed-rides'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aprovacoes' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-rides'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabela_precos' }, () => {
        qc.invalidateQueries({ queryKey: ['tabela-precos'] });
        qc.invalidateQueries({ queryKey: ['preco-dinamico'] });
        syncCacheFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'precos_rotas' }, () => {
        qc.invalidateQueries({ queryKey: ['pricing-precos'] });
        qc.invalidateQueries({ queryKey: ['preco-dinamico'] });
        import('@/lib/pricing-engine').then(m => m.invalidatePricingCache());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localidades' }, () => {
        qc.invalidateQueries({ queryKey: ['pricing-localidades'] });
        qc.invalidateQueries({ queryKey: ['preco-dinamico'] });
        import('@/lib/pricing-engine').then(m => m.invalidatePricingCache());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regras_horario' }, () => {
        qc.invalidateQueries({ queryKey: ['pricing-regras'] });
        qc.invalidateQueries({ queryKey: ['active-time-rule'] });
        qc.invalidateQueries({ queryKey: ['preco-dinamico'] });
        // Invalidar cache interno do motor de preços
        import('@/lib/pricing-engine').then(m => m.invalidatePricingCache());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config_tarifas' }, () => {
        qc.invalidateQueries({ queryKey: ['config-tarifas'] });
        qc.invalidateQueries({ queryKey: ['config-tarifas-form'] });
        qc.invalidateQueries({ queryKey: ['config-tarifas-driver'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localizacao_motorista' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-drivers-tracking'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
