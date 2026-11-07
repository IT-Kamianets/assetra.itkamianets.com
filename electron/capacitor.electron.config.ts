import { defineConfig } from '@capawesome/capacitor-electron/config';

// The default policy blocks what the prerendered site needs: Google Fonts (Inter, Manrope, Material
// Symbols), model previews from the Assetra CDN, blob: for the 3D viewer, and the inline scripts that
// Angular SSR writes into every page (they switch the stylesheet on and replay early clicks). Without
// them pages load half-styled. The app only runs its own bundled files, so inline scripts are allowed.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob: https:",
  "connect-src 'self' blob: data: https: wss:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Same allowances for dev-server mode (ASSETRA_DEV_URL), plus what HMR needs: eval and websockets.
const devCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob: https:",
  "connect-src 'self' blob: data: https: wss: ws: http:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export default defineConfig({
  csp: { policy: csp, devPolicy: devCsp },
  // assetra://login?code=... brings the desktop Google sign-in back from the system browser.
  deepLinks: { scheme: 'assetra' },
  window: {
    width: 1200,
    height: 800,
  },
  hooks: {
    // No File / Edit / View / Window menu bar (macOS keeps its own app menu, which cannot be removed per window).
    onWindowCreated: (window) => {
      if (process.platform !== 'darwin') {
        window.removeMenu();
      }
    },
  },
  // A splash screen is shown automatically while the app boots when a splash
  // file exists (`assets/splash.html` or `assets/splash.png`). Uncomment to
  // customize it:
  // splashScreen: {
  //   path: 'assets/splash.html',
  //   width: 400,
  //   height: 300,
  //   backgroundColor: '#ffffff',
  //   minimumDurationMs: 0,
  // },
  // Per-plugin config overrides. Merged over the `plugins` section of the
  // Capacitor config (this section wins per key) — the Electron equivalent of
  // Android string resources / iOS Info.plist plugin settings. Being
  // TypeScript, values can be computed, e.g. a live-update channel derived
  // from the app version (`import packageJson from './package.json'`):
  // plugins: {
  //   LiveUpdate: {
  //     defaultChannel: `production-${packageJson.version}`,
  //   },
  // },
});
