import { insertLogEvent } from './repository';
import type { LogEventInput } from './types';

const getClientIp = () => null;

const getUserAgent = () => {
  if (typeof navigator === 'undefined') return null;
  return navigator.userAgent || null;
};

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await insertLogEvent({
      ...input,
      ip: input.ip ?? getClientIp(),
      userAgent: input.userAgent ?? getUserAgent(),
      details: {
        source: input.source ?? 'web-app',
        ...(input.details || {}),
      },
    });
  } catch (error) {
    console.warn('logEvent failed:', error);
  }
}

export async function logAuditEvent(input: Omit<LogEventInput, 'type'>): Promise<void> {
  await logEvent({ ...input, type: 'audit' });
}

export async function logActivityEvent(input: Omit<LogEventInput, 'type'>): Promise<void> {
  await logEvent({ ...input, type: 'activity' });
}

export async function logSystemEvent(input: Omit<LogEventInput, 'type'>): Promise<void> {
  await logEvent({ ...input, type: 'system' });
}

export async function withLogInterceptor<T>(
  input: Omit<LogEventInput, 'before' | 'after'> & { before?: Record<string, unknown> | null },
  run: () => Promise<T>,
  toAfter?: (result: T) => Record<string, unknown> | null,
): Promise<T> {
  try {
    const result = await run();
    await logEvent({
      ...input,
      after: toAfter ? toAfter(result) : null,
    });
    return result;
  } catch (error: any) {
    await logSystemEvent({
      userId: input.userId,
      action: `${input.action}_error`,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before ?? null,
      details: {
        ...(input.details || {}),
        stage: 'withLogInterceptor',
      },
      level: 'error',
      errorMessage: error?.message ?? 'Unknown error',
      stackTrace: error?.stack ?? null,
      source: input.source ?? 'web-app',
    });
    throw error;
  }
}
