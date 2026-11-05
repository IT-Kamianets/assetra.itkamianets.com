import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { createCapacitorElectronApp } from '@capawesome/capacitor-electron';

import config from './capacitor.electron.config';

createCapacitorElectronApp(config);

// Check GitHub Releases for a newer version on start (packaged builds only).
// Downloads in the background and installs on next quit; never blocks startup.
if (app.isPackaged) {
  app.whenReady().then(() => {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.warn('[updater] update check failed:', error);
    });
  });
}
