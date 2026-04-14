import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchTabelaFromSupabase,
  buscarPrecoTabela,
  normalizeText,
  type LookupResult,
  type TabelaEntry,
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
 * Deriva diretamente do react-query data (garantido fresco após invalidação).
 * Deduplicação por normalização: evita mostrar "Centro do Cabo" e "centro do cabo" como itens separados.
 */
export function useAllLocations(): string[] {
  const { data: tabelaData } = useQuery<TabelaEntry[]>({
    queryKey: ['tabela-precos'],
    queryFn: fetchTabelaFromSupabase,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const entries = tabelaData ?? [];
    // Map normalized → first-seen original form (keeps consistent casing)
    const seen = new Map<string, string>();
    for (const entry of entries) {
      const normO = normalizeText(entry.origem);
      if (!seen.has(normO)) seen.set(normO, entry.origem);
      const normD = normalizeText(entry.destino);
      if (!seen.has(normD)) seen.set(normD, entry.destino);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tabelaData]);
}
