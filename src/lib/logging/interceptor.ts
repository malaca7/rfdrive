import { logSystemEvent } from './service';

let installed = false;

export function installGlobalLogInterceptors(getUserId?: () => string | null | undefined) {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    void logSystemEvent({
      userId: getUserId?.() ?? null,
      action: 'frontend_error',
      entity: 'window',
      details: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      level: 'error',
      errorMessage: event.error?.message ?? event.message,
      stackTrace: event.error?.stack ?? null,
      source: 'window.error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    void logSystemEvent({
      userId: getUserId?.() ?? null,
      action: 'frontend_unhandled_rejection',
      entity: 'promise',
      details: {
        reason: reason?.message || String(reason),
      },
      level: 'error',
      errorMessage: reason?.message ?? 'Unhandled promise rejection',
      stackTrace: reason?.stack ?? null,
      source: 'window.unhandledrejection',
    });
  });
}
