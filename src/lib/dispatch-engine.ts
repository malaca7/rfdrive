/**
 * Etapa 19-23 — Motor de Despacho Automático de Corridas
 *
 * Seleciona motoristas elegíveis, calcula ranking por proximidade + rapidez,
 * cria ofertas simultâneas, gerencia aceite por ordem de chegada,
 * e faz fallback automático para rodada 2 se ninguém aceitar.
 */

import { supabase } from '@/integrations/supabase/client';
import { haversineDistance } from '@/lib/geo-utils';

// ── Configuração ──
export const DISPATCH_CONFIG = {
  OFFER_TIMEOUT_SECONDS: 30,
  ROUND_1_MAX_DRIVERS: 5,
  WEIGHT_PROXIMITY: 0.6,
  WEIGHT_RESPONSE_TIME: 0.4,
  MAX_DRIVER_DISTANCE_KM: 50,
  LOCATION_STALE_MINUTES: 30,
};

// ── Tipos ──
export interface EligibleDriver {
  motorista_id: string;
  nome: string;
  telefone: string;
  latitude: number;
  longitude: number;
  distancia_km: number;
  media_tempo_aceite: number;
  score: number;
  rank: number;
}

export interface DispatchResult {
  success: boolean;
  corrida_id: string;
  rodada: number;
  motoristas_notificados: number;
  ofertas_criadas: string[];
  error?: string;
}

export interface OfertaCorrida {
  id: string;
  corrida_id: string;
  motorista_id: string;
  status: 'enviada' | 'aceita' | 'recusada' | 'expirada' | 'cancelada';
  rodada_disparo: number;
  score_ranking: number | null;
  distancia_km: number | null;
  enviado_em: string;
  respondido_em: string | null;
  tempo_resposta_segundos: number | null;
  motivo_rodada: string | null;
}

// ── 1. Buscar motoristas elegíveis ──
export async function fetchEligibleDrivers(
  excludeIds: string[] = [],
): Promise<Array<{
  motorista_id: string;
  nome: string;
  telefone: string;
  latitude: number;
  longitude: number;
  media_tempo_aceite: number;
}>> {
  // Motoristas ativos com localização
  const { data: drivers, error: dErr } = await supabase
    .from('users')
    .select('id, nome, telefone, status_disponibilidade' as any)
    .eq('tipo', 'motorista')
    .eq('ativo', true)
    .eq('status', 'ativo');

  if (dErr || !drivers) return [];

  const activeDriverIds = (drivers as any[])
    .filter((d: any) => d.status_disponibilidade === 'ativo')
    .map((d: any) => d.id)
    .filter((id: string) => !excludeIds.includes(id));

  if (activeDriverIds.length === 0) return [];

  // Verificar quem não tem corrida ativa
  const { data: busyRides } = await supabase
    .from('corridas')
    .select('motorista_id')
    .in('status', ['em_analise'] as any)
    .not('motorista_id', 'is', null);

  const busyIds = new Set((busyRides || []).map((r: any) => r.motorista_id));

  // Verificar quem não tem oferta ativa (enviada)
  const { data: activeOffers } = await supabase
    .from('ofertas_corrida')
    .select('motorista_id')
    .eq('status', 'enviada');

  const offeredIds = new Set((activeOffers || []).map((o: any) => o.motorista_id));

  const freeDriverIds = activeDriverIds.filter(
    (id) => !busyIds.has(id) && !offeredIds.has(id),
  );

  if (freeDriverIds.length === 0) return [];

  // Buscar localizações
  const { data: locations } = await supabase
    .from('localizacao_motorista')
    .select('motorista_id, latitude, longitude, atualizado_em')
    .in('motorista_id', freeDriverIds);

  if (!locations || locations.length === 0) return [];

  // Filtrar localizações obsoletas
  const now = Date.now();
  const staleMs = DISPATCH_CONFIG.LOCATION_STALE_MINUTES * 60 * 1000;
  const freshLocations = locations.filter(
    (l) => now - new Date(l.atualizado_em).getTime() < staleMs,
  );

  // Buscar métricas
  const driverIds = freshLocations.map((l) => l.motorista_id);
  const { data: metrics } = await supabase
    .from('metricas_motorista')
    .select('motorista_id, media_tempo_aceite')
    .in('motorista_id', driverIds);

  const metricsMap = new Map(
    (metrics || []).map((m) => [m.motorista_id, m.media_tempo_aceite]),
  );

  const driversMap = new Map(
    (drivers as any[]).map((d: any) => [d.id, { nome: d.nome, telefone: d.telefone }]),
  );

  return freshLocations.map((loc) => {
    const info = driversMap.get(loc.motorista_id);
    return {
      motorista_id: loc.motorista_id,
      nome: info?.nome || '',
      telefone: info?.telefone || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      media_tempo_aceite: metricsMap.get(loc.motorista_id) ?? 30,
    };
  });
}

