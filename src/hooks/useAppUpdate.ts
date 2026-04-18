import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const APP_VERSION_CODE = 2;
const VERSION_URL = 'https://malaca7.github.io/rfdrive/version.json';

interface VersionInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const checkUpdate = async () => {
      setChecking(true);
      try {
        const res = await fetch(VERSION_URL, { cache: 'no-store' });
        if (!res.ok) return;
        const info: VersionInfo = await res.json();
        if (info.versionCode > APP_VERSION_CODE) {
          setUpdateAvailable(info);
        }
      } catch {
        // silently fail — no connection or server down
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
