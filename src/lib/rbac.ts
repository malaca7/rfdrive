/**
 * RBAC — Role-Based Access Control
 * Hierarquia: CEO > ADMIN > MOTORISTA > CLIENTE
 */

export type AppRole = 'ceo' | 'admin' | 'motorista' | 'cliente';

// Hierarquia numérica: maior = mais alto
export const ROLE_LEVEL: Record<AppRole, number> = {
  ceo: 100,
  admin: 50,
  motorista: 10,
  cliente: 1,
};

// Permissões granulares
export type Permission =
  // Operações de corridas
  | 'corridas:read'
  | 'corridas:write'
  // Usuários
  | 'usuarios:read'
  | 'usuarios:write'
  | 'usuarios:delete'
  // Admins
  | 'admins:read'
  | 'admins:write'
  | 'admins:delete'
  | 'admins:promote_to_ceo'
  // Configurações
  | 'config:read'
  | 'config:write'
  // Financeiro
  | 'financeiro:read'
  | 'financeiro:write'
  // Preços
  | 'precos:read'
  | 'precos:write'
  // Avaliações
  | 'avaliacoes:read'
  | 'avaliacoes:write'
  // Controle de Acesso
  | 'acesso:read'
  | 'acesso:write'
  // CEO — único
  | 'ceo:manage'
  | 'platform:settings';

// Mapa de permissões por role
const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  ceo: [
    'corridas:read', 'corridas:write',
    'usuarios:read', 'usuarios:write', 'usuarios:delete',
    'admins:read', 'admins:write', 'admins:delete', 'admins:promote_to_ceo',
    'config:read', 'config:write',
    'financeiro:read', 'financeiro:write',
    'precos:read', 'precos:write',
    'avaliacoes:read', 'avaliacoes:write',
    'acesso:read', 'acesso:write',
    'ceo:manage', 'platform:settings',
  ],
  admin: [
    'corridas:read', 'corridas:write',
    'usuarios:read', 'usuarios:write',
    'avaliacoes:read', 'avaliacoes:write',
    'admins:read',
  ],
  motorista: [],
  cliente: [],
};

/**
 * Retorna o role efetivo mais alto do usuário
 */
export function getHighestRole(roles: string[]): AppRole {
  const validRoles = roles
    .map(r => String(r || '').toLowerCase())
    .filter(r => r in ROLE_LEVEL) as AppRole[];
  if (!validRoles.length) return 'cliente';
  return validRoles.reduce((best, r) =>
    ROLE_LEVEL[r] > ROLE_LEVEL[best] ? r : best, validRoles[0]);
}

/**
 * Verifica se o usuário tem uma determinada permissão
 */
export function hasPermission(roles: string[], permission: Permission): boolean {
  return roles.some(role => {
    const perms = ROLE_PERMISSIONS[role as AppRole] ?? [];
    return perms.includes(permission);
  });
}

/**
 * Verifica se o usuário tem o role mínimo exigido
 */
export function hasMinRole(roles: string[], minRole: AppRole): boolean {
  const userLevel = Math.max(
    0,
    ...roles.map(r => ROLE_LEVEL[r as AppRole] ?? 0)
  );
  return userLevel >= ROLE_LEVEL[minRole];
}

/**
 * Verifica se o usuário tem exatamente um role
 */
export function hasRole(roles: string[], role: AppRole): boolean {
  return roles.includes(role);
}

/**
 * CEOs podem gerenciar admins; admins não podem gerenciar CEOs
 */
export function canManageUser(actorRoles: string[], targetRole: AppRole): boolean {
  const actorLevel = Math.max(0, ...actorRoles.map(r => ROLE_LEVEL[r as AppRole] ?? 0));
  return actorLevel > ROLE_LEVEL[targetRole];
}

export const ROLE_LABELS: Record<AppRole, string> = {
  ceo: 'CEO',
  admin: 'Admin',
  motorista: 'Motorista',
  cliente: 'Cliente',
};

export const ROLE_COLORS: Record<AppRole, string> = {
  ceo: 'from-yellow-500 to-amber-400',
  admin: 'from-purple-500 to-violet-400',
  motorista: 'from-emerald-500 to-green-400',
  cliente: 'from-blue-500 to-cyan-400',
};

export const ROLE_BADGE_CLASS: Record<AppRole, string> = {
  ceo: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
  admin: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  motorista: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  cliente: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
};

export const ROLE_TEXT_CLASS: Record<AppRole, string> = {
  ceo: 'text-yellow-400',
  admin: 'text-purple-400',
  motorista: 'text-emerald-400',
  cliente: 'text-blue-400',
};
