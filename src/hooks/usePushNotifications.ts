import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { registerPush, setupPushListeners } from '@/lib/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Hook that initializes Firebase Cloud Messaging push notifications.
 * - Registers FCM token on mount (stores in push_tokens table)
 * - Sets up listeners for foreground + background notifications
 * - Invalidates notification queries when push arrives
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const registered = useRef(false);

  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform() || registered.current) return;
    registered.current = true;

    // Register for push & store token
    registerPush(user.id);

    // Set up listeners
    const cleanup = setupPushListeners({
      onReceived: () => {
        // Refresh notifications when push arrives in foreground
        qc.invalidateQueries({ queryKey: ['user-notifications'] });
      },
      onTapped: () => {
        // Refresh when user taps notification from background
        qc.invalidateQueries({ queryKey: ['user-notifications'] });
      },
    });

    return cleanup;
  }, [user?.id, qc]);
}
