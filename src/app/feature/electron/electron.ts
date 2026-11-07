import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';

/** True inside the Assetra desktop app (Capacitor Electron); false in a normal browser and on the server. */
export function isElectron(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	return Capacitor.getPlatform() === 'electron' || /\bElectron\//i.test(navigator.userAgent);
}

/**
 * Pages for the desktop app only. The server and prerender get the empty shell (these routes are
 * client-rendered anyway); in a browser the visitor goes back to the home page.
 */
export const electronGuard: CanActivateFn = () => {
	if (!isPlatformBrowser(inject(PLATFORM_ID))) {
		return true;
	}

	return isElectron() || inject(Router).createUrlTree(['/']);
};
