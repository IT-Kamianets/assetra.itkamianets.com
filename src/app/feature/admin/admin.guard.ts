import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

/** Prerender gets the empty admin shell; in the browser a missing session goes to the login page. */
export const adminGuard: CanActivateFn = async (_route, state) => {
	const auth = inject(AdminAuthService);
	const router = inject(Router);

	if (!isPlatformBrowser(inject(PLATFORM_ID))) {
		return true;
	}

	await auth.ready;

	return auth.isLoggedIn() || router.createUrlTree(['/admin/login'], { queryParams: { next: state.url } });
};

/** Signed-in admins skip the login page. */
export const adminLoginGuard: CanActivateFn = async () => {
	const auth = inject(AdminAuthService);
	const router = inject(Router);

	if (!isPlatformBrowser(inject(PLATFORM_ID))) {
		return true;
	}

	await auth.ready;

	return !auth.isLoggedIn() || router.createUrlTree(['/admin/assets']);
};
