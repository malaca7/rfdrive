import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rf.app',
  appName: 'Escritório RF',
  webDir: 'dist',
  server: {
    // Live Updates: carrega sempre do GitHub Pages
    url: 'https://malaca7.github.io/rfdrive/',
    cleartext: true,
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
