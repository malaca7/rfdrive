import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchTabelaFromSupabase,
  buscarPrecoTabela,
  getAllLocations,
  type LookupResult,
} from '@/lib/tabela-preco';

/**
 * Hook reativo de lookup de preço.
 * Observa o cache react-query de 'tabela-precos'; quando o Realtime
 * invalida a query, o hook re-avalia automaticamente.
 */
export function usePrecoTabela(origem: string, destino: string): LookupResult | null {
  // Subscribe to react-query cache — triggers re-render when data changes
  const { data: tabelaData } = useQuery({
    queryKey: ['tabela-precos'],
    queryFn: fetchTabelaFromSupabase,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    if (!origem.trim() || !destino.trim()) return null;
    // in-memory maps are synced by useRealtimeSync's syncCacheFromSupabase()
    return buscarPrecoTabela(origem, destino);
    // tabelaData in deps ensures re-evaluation after Realtime sync
  }, [origem, destino, tabelaData]);
}

/**
 * Hook reativo de localizações para autocomplete.
 * Re-avalia quando a tabela de preços muda.
 */
export function useAllLocations(): string[] {
  const { data: tabelaData } = useQuery({
    queryKey: ['tabela-precos'],
    queryFn: fetchTabelaFromSupabase,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    return getAllLocations();
  }, [tabelaData]);
}
