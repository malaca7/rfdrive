export type LogType = 'audit' | 'activity' | 'system';

export type SystemLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogEventInput = {
  type?: LogType;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  level?: SystemLogLevel;
  errorMessage?: string | null;
  stackTrace?: string | null;
  source?: string | null;
};

export type LogQueryFilters = {
  userId?: string;
  action?: string;
  entity?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};