// ── 2. Calcular ranking inteligente (Etapa 23) ──
export function calculateDriverRanking(
  drivers: Array<{
    motorista_id: string;
    nome: string;
    telefone: string;
    latitude: number;
    longitude: number;
    media_tempo_aceite: number;
  }>,
  origemLat: number,
  origemLng: number,
): EligibleDriver[] {
  if (drivers.length === 0) return [];

  // Calcular distâncias
  const withDistance = drivers.map((d) => ({
    ...d,
    distancia_km: haversineDistance(d.latitude, d.longitude, origemLat, origemLng),
  }));

  // Filtrar por distância máxima
  const nearby = withDistance.filter(
    (d) => d.distancia_km <= DISPATCH_CONFIG.MAX_DRIVER_DISTANCE_KM,
  );

  if (nearby.length === 0) return [];

  // Normalizar para score (0-1 onde 1 é melhor)
  const maxDist = Math.max(...nearby.map((d) => d.distancia_km), 1);
  const maxTime = Math.max(...nearby.map((d) => d.media_tempo_aceite), 1);

  const scored = nearby.map((d) => {
    const proximityScore = 1 - d.distancia_km / maxDist;
    const responseScore = 1 - d.media_tempo_aceite / maxTime;
    const finalScore =
      proximityScore * DISPATCH_CONFIG.WEIGHT_PROXIMITY +
      responseScore * DISPATCH_CONFIG.WEIGHT_RESPONSE_TIME;
    return { ...d, score: Math.round(finalScore * 100) / 100 };
  });

  // Ordenar por score (melhor primeiro) e atribuir rank
  scored.sort((a, b) => b.score - a.score);

  return scored.map((d, i) => ({ ...d, rank: i + 1 }));
}

