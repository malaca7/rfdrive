import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Search, Loader2, Car, MessageSquare,
  ChevronDown, ChevronUp,
} from 'lucide-react';

type UserRecord = {
  id: string; nome: string; telefone: string; tipo: string; status: string;
  roles?: string[] | null; avatar_url?: string | null;
};

type EvalLink = {
  id: string;
  motorista_id: string;
  nota: number;
  comentario: string | null;
  respondida_em: string | null;
  created_at: string;
};

const AdminPerform: React.FC = () => {
  const [search, setSearch] = useState('');
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  // ── Fetch motoristas ──
  const { data: motoristas = [], isLoading: loadingMotoristas } = useQuery({
    queryKey: ['admin-motoristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, telefone, tipo, status, roles, avatar_url')
        .or('tipo.eq.motorista,roles.cs.{motorista}')
        .order('nome');
      if (error) throw error;
      return (data || []) as UserRecord[];
    },
  });

  // ── Fetch avaliações via links respondidos ──
  const { data: avaliacoes = [], isLoading: loadingAval } = useQuery({
    queryKey: ['admin-eval-links-respondidas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_links')
        .select('id, motorista_id, nota, comentario, respondida_em, created_at')
        .eq('status', 'respondida')
        .not('nota', 'is', null)
        .order('respondida_em', { ascending: false });
      if (error) throw error;
      return (data || []) as EvalLink[];
    },
  });

  // ── Aggregate stats per driver ──
  const driverStats = useMemo(() => {
    const map = new Map<string, { total: number; soma: number; avaliacoes: EvalLink[] }>();
    avaliacoes.forEach(a => {
      const existing = map.get(a.motorista_id) || { total: 0, soma: 0, avaliacoes: [] };
      existing.total++;
      existing.soma += a.nota;
      existing.avaliacoes.push(a);
      map.set(a.motorista_id, existing);
    });
    return map;
  }, [avaliacoes]);

  // ── Filtered motoristas ──
  const filteredMotoristas = useMemo(() => {
    const q = search.toLowerCase();
    return motoristas.filter(m => !q || m.nome.toLowerCase().includes(q) || m.telefone?.includes(q));
  }, [motoristas, search]);

  const isLoading = loadingMotoristas || loadingAval;

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" /> Avaliações
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Avaliações recebidas via links de clientes</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar motorista..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-lg font-bold">{motoristas.length}</p>
            <p className="text-[10px] text-muted-foreground">Motoristas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-lg font-bold text-yellow-400">{avaliacoes.length}</p>
            <p className="text-[10px] text-muted-foreground">Avaliações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-lg font-bold text-accent">
              {avaliacoes.length > 0 ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length).toFixed(1) : '-'}
            </p>
            <p className="text-[10px] text-muted-foreground">Média Geral</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-2">
          {filteredMotoristas.map(driver => {
            const stats = driverStats.get(driver.id);
            const media = stats ? (stats.soma / stats.total).toFixed(1) : '-';
            const isExpanded = expandedDriver === driver.id;

            return (
              <Card key={driver.id}>
                <CardContent className="py-0 px-0">
                  {/* Driver header */}
                  <button
                    onClick={() => setExpandedDriver(isExpanded ? null : driver.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center shrink-0">
                      {driver.avatar_url
                        ? <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <Car className="w-5 h-5 text-accent" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{driver.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} className={`w-3 h-3 ${i <= Math.round(stats?.soma ? stats.soma / stats.total : 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {media} ({stats?.total || 0})
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded: avaliações list */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-border/50">
                          {!stats || stats.avaliacoes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma avaliação recebida</p>
                          ) : (
                            <div className="space-y-2 mt-3">
                              {stats.avaliacoes.map(a => (
                                <div key={a.id} className="bg-muted/30 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map(i => (
                                          <Star key={i} className={`w-3 h-3 ${i <= a.nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                                        ))}
                                      </div>
                                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-accent/30 text-accent">cliente</Badge>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(a.respondida_em || a.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                  {a.comentario && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <MessageSquare className="w-3 h-3 inline mr-1" />
                                      {a.comentario}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPerform;
