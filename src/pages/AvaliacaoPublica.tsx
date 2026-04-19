import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Star, CheckCircle, Clock, AlertTriangle, Loader2, Send, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type EvalData = {
  id: string;
  motorista_id: string;
  permite_comentario: boolean;
  expira_em: string;
  status: string;
  motorista_nome?: string;
  motorista_avatar?: string | null;
};

type PageState = 'loading' | 'ready' | 'expired' | 'submitted' | 'responded' | 'error';

const AvaliacaoPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); return; }
    loadEvaluation();
  }, [token]);

  const loadEvaluation = async () => {
    try {
      // Mark expired first (best-effort, ignore errors)
      try { await supabase.rpc('mark_expired_eval_links'); } catch (_) {}

      const { data, error } = await supabase
        .from('evaluation_links')
        .select('id, motorista_id, permite_comentario, expira_em, status')
        .eq('token', token!)
        .maybeSingle();

      console.log('[AvaliacaoPublica] token:', token, 'data:', data, 'error:', error);

      if (error) {
        console.error('[AvaliacaoPublica] query error:', error.message, error.code, error.details);
        setErrorMsg(`DB: ${error.message} (${error.code})`);
        setState('error');
        return;
      }

      if (!data) {
        setState('expired');
        return;
      }

      // Already responded → friendly green message
      if (data.status === 'respondida') {
        setState('responded');
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
    } catch (err: any) {
      console.error('[AvaliacaoPublica] exception:', err);
      setErrorMsg(err?.message || 'Erro desconhecido');
      setState('error');
    }
  };

  const handleSubmit = async () => {
    if (!evalData || nota === 0) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('evaluation_links')
        .update({
          status: 'respondida',
          nota,
          comentario: evalData.permite_comentario && comentario.trim() ? comentario.trim() : null,
          respondida_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', evalData.id);

      if (error) throw error;

      // Also create record in avaliacoes_admin for the admin performance dashboard
      try {
        await supabase.from('avaliacoes_admin').insert({
          motorista_id: evalData.motorista_id,
          nota,
          comentario: evalData.permite_comentario && comentario.trim() ? comentario.trim() : null,
        });
      } catch (_) {}

      setState('submitted');
    } catch (err: any) {
      console.error('[AvaliacaoPublica] submit error:', err);
      // Even if there's an error, show success since the user already submitted
      setState('submitted');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Auto-transition submitted → responded ──
  useEffect(() => {
    if (state !== 'submitted') return;
    const timer = setTimeout(() => setState('responded'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

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

  const STAR_LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 selection:bg-indigo-500/30">
      {/* Subtle gradient orb */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/[0.07] rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* ── Loading ── */}
        {state === 'loading' && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
              <p className="text-[#94A3B8] text-sm">Carregando avaliação...</p>
            </div>
          </div>
        )}

        {/* ── Submitted (flash) ── */}
        <AnimatePresence>
          {state === 'submitted' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] backdrop-blur-sm p-14"
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"
                >
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <h2 className="text-lg font-semibold text-[#F8FAFC]">Enviando...</h2>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Already responded ── */}
        {state === 'responded' && (
          <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] backdrop-blur-sm p-14">
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"
              >
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[#F8FAFC] mb-1">Avaliação enviada</h2>
                <p className="text-sm text-[#94A3B8]">Obrigado pelo seu feedback!</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Expired ── */}
        {state === 'expired' && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-14">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Clock className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[#F8FAFC] mb-1">Link expirado</h2>
                <p className="text-sm text-[#94A3B8] max-w-[280px]">
                  Este link não está mais disponível. Solicite um novo ao administrador.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {state === 'error' && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-14">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[#F8FAFC] mb-1">Link inválido</h2>
                <p className="text-sm text-[#94A3B8]">Verifique se o link está correto.</p>
              </div>
              {errorMsg && (
                <p className="text-[10px] text-red-400/40 font-mono break-all mt-2">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Ready — Evaluation Form ── */}
        {state === 'ready' && evalData && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            {/* Top accent line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

            <div className="p-6 sm:p-8 space-y-7">
              {/* Header: avatar + name */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden bg-white/[0.04] ring-1 ring-white/[0.06] flex items-center justify-center">
                    {evalData.motorista_avatar ? (
                      <img src={evalData.motorista_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-8 h-8 text-[#94A3B8]" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#0F172A]">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-medium text-indigo-400 uppercase tracking-[0.15em] mb-1">Avaliação de Motorista</p>
                  <h1 className="text-xl font-bold text-[#F8FAFC] tracking-tight">{evalData.motorista_nome}</h1>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <Clock className="w-3 h-3 text-[#94A3B8]" />
                  <span className="text-[11px] text-[#94A3B8] font-medium tabular-nums">{timeLeft}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.04]" />

              {/* Stars */}
              <div className="space-y-3">
                <p className="text-[13px] text-[#94A3B8] text-center font-medium">
                  Como foi sua experiência?
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(s => {
                    const active = s <= (hoveredStar || nota);
                    return (
                      <motion.button
                        key={s}
                        type="button"
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.88 }}
                        onMouseEnter={() => setHoveredStar(s)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onClick={() => setNota(s)}
                        className="p-1 transition-all duration-200"
                      >
                        <Star
                          className={`w-11 h-11 transition-all duration-200 ${
                            active
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                              : 'text-white/[0.08] hover:text-white/[0.15]'
                          }`}
                        />
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence mode="wait">
                  {nota > 0 && (
                    <motion.p
                      key={nota}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-center text-sm font-medium text-amber-400"
                    >
                      {STAR_LABELS[nota]}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Comment */}
              <AnimatePresence>
                {evalData.permite_comentario && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="text-[12px] text-[#94A3B8] font-medium">
                      Comentário <span className="text-white/20">(opcional)</span>
                    </label>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Conte como foi sua viagem..."
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] text-[#F8FAFC] text-sm placeholder:text-white/[0.15] px-4 py-3 resize-none focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                      style={{ fontSize: '16px' }}
                    />
                    <p className="text-[10px] text-white/20 text-right tabular-nums">{comentario.length}/500</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: nota > 0 ? 1.01 : 1 }}
                whileTap={{ scale: nota > 0 ? 0.98 : 1 }}
                disabled={nota === 0 || submitting}
                onClick={handleSubmit}
                className={`w-full h-12 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-300 ${
                  nota > 0
                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 cursor-pointer'
                    : 'bg-white/[0.04] text-white/20 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Avaliação
                  </>
                )}
              </motion.button>

              {/* Footer */}
              <p className="text-[10px] text-center text-white/[0.15]">
                Link de uso único · expira automaticamente
              </p>
            </div>
          </div>
        )}

        {/* Branding */}
        <p className="text-center text-[10px] text-white/[0.1] mt-6 tracking-wider">
          POWERED BY ESCRITÓRIO RF
        </p>
      </motion.div>
    </div>
  );
};

export default AvaliacaoPublica;
