import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppShell from '@/components/AppShell';
import { motion } from 'framer-motion';
import {
  Star, TrendingUp, DollarSign, CheckCircle, Clock,
  ChevronRight, Loader2, BarChart3,
} from 'lucide-react';

const MotoristaDashboard: React.FC = () => {
  const { user, profile } = useAuth();

  // ── Corridas concluídas (aprovadas + em_analise) ──
  const { data: completedRides, isLoading } = useQuery({
    queryKey: ['meu-desempenho', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corridas')
        .select('id, origem_texto, destino_texto, valor, status, concluida_at, created_at')
        .eq('motorista_id', user!.id)
        .in('status', ['em_analise', 'aprovada', 'finalizada'])
        .order('concluida_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // ── Média de avaliação ──
  const { data: avgRating } = useQuery({
    queryKey: ['driver-avg-rating', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('motorista_id', user!.id);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum, r) => sum + r.nota, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!user,
  });

  // ── Stats computados ──
  const totalViagens = completedRides?.length || 0;
  const viagensAprovadas = completedRides?.filter(r => r.status === 'aprovada' || r.status === 'finalizada').length || 0;
  const viagensPendentes = completedRides?.filter(r => r.status === 'em_analise').length || 0;
  const receitaTotal = completedRides
    ?.filter(r => r.status === 'aprovada' || r.status === 'finalizada')
    .reduce((sum, r) => sum + (r.valor || 0), 0) || 0;

  // ── Viagens da semana ──
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const viagensSemana = completedRides?.filter(r => {
    const d = new Date(r.concluida_at || r.created_at);
    return d >= weekStart;
  }).length || 0;

  return (
    <AppShell>
      <div className="w-full px-[4%] py-[3%] max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[4%]">
          <h1 className="text-[clamp(1.5rem,5vw,2rem)] font-extrabold leading-tight">
            Olá, <span className="text-gradient">{profile?.nome || 'Motorista'}</span>
          </h1>
          <p className="text-muted-foreground text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1">
            Seu desempenho pessoal
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-[3%] mb-[4%]">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="border-accent/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 mx-auto mb-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-accent">{viagensAprovadas}</p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Aprovadas</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-green-500/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10 mx-auto mb-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-green-400">
                      R$ {receitaTotal.toFixed(0)}
                    </p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Receita Total</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-yellow-500/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/10 mx-auto mb-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-yellow-400">{viagensPendentes}</p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Pendentes</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-blue-500/20">
                  <CardContent className="py-[12%] text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 mx-auto mb-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold text-blue-400">{viagensSemana}</p>
                    <p className="text-[clamp(0.6rem,2vw,0.7rem)] text-muted-foreground font-medium">Esta Semana</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Rating */}
            {avgRating && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="mb-[4%] border-yellow-500/20 bg-yellow-500/5">
                  <CardContent className="py-3 flex items-center justify-between px-[4%]">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-lg text-yellow-400">{avgRating.avg}</span>
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{avgRating.count} avaliação{avgRating.count > 1 ? 'ões' : ''}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Recent trips */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Viagens Recentes
                </h2>
                <Badge variant="outline" className="text-xs">{totalViagens} total</Badge>
              </div>
              {completedRides && completedRides.length > 0 ? (
                <div className="space-y-2">
                  {completedRides.slice(0, 15).map((ride) => (
                    <Card key={ride.id} className="border-border/50">
                      <CardContent className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {ride.concluida_at
                              ? new Date(ride.concluida_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : new Date(ride.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                          <div className="flex items-center gap-2">
                            {ride.valor != null && (
                              <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
                                R$ {ride.valor.toFixed(2)}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={
                                ride.status === 'aprovada' || ride.status === 'finalizada'
                                  ? 'text-green-400 border-green-500/30 text-[10px]'
                                  : 'text-yellow-400 border-yellow-500/30 text-[10px]'
                              }
                            >
                              {ride.status === 'aprovada' || ride.status === 'finalizada' ? '✅' : '⏳'} {ride.status === 'em_analise' ? 'Análise' : 'Aprovada'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-xs truncate">{ride.origem_texto}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                          <span className="text-xs truncate">{ride.destino_texto}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma viagem registrada ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">Registre viagens na aba "Viagens"</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default MotoristaDashboard;
