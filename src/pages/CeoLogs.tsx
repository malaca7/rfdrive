import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CeoLayout from '@/components/CeoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Activity, Search, Shield, Car, Users, Star, DollarSign, Settings, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getHighestRole, ROLE_BADGE_CLASS, ROLE_LABELS, type AppRole } from '@/lib/rbac';

type LogItem = {
  id: string;
  created_at: string;
  category: 'atividade' | 'rbac' | 'corridas' | 'usuarios' | 'avaliacoes' | 'financeiro' | 'config' | 'sistema';
  action: string;
  title: string;
  description: string;
  actorName: string;
  actorRoleLabel?: string;
  actorRoleClass?: string;
  targetName?: string;
  reference?: string;
  detailsList?: string[];
  severity: 'info' | 'warn' | 'success';
};

const CATEGORY_META = {
  atividade: { label: 'Atividade Geral', icon: Activity, color: 'text-cyan-400' },
  rbac: { label: 'Acesso Administrativo', icon: Shield, color: 'text-yellow-400' },
  corridas: { label: 'Corridas', icon: Car, color: 'text-violet-400' },
  usuarios: { label: 'Usuários', icon: Users, color: 'text-blue-400' },
  avaliacoes: { label: 'Avaliações', icon: Star, color: 'text-pink-400' },
  financeiro: { label: 'Financeiro', icon: DollarSign, color: 'text-emerald-400' },
  config: { label: 'Configuração', icon: Settings, color: 'text-amber-400' },
  sistema: { label: 'Sistema', icon: Activity, color: 'text-red-400' },
} as const;

const severityClass = {
  info: 'border-blue-400/30 bg-blue-500/5',
  warn: 'border-orange-400/30 bg-orange-500/5',
  success: 'border-emerald-400/30 bg-emerald-500/5',
};

const fmtDate = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
};

const formatAction = (action: string) => {
  const a = String(action || '').toLowerCase();
  if (a === 'promote_to_ceo') return 'Promover para CEO';
  if (a === 'promote_to_admin') return 'Promover para Admin';
  if (a === 'demote_ceo_to_admin') return 'Rebaixar CEO para Admin';
  if (a === 'demote_to_motorista') return 'Rebaixar para Motorista';
  if (a === 'delete_admin') return 'Remoção de usuário administrativo';
  if (a === 'edit_admin_user') return 'Edição de usuário administrativo';
  return a.replace(/_/g, ' ') || 'Ação registrada';
};

const detailsToList = (details: unknown): string[] => {
  if (!details) return [];
  if (typeof details === 'string') return [details];
  if (typeof details !== 'object') return [String(details)];

  const obj = details as Record<string, unknown>;
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && String(v) !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .slice(0, 6);
};

const getActorRoleMeta = (tipo?: string | null, roles?: string[] | null) => {
  const normalizedRoles = (roles || []).map(r => String(r || '').toLowerCase()).filter(Boolean);
  const fallbackTipo = String(tipo || '').toLowerCase();
  const effectiveRoles = normalizedRoles.length > 0
    ? normalizedRoles
    : (fallbackTipo ? [fallbackTipo] : []);

  if (effectiveRoles.length === 0) return null;

  const highestRole = getHighestRole(effectiveRoles) as AppRole;
  return {
    label: ROLE_LABELS[highestRole],
    className: ROLE_BADGE_CLASS[highestRole],
  };
};

const CeoLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | LogItem['category']>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['ceo-platform-logs'],
    queryFn: async () => {
      const logsOut: LogItem[] = [];

      const [activityRes, rbacRes, systemRes, legacyActivityRes, legacyRbacRes, ridesRes, usersRes, ratingsRes, pricingRes, platformRes] = await Promise.all([
        supabase.from('activity_logs').select('id, user_id, action, entity, entity_id, details, created_at').order('created_at', { ascending: false }).limit(400),
        supabase.from('audit_logs').select('id, user_id, action, entity, entity_id, details, created_at').order('created_at', { ascending: false }).limit(300),
        supabase.from('system_logs').select('id, user_id, action, entity, entity_id, details, level, error_message, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('platform_activity_log').select('id, user_id, action, category, entity, entity_id, details, created_at').order('created_at', { ascending: false }).limit(250),
        supabase.from('rbac_audit_log').select('id, action, details, created_at, actor_id, target_id').order('created_at', { ascending: false }).limit(200),
        supabase.from('corridas').select('id, status, valor, created_at, concluida_at, motorista_id').order('created_at', { ascending: false }).limit(300),
        supabase.from('users').select('id, nome, tipo, status, created_at').order('created_at', { ascending: false }).limit(300),
        supabase.from('avaliacoes').select('id, nota, created_at, cliente_id').order('created_at', { ascending: false }).limit(200),
        supabase.from('config_tarifas').select('id, updated_at').order('updated_at', { ascending: false }).limit(20),
        supabase.from('config_plataforma').select('id, updated_at').order('updated_at', { ascending: false }).limit(20),
      ]);

      const peopleMap = new Map<string, { name: string; roleLabel?: string; roleClass?: string }>();
      // Always populate peopleMap with all referenced user IDs
      {
        const ids: string[] = [];
        if (!activityRes.error && activityRes.data) {
          for (const row of activityRes.data) { if (row.user_id) ids.push(row.user_id); }
        }
        if (!rbacRes.error && rbacRes.data) {
          for (const row of rbacRes.data) { if (row.user_id) ids.push(row.user_id); }
        }
        if (!systemRes.error && systemRes.data) {
          for (const row of systemRes.data) { if (row.user_id) ids.push(row.user_id); }
        }
        if (!legacyActivityRes.error && legacyActivityRes.data) {
          for (const row of legacyActivityRes.data) { if (row.user_id) ids.push(row.user_id); }
        }
        if (!legacyRbacRes.error && legacyRbacRes.data) {
          for (const row of legacyRbacRes.data) {
            if (row.actor_id) ids.push(row.actor_id);
            if (row.target_id) ids.push(row.target_id);
          }
        }
        // Also include all users so we can resolve corrida motorista_ids etc
        if (!usersRes.error && usersRes.data) {
          for (const row of usersRes.data) { ids.push(row.id); }
        }
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (uniqueIds.length > 0) {
          const { data: people } = await supabase
            .from('users')
            .select('id, nome, telefone, tipo, roles')
            .in('id', uniqueIds);
          for (const p of people || []) {
            const roleMeta = getActorRoleMeta((p as any).tipo, (p as any).roles);
            peopleMap.set(p.id, {
              name: p.nome || p.telefone || p.id,
              roleLabel: roleMeta?.label,
              roleClass: roleMeta?.className,
            });
          }
        }
      }

      if (!activityRes.error && activityRes.data) {
        for (const row of activityRes.data) {
          const actor = row.user_id ? peopleMap.get(row.user_id) : null;
          const detailsList = detailsToList(row.details);
          const categoryRaw = String((row.details as any)?.category || '').toLowerCase();
          const mappedCategory: LogItem['category'] =
            categoryRaw === 'corridas' ? 'corridas'
              : categoryRaw === 'usuarios' ? 'usuarios'
              : categoryRaw === 'avaliacoes' ? 'avaliacoes'
              : categoryRaw === 'financeiro' ? 'financeiro'
              : categoryRaw === 'config' ? 'config'
              : categoryRaw === 'admin' || categoryRaw === 'ceo' || categoryRaw === 'auth' || categoryRaw === 'sistema'
                ? 'atividade'
                : 'atividade';

          logsOut.push({
            id: `activity-${row.id}`,
            created_at: row.created_at,
            category: mappedCategory,
            action: String(row.action || 'atividade'),
            title: formatAction(String(row.action || 'atividade')),
            description: 'Atividade registrada por usuário na plataforma',
            actorName: actor?.name || row.user_id || 'Sistema',
            actorRoleLabel: actor?.roleLabel,
            actorRoleClass: actor?.roleClass,
            targetName: row.entity ? `${row.entity}${row.entity_id ? ` (${row.entity_id})` : ''}` : undefined,
            reference: `ID atividade: ${row.id}`,
            detailsList,
            severity: String(row.action || '').includes('delete') ? 'warn' : String(row.action || '').includes('promote') || String(row.action || '').includes('demote') ? 'success' : 'info',
          });
        }
      }

      if (!systemRes.error && systemRes.data) {
        for (const row of systemRes.data) {
          const actor = row.user_id ? peopleMap.get(row.user_id) : null;
          logsOut.push({
            id: `system-${row.id}`,
            created_at: row.created_at,
            category: 'sistema',
            action: String(row.action || 'system_error'),
            title: formatAction(String(row.action || 'system_error')),
            description: String(row.error_message || 'Erro de sistema registrado'),
            actorName: actor?.name || row.user_id || 'Sistema',
            actorRoleLabel: actor?.roleLabel,
            actorRoleClass: actor?.roleClass,
            targetName: row.entity ? `${row.entity}${row.entity_id ? ` (${row.entity_id})` : ''}` : undefined,
            reference: `ID system log: ${row.id}`,
            detailsList: detailsToList(row.details),
            severity: 'warn',
          });
        }
      }

      if (!rbacRes.error && rbacRes.data) {
        for (const row of rbacRes.data) {
          const action = String(row.action || 'acao_admin');
          const actor = row.user_id ? peopleMap.get(row.user_id) : null;
          const target = row.entity_id ? row.entity_id : undefined;
          const detailsList = detailsToList(row.details);
          logsOut.push({
            id: `rbac-${row.id}`,
            created_at: row.created_at,
            category: 'rbac',
            action,
            title: formatAction(action),
            description: 'Ação crítica registrada no controle administrativo',
            actorName: actor?.name || row.user_id || 'Sistema',
            actorRoleLabel: actor?.roleLabel,
            actorRoleClass: actor?.roleClass,
            targetName: target,
            reference: `ID log: ${row.id}`,
            detailsList,
            severity: action.includes('delete') ? 'warn' : action.includes('promote') || action.includes('demote') ? 'success' : 'info',
          });
        }
      }

      if (!legacyActivityRes.error && legacyActivityRes.data) {
        for (const row of legacyActivityRes.data) {
          const actor = row.user_id ? peopleMap.get(row.user_id) : null;
          logsOut.push({
            id: `legacy-activity-${row.id}`,
            created_at: row.created_at,
            category: 'atividade',
            action: String(row.action || 'atividade_legacy'),
            title: `${formatAction(String(row.action || 'atividade_legacy'))} (legacy)`,
            description: 'Registro legado da trilha de atividade',
            actorName: actor?.name || row.user_id || 'Sistema',
            actorRoleLabel: actor?.roleLabel,
            actorRoleClass: actor?.roleClass,
            targetName: row.entity ? `${row.entity}${row.entity_id ? ` (${row.entity_id})` : ''}` : undefined,
            reference: `ID legacy: ${row.id}`,
            detailsList: detailsToList(row.details),
            severity: 'info',
          });
        }
      }

      if (!legacyRbacRes.error && legacyRbacRes.data) {
        for (const row of legacyRbacRes.data) {
          const action = String(row.action || 'acao_admin_legacy');
          const actor = row.actor_id ? peopleMap.get(row.actor_id) : null;
          logsOut.push({
            id: `legacy-rbac-${row.id}`,
            created_at: row.created_at,
            category: 'rbac',
            action,
            title: `${formatAction(action)} (legacy)`,
            description: 'Registro legado de auditoria RBAC',
            actorName: actor?.name || row.actor_id || 'Sistema',
            actorRoleLabel: actor?.roleLabel,
            actorRoleClass: actor?.roleClass,
            targetName: row.target_id ? (peopleMap.get(row.target_id) || row.target_id) : undefined,
            reference: `ID legacy RBAC: ${row.id}`,
            detailsList: detailsToList(row.details),
            severity: action.includes('delete') ? 'warn' : 'info',
          });
        }
      }

      if (!ridesRes.error && ridesRes.data) {
        for (const row of ridesRes.data) {
          const status = String(row.status || 'pendente');
          const motoristaInfo = row.motorista_id ? peopleMap.get(row.motorista_id) : null;
          logsOut.push({
            id: `ride-${row.id}`,
            created_at: row.concluida_at || row.created_at,
            category: 'corridas',
            action: `corrida_${status}`,
            title: `Corrida ${status}`,
            description: row.valor != null ? `Valor: R$ ${Number(row.valor).toFixed(2).replace('.', ',')}` : 'Corrida sem valor final registrado',
            actorName: motoristaInfo?.name || 'Motorista não identificado',
            actorRoleLabel: motoristaInfo?.roleLabel,
            actorRoleClass: motoristaInfo?.roleClass,
            reference: `ID corrida: ${row.id}`,
            detailsList: [
              `Status: ${status}`,
              row.valor != null ? `Valor final: R$ ${Number(row.valor).toFixed(2).replace('.', ',')}` : 'Valor final não disponível',
            ],
            severity: status === 'aceita' || status === 'aprovada' ? 'success' : status === 'rejeitada' ? 'warn' : 'info',
          });
        }
      }

      if (!usersRes.error && usersRes.data) {
        for (const row of usersRes.data) {
          logsOut.push({
            id: `user-${row.id}`,
            created_at: row.created_at,
            category: 'usuarios',
            action: 'usuario_registrado',
            title: `Usuário registrado: ${row.nome}`,
            description: `Tipo: ${row.tipo} | Status: ${row.status}`,
            actorName: row.nome || 'Novo usuário',
            targetName: row.nome,
            reference: `ID usuário: ${row.id}`,
            detailsList: [
              `Tipo: ${row.tipo}`,
              `Status: ${row.status}`,
            ],
            severity: row.status === 'ativo' ? 'success' : 'warn',
          });
        }
      }

      if (!ratingsRes.error && ratingsRes.data) {
        for (const row of ratingsRes.data) {
          logsOut.push({
            id: `rating-${row.id}`,
            created_at: row.created_at,
            category: 'avaliacoes',
            action: 'avaliacao_registrada',
            title: 'Nova avaliação registrada',
            description: `Nota: ${row.nota ?? '-'} estrelas`,
            actorName: (row.cliente_id && peopleMap.get(row.cliente_id)?.name) || 'Cliente',
            actorRoleLabel: row.cliente_id ? peopleMap.get(row.cliente_id)?.roleLabel : undefined,
            actorRoleClass: row.cliente_id ? peopleMap.get(row.cliente_id)?.roleClass : undefined,
            reference: `ID avaliação: ${row.id}`,
            detailsList: [`Nota: ${row.nota ?? '-'}`],
            severity: Number(row.nota || 0) >= 4 ? 'success' : 'info',
          });
        }
      }

      if (!pricingRes.error && pricingRes.data) {
        for (const row of pricingRes.data) {
          if (!row.updated_at) continue;
          logsOut.push({
            id: `pricing-${row.id}-${row.updated_at}`,
            created_at: row.updated_at,
            category: 'financeiro',
            action: 'tarifas_atualizadas',
            title: 'Tabela de tarifas atualizada',
            description: 'Configuração de preços/tarifas modificada',
            actorName: 'Administração',
            reference: `Config tarifa: ${row.id}`,
            detailsList: ['Alteração em regras de preço/tarifa detectada'],
            severity: 'warn',
          });
        }
      }

      if (!platformRes.error && platformRes.data) {
        for (const row of platformRes.data) {
          if (!row.updated_at) continue;
          logsOut.push({
            id: `platform-${row.id}-${row.updated_at}`,
            created_at: row.updated_at,
            category: 'config',
            action: 'config_global_atualizada',
            title: 'Configuração global alterada',
            description: 'Nome, logo, slogan ou parâmetros globais foram atualizados',
            actorName: 'Administração',
            reference: `Config plataforma: ${row.id}`,
            detailsList: ['Parâmetros globais modificados'],
            severity: 'warn',
          });
        }
      }

      return logsOut
        .filter(l => !!l.created_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 600);
    },
    refetchInterval: 10_000,
    staleTime: 10_000,
  });

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (category !== 'all' && l.category !== category) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        l.title.toLowerCase().includes(q)
        || l.description.toLowerCase().includes(q)
        || l.action.toLowerCase().includes(q)
        || l.actorName.toLowerCase().includes(q)
        || String(l.targetName || '').toLowerCase().includes(q)
        || (l.detailsList || []).join(' ').toLowerCase().includes(q)
      );
    });
  }, [logs, category, search]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      criticos: logs.filter(l => l.severity === 'warn').length,
      positivos: logs.filter(l => l.severity === 'success').length,
      agora: logs.filter(l => {
        const dt = new Date(l.created_at).getTime();
        return Date.now() - dt <= 60 * 60 * 1000;
      }).length,
    };
  }, [logs]);

  return (
    <CeoLayout>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Activity className="w-5 h-5 text-yellow-400" /> Logs da Plataforma
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Histórico consolidado de movimentações da plataforma (sem logs de acesso e visualização de páginas)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Card className="border-yellow-400/20"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Eventos totais</p><p className="text-xl font-extrabold">{stats.total}</p></CardContent></Card>
        <Card className="border-orange-400/20"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Alterações críticas</p><p className="text-xl font-extrabold text-orange-400">{stats.criticos}</p></CardContent></Card>
        <Card className="border-emerald-400/20"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Eventos positivos</p><p className="text-xl font-extrabold text-emerald-400">{stats.positivos}</p></CardContent></Card>
        <Card className="border-blue-400/20"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Última hora</p><p className="text-xl font-extrabold text-blue-400">{stats.agora}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Buscar por ação, descrição, categoria..." />
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-muted/30 p-1 rounded-xl overflow-x-auto">
        {(['all', 'atividade', 'rbac', 'corridas', 'usuarios', 'avaliacoes', 'financeiro', 'config'] as const).map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
              category === c ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {c === 'all' ? 'Todos' : CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Carregando logs...</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum log encontrado com os filtros atuais.</CardContent></Card>
          )}
          {filtered.map((log, i) => {
            const meta = CATEGORY_META[log.category];
            const Icon = meta.icon;
            const isExpanded = expandedLogId === log.id;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.01, 0.2) }}
              >
                <Card className={`${severityClass[log.severity]} border`}>
                  <CardContent className="p-3.5">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
                            <Icon className={`w-4 h-4 ${meta.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold truncate">{log.title}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground">{formatAction(log.action)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-foreground/90">
                              <span className="text-muted-foreground">Por:</span>
                              <span>{log.actorName}</span>
                              {log.actorRoleLabel && log.actorRoleClass && (
                                <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${log.actorRoleClass}`}>
                                  {log.actorRoleLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-semibold text-muted-foreground">{meta.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(log.created_at)}</p>
                          <ChevronDown className={`w-4 h-4 ml-auto mt-1 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
                            {log.targetName && <p className="text-[11px] text-foreground/90"><span className="text-muted-foreground">Alvo:</span> {log.targetName}</p>}
                            {log.reference && <p className="text-[10px] text-muted-foreground">{log.reference}</p>}
                            {(log.detailsList || []).map((d, idx) => (
                              <p key={idx} className="text-[10px] text-muted-foreground">• {d}</p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </CeoLayout>
  );
};

export default CeoLogs;
