import { computed, inject, Service, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthResult, AuthService } from '../auth/auth.service';

export type AdminAuthResult = AuthResult | 'forbidden';

/**
 * Admin access on top of the shared site account. Only emails listed in `environment.adminEmails`
 * count as admins; other users stay regular site users and never see /admin.
 */
@Service()
export class AdminAuthService {
	private readonly _auth = inject(AuthService);

	readonly isLoggedIn = computed(() => _isAdmin(this._auth.email()));
	readonly email = computed(() => (this.isLoggedIn() ? this._auth.email() : ''));
	readonly hasPassword = computed(() => this.isLoggedIn() && this._auth.hasPassword());
	/** Email of the last account refused because it is not in `environment.adminEmails`. */
	readonly deniedEmail = signal('');
	/** Resolves once Firebase has restored (or not) the previous session. */
	readonly ready = this._auth.ready;

	async login(email: string, password: string): Promise<AdminAuthResult> {
		return this._checkAdmin(await this._auth.login(email, password));
	}

	async loginWithGoogle(): Promise<AdminAuthResult> {
		return this._checkAdmin(await this._auth.loginWithGoogle());
	}

	resetPassword(email: string): Promise<AdminAuthResult> {
		return this._auth.resetPassword(email);
	}

	changePassword(currentPassword: string, newPassword: string): Promise<AdminAuthResult> {
		return this._auth.changePassword(currentPassword, newPassword);
	}

	logout() {
		return this._auth.logout();
	}

	/** A non-admin who tries the admin login is signed out again, so the attempt leaves no session. */
	private async _checkAdmin(result: AuthResult): Promise<AdminAuthResult> {
		if (result !== 'ok' || this.isLoggedIn()) {
			return result;
		}

		this.deniedEmail.set(this._auth.email());
		await this._auth.logout();
		return 'forbidden';
	}
}

function _isAdmin(email: string): boolean {
	const normalized = email.toLowerCase();

	return !!normalized && environment.adminEmails.some((admin) => admin.toLowerCase() === normalized);
}
