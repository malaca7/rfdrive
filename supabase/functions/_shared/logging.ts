import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

type LogType = 'audit' | 'activity' | 'system';

type LogPayload = {
  type: LogType;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  errorMessage?: string | null;
  stackTrace?: string | null;
};

const tableByType: Record<LogType, string> = {
  audit: 'audit_logs',
  activity: 'activity_logs',
  system: 'system_logs',
};

export async function logEvent(payload: LogPayload): Promise<void> {
  const table = tableByType[payload.type];

  const body: Record<string, unknown> = {
    user_id: payload.userId ?? null,
    action: payload.action,
    entity: payload.entity ?? null,
    entity_id: payload.entityId ?? null,
    before: payload.before ?? null,
    after: payload.after ?? null,
    details: payload.details ?? null,
    ip: payload.ip ?? null,
    user_agent: payload.userAgent ?? null,
    created_at: new Date().toISOString(),
  };

  if (payload.type === 'system') {
    body.level = payload.level ?? 'error';
    body.error_message = payload.errorMessage ?? null;
    body.stack_trace = payload.stackTrace ?? null;
  }

  const { error } = await db.from(table).insert(body);
  if (error) {
    console.warn(`[logging] failed insert into ${table}:`, error.message);
  }
}

export function getRequestContext(req: Request) {
  return {
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    userAgent: req.headers.get('user-agent') || null,
  };
}