// ── 3. Criar ofertas e distribuir (Etapa 19) ──
export async function dispatchRide(
  corridaId: string,
  origemLat: number,
  origemLng: number,
  rodada: number = 1,
  excludeDriverIds: string[] = [],
): Promise<DispatchResult> {
  try {
    const eligible = await fetchEligibleDrivers(excludeDriverIds);
    const ranked = calculateDriverRanking(eligible, origemLat, origemLng);

    if (ranked.length === 0) {
      return {
        success: false,
        corrida_id: corridaId,
        rodada,
        motoristas_notificados: 0,
        ofertas_criadas: [],
        error: 'Nenhum motorista elegível encontrado',
      };
    }

    // Selecionar grupo da rodada
    const group =
      rodada === 1
        ? ranked.slice(0, DISPATCH_CONFIG.ROUND_1_MAX_DRIVERS)
        : ranked; // Rodada 2+ = todos

    // Criar ofertas simultaneamente
    const ofertas = group.map((d) => ({
      corrida_id: corridaId,
      motorista_id: d.motorista_id,
      status: 'enviada' as const,
      rodada_disparo: rodada,
      score_ranking: d.score,
      distancia_km: d.distancia_km,
      enviado_em: new Date().toISOString(),
      motivo_rodada:
        rodada === 1
          ? 'Distribuição inicial priorizada'
          : 'Fallback: sem aceite na rodada anterior',
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('ofertas_corrida')
      .insert(ofertas)
      .select('id');

    if (insertErr) throw insertErr;

    return {
      success: true,
      corrida_id: corridaId,
      rodada,
      motoristas_notificados: group.length,
      ofertas_criadas: (inserted || []).map((o) => o.id),
    };
  } catch (err) {
    return {
      success: false,
      corrida_id: corridaId,
      rodada,
      motoristas_notificados: 0,
      ofertas_criadas: [],
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    };
  }
}

// ── 4. Aceitar oferta (Etapa 20 — primeiro aceite vence) ──
export async function acceptOffer(
  offerId: string,
  motoristaId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  // Buscar a oferta
  const { data: offer, error: fetchErr } = await supabase
    .from('ofertas_corrida')
    .select('*')
    .eq('id', offerId)
    .single();

  if (fetchErr || !offer) {
    return { success: false, error: 'Oferta não encontrada' };
  }

  if (offer.status !== 'enviada') {
    return { success: false, error: 'Oferta já foi processada' };
  }

  // Verificar timeout de 30s
  const sentAt = new Date(offer.enviado_em);
  const elapsed = (now.getTime() - sentAt.getTime()) / 1000;
  if (elapsed > DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS + 2) {
    // Margem de 2s para latência
    await supabase
      .from('ofertas_corrida')
      .update({
        status: 'expirada' as any,
        respondido_em: now.toISOString(),
        tempo_resposta_segundos: elapsed,
      })
      .eq('id', offerId);
    return { success: false, error: 'Tempo de resposta expirado' };
  }

  // Verificar se corrida já foi aceita por outro motorista (controle de concorrência)
  const { data: existingAccept } = await supabase
    .from('ofertas_corrida')
    .select('id')
    .eq('corrida_id', offer.corrida_id)
    .eq('status', 'aceita')
    .limit(1);

  if (existingAccept && existingAccept.length > 0) {
    // Outro motorista já aceitou
    await supabase
      .from('ofertas_corrida')
      .update({
        status: 'cancelada' as any,
        respondido_em: now.toISOString(),
        tempo_resposta_segundos: elapsed,
      })
      .eq('id', offerId);
    return { success: false, error: 'Corrida já aceita por outro motorista' };
  }

  // Marcar oferta como aceita
  const { error: acceptErr } = await supabase
    .from('ofertas_corrida')
    .update({
      status: 'aceita' as any,
      respondido_em: now.toISOString(),
      tempo_resposta_segundos: Math.round(elapsed * 100) / 100,
    })
    .eq('id', offerId)
    .eq('status', 'enviada'); // Otimistic locking

  if (acceptErr) {
    return { success: false, error: 'Falha ao aceitar oferta' };
  }

  // Vincular motorista à corrida
  const { error: rideErr } = await supabase
    .from('corridas')
    .update({
      motorista_id: motoristaId,
      status: 'em_analise' as any,
    } as any)
    .eq('id', offer.corrida_id)
    .in('status', ['em_analise'] as any);

  if (rideErr) {
    // Reverter aceite
    await supabase
      .from('ofertas_corrida')
      .update({ status: 'enviada' as any, respondido_em: null, tempo_resposta_segundos: null })
      .eq('id', offerId);
    return { success: false, error: 'Falha ao atribuir corrida' };
  }

  // Cancelar todas as outras ofertas para esta corrida
  await supabase
    .from('ofertas_corrida')
    .update({
      status: 'cancelada' as any,
      respondido_em: now.toISOString(),
    })
    .eq('corrida_id', offer.corrida_id)
    .neq('id', offerId)
    .eq('status', 'enviada');

  // Atualizar métricas
  await updateDriverMetrics(motoristaId);

  return { success: true };
}

// ── 5. Recusar oferta (Etapa 22) ──
export async function declineOffer(
  offerId: string,
  motoristaId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  const { data: offer } = await supabase
    .from('ofertas_corrida')
    .select('enviado_em, status')
    .eq('id', offerId)
    .single();

  if (!offer || offer.status !== 'enviada') {
    return { success: false, error: 'Oferta não disponível' };
  }

  const elapsed = (now.getTime() - new Date(offer.enviado_em).getTime()) / 1000;

  const { error } = await supabase
    .from('ofertas_corrida')
    .update({
      status: 'recusada' as any,
      respondido_em: now.toISOString(),
      tempo_resposta_segundos: Math.round(elapsed * 100) / 100,
    })
    .eq('id', offerId)
    .eq('status', 'enviada');

  if (error) {
    return { success: false, error: 'Falha ao recusar' };
  }

  await updateDriverMetrics(motoristaId);
  return { success: true };
}

// ── 6. Expirar ofertas sem resposta (Etapa 20) ──
export async function expireStaleOffers(corridaId: string): Promise<number> {
  const cutoff = new Date(
    Date.now() - DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS * 1000,
  ).toISOString();

  const { data: stale } = await supabase
    .from('ofertas_corrida')
    .select('id, motorista_id, enviado_em')
    .eq('corrida_id', corridaId)
    .eq('status', 'enviada')
    .lt('enviado_em', cutoff);

  if (!stale || stale.length === 0) return 0;

  const now = new Date();

  for (const offer of stale) {
    const elapsed = (now.getTime() - new Date(offer.enviado_em).getTime()) / 1000;
    await supabase
      .from('ofertas_corrida')
      .update({
        status: 'expirada' as any,
        respondido_em: now.toISOString(),
        tempo_resposta_segundos: Math.round(elapsed * 100) / 100,
      })
      .eq('id', offer.id)
      .eq('status', 'enviada');

    await updateDriverMetrics(offer.motorista_id);
  }

  return stale.length;
}

// ── 7. Fallback para rodada 2 (Etapa 21) ──
export async function checkAndFallback(
  corridaId: string,
  origemLat: number,
  origemLng: number,
): Promise<DispatchResult | null> {
  // Verificar se corrida já foi aceita
  const { data: accepted } = await supabase
    .from('ofertas_corrida')
    .select('id')
    .eq('corrida_id', corridaId)
    .eq('status', 'aceita')
    .limit(1);

  if (accepted && accepted.length > 0) return null;

  // Verificar se ainda tem ofertas pendentes
  const { data: pending } = await supabase
    .from('ofertas_corrida')
    .select('id')
    .eq('corrida_id', corridaId)
    .eq('status', 'enviada')
    .limit(1);

  if (pending && pending.length > 0) return null;

  // Descobrir rodada atual
  const { data: rodadaData } = await supabase
    .from('ofertas_corrida')
    .select('rodada_disparo')
    .eq('corrida_id', corridaId)
    .order('rodada_disparo', { ascending: false })
    .limit(1);

  const currentRound = rodadaData?.[0]?.rodada_disparo ?? 1;

  // Buscar IDs de motoristas que já recusaram/expiraram nesta corrida
  const { data: previousOffers } = await supabase
    .from('ofertas_corrida')
    .select('motorista_id, status')
    .eq('corrida_id', corridaId)
    .in('status', ['recusada', 'expirada', 'cancelada'] as any);

  const excludeIds = (previousOffers || [])
    .filter((o) => o.status === 'recusada')
    .map((o) => o.motorista_id);

  return dispatchRide(corridaId, origemLat, origemLng, currentRound + 1, excludeIds);
}

// ── Helper: atualizar métricas ──
async function updateDriverMetrics(motoristaId: string) {
  try {
    // Calcular métricas manualmente no client-side
    const { data: offers } = await supabase
      .from('ofertas_corrida')
      .select('status, tempo_resposta_segundos')
      .eq('motorista_id', motoristaId);

    if (!offers) return;

    const aceitas = offers.filter((o) => o.status === 'aceita');
    const recusadas = offers.filter((o) => o.status === 'recusada');
    const expiradas = offers.filter((o) => o.status === 'expirada');
    const total = aceitas.length + recusadas.length + expiradas.length;

    const avgTime =
      aceitas.length > 0
        ? aceitas.reduce((sum, o) => sum + (o.tempo_resposta_segundos ?? 30), 0) / aceitas.length
        : 30;

    await supabase.from('metricas_motorista').upsert(
      {
        motorista_id: motoristaId,
        media_tempo_aceite: Math.round(avgTime * 100) / 100,
        total_corridas_aceitas: aceitas.length,
        total_corridas_recusadas: recusadas.length,
        total_corridas_expiradas: expiradas.length,
        taxa_aceite: total > 0 ? Math.round((aceitas.length / total) * 10000) / 100 : 0,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'motorista_id' },
    );
  } catch {
    // Non-critical
  }
}
