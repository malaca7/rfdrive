import React from 'react';
import CeoLayout from '@/components/CeoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Crown, Users, Truck, User, CheckCircle } from 'lucide-react';
import { ROLE_BADGE_CLASS, ROLE_LABELS, ROLE_LEVEL, type AppRole } from '@/lib/rbac';
import { motion } from 'framer-motion';

const ROLES_INFO: { role: AppRole; description: string; permissions: string[] }[] = [
  {
    role: 'ceo',
    description: 'Nível máximo de acesso. Controle total da plataforma.',
    permissions: [
      'Acesso a todas as áreas',
      'Gerenciar Admins e CEOs',
      'Configurações globais',
      'Financeiro e Preços',
      'Controle de Acesso',
      'Logs de auditoria',
    ],
  },
  {
    role: 'admin',
    description: 'Acesso operacional. Gerencia o dia a dia da plataforma.',
    permissions: [
      'Ver e gerenciar corridas',
      'Gerenciar usuários',
      'Avaliações e links',
      'Ver recibos',
      'Dashboard operacional',
    ],
  },
  {
    role: 'motorista',
    description: 'Acesso ao painel do motorista.',
    permissions: [
      'Registrar viagens',
      'Ver histórico pessoal',
      'Credencial digital',
      'Editar perfil',
    ],
  },
  {
    role: 'cliente',
    description: 'Acesso básico ao app.',
    permissions: [
      'Solicitar corridas',
      'Ver histórico',
    ],
  },
];

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  ceo: <Crown className="w-5 h-5 text-white" />,
  admin: <Shield className="w-5 h-5 text-white" />,
  motorista: <Truck className="w-5 h-5 text-white" />,
  cliente: <User className="w-5 h-5 text-white" />,
};

const ROLE_GRADIENT: Record<AppRole, string> = {
  ceo: 'from-yellow-500 to-amber-400',
  admin: 'from-purple-500 to-violet-400',
  motorista: 'from-emerald-500 to-green-400',
  cliente: 'from-blue-500 to-cyan-400',
};

const CeoAcessos: React.FC = () => {
  return (
    <CeoLayout>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-yellow-400" />
          <h1 className="text-xl font-extrabold">Controle de Acesso</h1>
        </div>
        <p className="text-xs text-muted-foreground">Hierarquia e permissões de cada cargo na plataforma</p>
      </div>

      {/* Hierarquia visual */}
      <Card className="border-yellow-400/20 mb-5">
        <CardContent className="p-4">
          <h2 className="text-sm font-bold mb-3 text-yellow-400">Hierarquia de Cargos</h2>
          <div className="space-y-2">
            {(['ceo', 'admin', 'motorista', 'cliente'] as AppRole[]).map((role, i) => (
              <div key={role} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${ROLE_GRADIENT[role]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  {ROLE_ICONS[role]}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGE_CLASS[role]}`}>
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="text-xs text-muted-foreground">Nível {ROLE_LEVEL[role]}</span>
                </div>
                {i < 3 && (
                  <div className="text-xs text-muted-foreground">↑ superior</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalhes de cada cargo */}
      <div className="space-y-3">
        {ROLES_INFO.map((info, i) => (
          <motion.div
            key={info.role}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={`border ${info.role === 'ceo' ? 'border-yellow-400/30 bg-yellow-500/5' : 'border-border/40'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ROLE_GRADIENT[info.role]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    {ROLE_ICONS[info.role]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGE_CLASS[info.role]}`}>
                        {ROLE_LABELS[info.role]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                  </div>
                </div>
                <div className="space-y-1.5 pl-2">
                  {info.permissions.map(perm => (
                    <div key={perm} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{perm}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Nota de escalabilidade */}
      <Card className="mt-5 border-border/30 bg-muted/20">
        <CardContent className="p-4">
          <h3 className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Escalabilidade</h3>
          <p className="text-xs text-muted-foreground">
            O sistema RBAC está preparado para novas roles futuras (ex: <code className="bg-muted px-1 rounded text-foreground">supervisor</code>, <code className="bg-muted px-1 rounded text-foreground">financeiro</code>). 
            Basta adicionar o novo cargo em <code className="bg-muted px-1 rounded text-foreground">src/lib/rbac.ts</code> com suas permissões e níveis.
          </p>
        </CardContent>
      </Card>
    </CeoLayout>
  );
};

export default CeoAcessos;
