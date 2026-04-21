import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let channelCreated = false;

const CHANNEL_ID = 'ride_notifications';
const CHANNEL_NAME = 'Notificações';

/**
 * Create notification channel for Android 8+.
 * Must be called before scheduling any notification.
 */
async function ensureChannel() {
  if (channelCreated) return;
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      description: 'Notificações de viagens e alertas da plataforma',
      importance: 5, // max
      visibility: 1, // public
      vibration: true,
      sound: 'default',
      lights: true,
      lightColor: '#6366f1',
    });
    channelCreated = true;
  } catch {
    // Channel may already exist — that's fine
    channelCreated = true;
  }
}

/**
 * Request permission for native local notifications (Android/iOS).
 * On web, this is a no-op.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await ensureChannel();
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check if we already have permission.
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Show a native local notification on Android/iOS.
 * Fires immediately (no schedule delay) to avoid timing issues in Capacitor WebView.
 */
export async function showNativeNotification(opts: {
  title: string;
  body: string;
  id?: number;
}) {
  if (!Capacitor.isNativePlatform()) return;

  // Always check permission fresh — the module-level flag can be stale after app restart
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
  } catch {
    return;
  }

  await ensureChannel();

  try {
    const notifId = opts.id ?? Math.floor(Math.random() * 2147483646) + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          title: opts.title,
          body: opts.body,
          id: notifId,
          channelId: CHANNEL_ID,
          // Schedule 1s in the future to ensure it's always in the future
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          smallIcon: 'ic_launcher',
          largeIcon: 'ic_launcher',
          iconColor: '#6366f1',
        },
      ],
    });
  } catch (err) {
    console.warn('[NativeNotif] schedule failed:', err);
  }
}
