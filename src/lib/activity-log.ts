import { supabase } from '@/integrations/supabase/client';
import { logActivityEvent } from '@/lib/logging';

export type ActivityCategory =
  | 'auth'
  | 'corridas'
  | 'usuarios'
  | 'avaliacoes'
  | 'financeiro'
  | 'config'
  | 'admin'
  | 'ceo'
  | 'sistema';

type LogParams = {
  userId?: string | null;
  action: string;
  category: ActivityCategory;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
};

/**
 * Log de atividade não bloqueante.
 * Nunca deve quebrar o fluxo principal da ação do usuário.
 */
export async function logPlatformActivity(params: LogParams): Promise<void> {
  try {
    await logActivityEvent({
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity ?? null,
      entityId: params.entityId ?? null,
      details: {
        category: params.category,
        ...(params.details || {}),
      },
      source: 'legacy.logPlatformActivity',
    });

    const payload = {
      user_id: params.userId ?? null,
      action: params.action,
      category: params.category,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('platform_activity_log').insert(payload);
    if (error) {
      // Tabela pode não existir ainda em ambientes legados.
      console.warn('platform_activity_log insert failed:', error.message);
    }
  } catch (err) {
    console.warn('platform_activity_log unexpected error:', err);
  }
}
