import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localizzou.app',
  appName: 'RF Drive',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
