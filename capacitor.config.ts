import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localizzou.app',
  appName: 'EscritorioRF',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://malaca7.github.io/rfdrive/',
    cleartext: false,
  },
};

export default config;
