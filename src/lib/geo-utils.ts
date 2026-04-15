/**
 * Etapa 12 — Foundation for intelligent dispatch.
 * Haversine distance calculation + nearest driver lookup.
 */

const R_EARTH_KM = 6371;

/** Calculate distance between two coordinates in km (Haversine formula) */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R_EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface DriverWithDistance {
  motorista_id: string;
  nome: string;
  latitude: number;
  longitude: number;
  distancia_km: number;
  atualizado_em: string;
}

/** Sort drivers by distance from a given point (nearest first) */
export function sortDriversByProximity(
  drivers: Array<{
    motorista_id: string;
    nome?: string;
    latitude: number;
    longitude: number;
    atualizado_em?: string;
  }>,
  targetLat: number,
  targetLng: number,
): DriverWithDistance[] {
  return drivers
    .map((d) => ({
      motorista_id: d.motorista_id,
      nome: d.nome || '',
      latitude: d.latitude,
      longitude: d.longitude,
      atualizado_em: d.atualizado_em || '',
      distancia_km: haversineDistance(d.latitude, d.longitude, targetLat, targetLng),
    }))
    .sort((a, b) => a.distancia_km - b.distancia_km);
}
