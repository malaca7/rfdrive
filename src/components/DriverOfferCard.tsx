/**
 * Etapa 20/22/25 — Componente de oferta de corrida para o motorista
 * com timer de 30s, botões aceitar/recusar, e urgência visual.
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Navigation,
  Clock,
  Check,
  X,
  DollarSign,
  AlertTriangle,
  Loader2,
  Zap,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DriverOffer } from '@/hooks/useDriverOffers';

interface OfferCardProps {
  offer: DriverOffer;
  onAccept: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  onDecline: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  accepting: string | null;
  declining: string | null;
}

const OfferCard: React.FC<OfferCardProps> = ({
  offer,
  onAccept,
  onDecline,
  accepting,
  declining,
}) => {
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const isAccepting = accepting === offer.id;
  const isDeclining = declining === offer.id;
  const isUrgent = offer.secondsLeft <= 10;
  const isCritical = offer.secondsLeft <= 5;

  // Timer percentage
  const pct = Math.max(0, (offer.secondsLeft / 30) * 100);

  const handleAccept = async () => {
    const res = await onAccept(offer.id);
    if (!res.success) {
      setResult({ type: 'error', msg: res.error || 'Falha ao aceitar' });
    } else {
      setResult({ type: 'success', msg: 'Corrida aceita!' });
    }
  };

  const handleDecline = async () => {
    const res = await onDecline(offer.id);
    if (!res.success) {
      setResult({ type: 'error', msg: res.error || 'Falha ao recusar' });
    }
  };

  if (result?.type === 'success') {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-6 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10 mb-3">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <p className="font-semibold text-green-400 text-sm">Corrida aceita!</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Vá até o menu "Ativas" para acompanhar</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Card
        className={`overflow-hidden transition-all ${
          isCritical
            ? 'border-red-500/30 shadow-[0_0_16px_rgba(239,68,68,0.08)]'
            : isUrgent
            ? 'border-yellow-500/25 shadow-[0_0_12px_rgba(234,179,8,0.06)]'
            : 'border-accent/20'
        }`}
      >
        {/* Timer bar */}
        <div className="h-1 bg-muted/20 relative overflow-hidden">
          <motion.div
            className={`absolute inset-y-0 left-0 ${
              isCritical ? 'bg-red-500' : isUrgent ? 'bg-yellow-500' : 'bg-accent'
            }`}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </div>

        <CardContent className="py-3.5 px-4 space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent/80" />
              <span className="text-[13px] font-semibold tracking-tight">Nova Corrida</span>
              {offer.rodada_disparo > 1 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-purple-500/10 text-purple-400 border-purple-500/20">
                  Rodada {offer.rodada_disparo}
                </Badge>
              )}
            </div>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                isCritical
                  ? 'bg-red-500/10 text-red-400'
                  : isUrgent
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-accent/8 text-accent'
              }`}
            >
              {isCritical && <AlertTriangle className="w-2.5 h-2.5" />}
              <Clock className="w-2.5 h-2.5" />
              {offer.secondsLeft}s
            </div>
          </div>

          {/* Ride info */}
          {offer.corrida && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
              <div className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500/80 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Embarque</p>
                  <p className="text-[13px] font-medium truncate">{offer.corrida.origem_texto}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent/80 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Destino</p>
                  <p className="text-[13px] font-medium truncate">{offer.corrida.destino_texto}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {offer.corrida.valor_estimado != null && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-green-400/80" />
                    <span className="text-[13px] font-bold text-green-400">
                      R$ {Number(offer.corrida.valor_estimado).toFixed(2)}
                    </span>
                  </div>
                )}
                {offer.distancia_km != null && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-400/70" />
                    <span className="text-[11px] text-blue-400/80">
                      {Number(offer.distancia_km).toFixed(1)} km
                    </span>
                  </div>
                )}
                {offer.corrida.tem_bagagem && (
                  <span className="text-[9px] text-orange-400/80 bg-orange-500/8 px-1.5 py-0.5 rounded">
                    📦 Bagagem
                  </span>
                )}
              </div>

              {offer.corrida.cliente_nome && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <User className="w-2.5 h-2.5" />
                  <span>{offer.corrida.cliente_nome}</span>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {result?.type === 'error' && (
            <p className="text-xs text-red-400 text-center bg-red-500/10 rounded-lg py-1.5">
              {result.msg}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={isDeclining || isAccepting}
              className="flex-1 h-11 border-red-500/20 text-red-400/80 hover:bg-red-500/8 hover:border-red-500/40 rounded-xl font-medium text-sm"
            >
              {isDeclining ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Recusar
                </>
              )}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
              className={`flex-1 h-11 rounded-xl font-semibold text-sm ${
                isCritical
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isAccepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Aceitar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/** Wrapper that shows all active offers for a driver */
export const DriverOffersList: React.FC<{
  offers: DriverOffer[];
  onAccept: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  onDecline: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  accepting: string | null;
  declining: string | null;
}> = ({ offers, onAccept, onDecline, accepting, declining }) => {
  if (offers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Zap className="w-5 h-5 text-accent" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full" />
        </div>
        <h3 className="font-bold text-[clamp(0.9rem,3vw,1.1rem)]">
          Ofertas de Corrida ({offers.length})
        </h3>
      </div>
      <AnimatePresence mode="popLayout">
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            onAccept={onAccept}
            onDecline={onDecline}
            accepting={accepting}
            declining={declining}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default OfferCard;
