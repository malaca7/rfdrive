import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';

const APP_VERSION_NAME = '1.2';

interface VersionInfo {
  versionName: string;
  apkUrl: string;
}

const normalizeVersion = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

const isNewerVersion = (remoteVersion: string, currentVersion: string) => {
  const remoteParts = normalizeVersion(remoteVersion);
  const currentParts = normalizeVersion(currentVersion);
  const length = Math.max(remoteParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const remote = remoteParts[index] ?? 0;
    const current = currentParts[index] ?? 0;
    if (remote > current) return true;
    if (remote < current) return false;
  }

  return false;
};

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const checkUpdate = async () => {
      setChecking(true);
      try {
        const { data, error } = await supabase
          .from('app_releases')
          .select('version_name, public_url')
          .eq('is_current', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data?.public_url || !data?.version_name) return;

        if (isNewerVersion(data.version_name, APP_VERSION_NAME)) {
          setUpdateAvailable({
            versionName: data.version_name,
            apkUrl: data.public_url,
          });
        }
      } catch {
        // silently fail
      } finally {
        setChecking(false);
      }
    };

    checkUpdate();
  }, []);

  const doUpdate = async () => {
    if (!updateAvailable) return;
    try {
      await Browser.open({ url: updateAvailable.apkUrl });
    } catch {
      window.open(updateAvailable.apkUrl, '_system');
    }
  };

  return { updateAvailable, checking, doUpdate };
}
