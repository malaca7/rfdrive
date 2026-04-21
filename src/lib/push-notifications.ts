import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Register device for Firebase Cloud Messaging push notifications.
 * Stores the FCM token in Supabase `push_tokens` table.
 */
export async function registerPush(userId: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[Push] Permission denied');
      return null;
    }

    // Register with FCM
    await PushNotifications.register();

    // Wait for registration event
    return new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10000);

      PushNotifications.addListener('registration', async (token: Token) => {
        clearTimeout(timeout);
        console.log('[Push] FCM token:', token.value);

        // Store token in Supabase
        try {
          await (supabase as any)
            .from('push_tokens')
            .upsert(
              {
                user_id: userId,
                token: token.value,
                platform: Capacitor.getPlatform(), // 'android' or 'ios'
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,token' }
            );
        } catch (err) {
          console.warn('[Push] Failed to store token:', err);
        }

        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (err) => {
        clearTimeout(timeout);
        console.warn('[Push] Registration error:', err);
        resolve(null);
      });
    });
  } catch (err) {
    console.warn('[Push] registerPush failed:', err);
    return null;
  }
}

/**
 * Set up listeners for incoming push notifications.
 * - Foreground: shows are handled by the app (toast/badge)
 * - Background tap: user tapped on notification, app opens
 */
export function setupPushListeners(callbacks?: {
  onReceived?: (notification: PushNotificationSchema) => void;
  onTapped?: (notification: ActionPerformed) => void;
}) {
  if (!Capacitor.isNativePlatform()) return () => {};

  // Notification received while app is in foreground
  const receivedListener = PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('[Push] Received in foreground:', notification.title);
      callbacks?.onReceived?.(notification);
    }
  );

  // Notification tapped (app was in background)
  const actionListener = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      console.log('[Push] Notification tapped:', action.notification.title);
      callbacks?.onTapped?.(action);
    }
  );

  // Return cleanup function
  return () => {
    receivedListener.then(l => l.remove());
    actionListener.then(l => l.remove());
  };
}

/**
 * Remove push token from Supabase (e.g., on logout).
 */
export async function unregisterPush(userId: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await (supabase as any)
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[Push] unregisterPush failed:', err);
  }
}
