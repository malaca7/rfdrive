import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle, Clock, AlertTriangle, Loader2, Car, Send } from 'lucide-react';
import { motion } from 'framer-motion';

type EvalData = {
  id: string;
  motorista_id: string;
  permite_comentario: boolean;
  expira_em: string;
  status: string;
  motorista_nome?: string;
  motorista_avatar?: string | null;
};

type PageState = 'loading' | 'ready' | 'expired' | 'success' | 'error';

const AvaliacaoPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState('error'); return; }
    loadEvaluation();
  }, [token]);

  const loadEvaluation = async () => {
    try {
      // Mark expired first
      await supabase.rpc('mark_expired_eval_links').catch(() => {});

      const { data, error } = await supabase
        .from('evaluation_links')
        .select('id, motorista_id, permite_comentario, expira_em, status')
        .eq('token', token!)
        .single();

      if (error || !data) {
        setState('expired');
        return;
      }

      // Check expiration
      if (data.status !== 'ativa' || new Date(data.expira_em).getTime() < Date.now()) {
        setState('expired');
        return;
      }

      // Get motorista name
      const { data: motorista } = await supabase
        .from('users')
        .select('nome, avatar_url')
        .eq('id', data.motorista_id)
        .single();

      setEvalData({
        ...data,
        motorista_nome: motorista?.nome || 'Motorista',
        motorista_avatar: motorista?.avatar_url,
      });
      setState('ready');
    } catch {
      setState('error');
    }
  };

  const handleSubmit = async () => {
    if (!evalData || nota === 0) return;
    setSubmitting(true);

    try {
      // Re-check status before submitting to prevent race conditions
      const { data: check } = await supabase
        .from('evaluation_links')
        .select('status, expira_em')
        .eq('id', evalData.id)
        .single();

      if (!check || check.status !== 'ativa' || new Date(check.expira_em).getTime() < Date.now()) {
        setState('expired');
        return;
      }

      const { error } = await supabase
        .from('evaluation_links')
        .update({
          status: 'respondida',
          nota,
          comentario: evalData.permite_comentario && comentario.trim() ? comentario.trim() : null,
          respondida_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', evalData.id)
        .eq('status', 'ativa'); // Extra guard: only update if still active

      if (error) throw error;

      // Also create record in avaliacoes_admin for the admin performance dashboard
      await supabase.from('avaliacoes_admin').insert({
        motorista_id: evalData.motorista_id,
        nota,
        comentario: evalData.permite_comentario && comentario.trim() ? comentario.trim() : null,
      }).catch(() => {}); // Best-effort

      setState('success');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Countdown timer ──
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (state !== 'ready' || !evalData) return;
    const update = () => {
      const diff = new Date(evalData.expira_em).getTime() - Date.now();
      if (diff <= 0) { setState('expired'); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (mins >= 60) {
        const h = Math.floor(mins / 60);
        setTimeLeft(`${h}h ${mins % 60}min`);
      } else {
        setTimeLeft(`${mins}:${String(secs).padStart(2, '0')}`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [state, evalData]);

  return (
    <div className="min-h-screen bg-[hsl(0_0%_3%)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* ── Loading ── */}
        {state === 'loading' && (
          <Card className="border-white/10 bg-white/[0.03]">
            <CardContent className="py-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando avaliação...</p>
            </CardContent>
          </Card>
        )}

        {/* ── Expired / Already answered ── */}
        {state === 'expired' && (
          <Card className="border-red-500/20 bg-red-500/[0.03]">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-red-400 mb-2">
                Avaliação expirada ou já respondida
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Este link não está mais disponível. Solicite um novo link ao administrador.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Error ── */}
        {state === 'error' && (
          <Card className="border-red-500/20 bg-red-500/[0.03]">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-red-400 mb-2">
                Link inválido
              </h2>
              <p className="text-sm text-muted-foreground">
                Verifique se o link está correto e tente novamente.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Success ── */}
        {state === 'success' && (
          <Card className="border-green-500/20 bg-green-500/[0.03]">
            <CardContent className="py-16 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
              </motion.div>
              <h2 className="text-lg font-bold text-green-400 mb-2">
                Avaliação enviada!
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Obrigado pelo seu feedback. Sua avaliação ajuda a melhorar nosso serviço.
              </p>
              <div className="flex items-center justify-center gap-0.5 mt-4">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`w-6 h-6 ${s <= nota ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Ready — Evaluation Form ── */}
        {state === 'ready' && evalData && (
          <Card className="border-white/10 bg-white/[0.03]">
            <CardContent className="py-6 px-5 space-y-6">
              {/* Header */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto overflow-hidden">
                  {evalData.motorista_avatar ? (
                    <img src={evalData.motorista_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-8 h-8 text-accent" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">Avaliar Motorista</h2>
                  <p className="text-sm text-muted-foreground">{evalData.motorista_nome}</p>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Expira em {timeLeft}</span>
                </div>
              </div>

              {/* Stars */}
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Como foi sua experiência?
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <motion.button
                      key={s}
                      type="button"
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onMouseEnter={() => setHoveredStar(s)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setNota(s)}
                      className="transition-colors"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          s <= (hoveredStar || nota)
                            ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                            : 'text-white/15 hover:text-white/30'
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>
                {nota > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-medium text-yellow-400"
                  >
                    {nota === 1 ? 'Péssimo' : nota === 2 ? 'Ruim' : nota === 3 ? 'Regular' : nota === 4 ? 'Bom' : 'Excelente'}
                  </motion.p>
                )}
              </div>

              {/* Comment */}
              {evalData.permite_comentario && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Deixe um comentário (opcional)
                  </label>
                  <Textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Conte como foi sua experiência..."
                    className="resize-none h-24 bg-white/[0.03] border-white/10"
                    maxLength={500}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{comentario.length}/500</p>
                </div>
              )}

              {/* Submit */}
              <Button
                className="w-full gap-2 h-12 text-base font-semibold"
                disabled={nota === 0 || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Enviar Avaliação
              </Button>

              {/* Footer */}
              <p className="text-[10px] text-center text-muted-foreground/60">
                Este link é de uso único e expira automaticamente.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default AvaliacaoPublica;
