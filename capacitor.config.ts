import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.itkamianets.assetra',
  appName: 'Assetra',
  webDir: 'dist/app/browser',
  // Desktop app against a dev server (live reload): ASSETRA_DEV_URL=http://localhost:4200 npm run electron:dev
  ...(process.env['ASSETRA_DEV_URL'] ? { server: { url: process.env['ASSETRA_DEV_URL'] } } : {})
};

export default config;
