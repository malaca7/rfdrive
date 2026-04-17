import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localizzou.app',
  appName: 'RF Drive',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Browser: {
      // Opens URLs in external browser / apps
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
