import { supabase } from '@/integrations/supabase/client';
import type { LogEventInput, LogType } from './types';

const TABLE_BY_TYPE: Record<LogType, string> = {
  audit: 'audit_logs',
  activity: 'activity_logs',
  system: 'system_logs',
};

const SENSITIVE_KEYS = new Set([
  'senha',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'secret',
  'api_key',
  'service_role_key',
]);

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = sanitize(val);
  }

  return output;
};

const withFallback = async (payload: Record<string, unknown>) => {
  const { error } = await (supabase as any).from('platform_activity_log').insert({
    user_id: payload.user_id ?? null,
    action: payload.action,
    category: 'sistema',
    entity: payload.entity ?? null,
    entity_id: payload.entity_id ?? null,
    details: payload.details ?? null,
    created_at: payload.created_at,
  });

  if (error) {
    console.warn('logging fallback failed:', error.message);
  }
};

export async function insertLogEvent(input: LogEventInput): Promise<void> {
  const type: LogType = input.type ?? 'activity';
  const table = TABLE_BY_TYPE[type];

  const payload: Record<string, unknown> = {
    user_id: input.userId ?? null,
    action: input.action,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    before: sanitize(input.before ?? null),
    after: sanitize(input.after ?? null),
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    details: sanitize(input.details ?? null),
    created_at: new Date().toISOString(),
  };

  if (type === 'system') {
    payload.level = input.level ?? 'error';
    payload.error_message = input.errorMessage ?? null;
    payload.stack_trace = input.stackTrace ?? null;
  }

  const { error } = await (supabase as any).from(table).insert(payload);
  if (!error) return;

  console.warn(`insert ${table} failed:`, error.message);
  await withFallback(payload);
}
