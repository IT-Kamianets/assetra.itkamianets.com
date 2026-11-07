import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../feature/auth/auth.service';

type Step = 'loading' | 'ready' | 'sending' | 'done' | 'error';

/**
 * Opened in the system browser by the Assetra desktop app. The visitor signs in here as on the site
 * (Google works in a normal browser), confirms, and the page hands a one-time code back to the app
 * through the `assetra://` link. See AuthService.loginWithBrowser.
 */
@Component({
	selector: 'app-desktop-login',
	templateUrl: './desktop-login.component.html',
})
export class DesktopLoginComponent {
	protected readonly auth = inject(AuthService);
	private readonly _router = inject(Router);
	private readonly _challenge = inject(ActivatedRoute).snapshot.queryParamMap.get('challenge') ?? '';

	protected readonly step = signal<Step>('loading');

	constructor() {
		void this._start();
	}

	protected async confirm() {
		this.step.set('sending');

		try {
			const response = await fetch(`${environment.apiUrl}/api/assetra/desktop/code`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${await this.auth.idToken()}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ challenge: this._challenge }),
			});
			const { code } = await response.json();

			if (!response.ok || !code) {
				throw new Error('no code');
			}

			this.step.set('done');
			window.location.href = `assetra://login?code=${encodeURIComponent(code)}`;
		} catch {
			this.step.set('error');
		}
	}

	private async _start() {
		await this.auth.ready;

		if (!/^[A-Za-z0-9_-]{43}$/.test(this._challenge)) {
			this.step.set('error');
			return;
		}

		if (!this.auth.isLoggedIn()) {
			await this._router.navigate(['/account'], {
				queryParams: { next: `/desktop-login?challenge=${this._challenge}` },
				replaceUrl: true,
			});
			return;
		}

		this.step.set('ready');
	}
}
