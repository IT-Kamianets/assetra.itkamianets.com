import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import type { Auth, User } from 'firebase/auth';
import { environment } from '../../../environments/environment';

export type AdminAuthResult =
	| 'ok'
	| 'invalid'
	| 'forbidden'
	| 'cancelled'
	| 'popup-blocked'
	| 'unauthorized-domain'
	| 'too-many'
	| 'weak'
	| 'error';

interface AdminUser {
	email: string;
	/** Only email/password accounts can change their password here; Google ones do it at Google. */
	hasPassword: boolean;
}

/**
 * Admin sign-in through Firebase Auth (email/password or Google). Only emails listed in
 * `environment.adminEmails` get in. Firebase is loaded on demand in the browser, so public pages
 * and prerender never pull it in.
 */
@Service()
export class AdminAuthService {
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _user = signal<AdminUser | null>(null);
	private _auth?: Promise<Auth>;

	readonly email = computed(() => this._user()?.email ?? '');
	readonly hasPassword = computed(() => !!this._user()?.hasPassword);
	readonly isLoggedIn = computed(() => !!this._user());
	/** Email of the last account refused because it is not in `environment.adminEmails`. */
	readonly deniedEmail = signal('');
	/** Resolves once Firebase has restored (or not) the previous session. */
	readonly ready: Promise<void> = this._isBrowser ? this._watch() : Promise.resolve();

	async login(email: string, password: string): Promise<AdminAuthResult> {
		const [auth, { signInWithEmailAndPassword }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		return this._signIn(() => signInWithEmailAndPassword(auth, email.trim(), password));
	}

	async loginWithGoogle(): Promise<AdminAuthResult> {
		const [auth, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		return this._signIn(() => signInWithPopup(auth, new GoogleAuthProvider()));
	}

	/** Firebase does not reveal whether the account exists, so a valid email always reports 'ok'. */
	async resetPassword(email: string): Promise<AdminAuthResult> {
		const [auth, { sendPasswordResetEmail }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		try {
			await sendPasswordResetEmail(auth, email.trim());
			return 'ok';
		} catch (error) {
			return _result(error);
		}
	}

	async changePassword(currentPassword: string, newPassword: string): Promise<AdminAuthResult> {
		const [auth, { EmailAuthProvider, reauthenticateWithCredential, updatePassword }] = await Promise.all([
			this._getAuth(),
			import('firebase/auth'),
		]);
		const user = auth.currentUser;

		if (!user?.email) {
			return 'error';
		}

		try {
			await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
			await updatePassword(user, newPassword);
			return 'ok';
		} catch (error) {
			return _result(error);
		}
	}

	async logout() {
		const [auth, { signOut }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		await signOut(auth);
		this._user.set(null);
	}

	private async _signIn(signIn: () => Promise<{ user: User }>): Promise<AdminAuthResult> {
		try {
			const { user } = await signIn();

			if (!_isAdmin(user)) {
				this.deniedEmail.set(user.email ?? '');
				await this.logout();
				return 'forbidden';
			}

			this._user.set(_toAdminUser(user));
			return 'ok';
		} catch (error) {
			return _result(error);
		}
	}

	private async _watch() {
		const [auth, { onAuthStateChanged, signOut }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		await new Promise<void>((resolve) => {
			onAuthStateChanged(auth, (user) => {
				if (user && !_isAdmin(user)) {
					void signOut(auth);
				}

				this._user.set(user && _isAdmin(user) ? _toAdminUser(user) : null);
				resolve();
			});
		});
	}

	private _getAuth(): Promise<Auth> {
		this._auth ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(
			([{ getApps, initializeApp }, { getAuth }]) => {
				const auth = getAuth(getApps()[0] ?? initializeApp(environment.firebase));

				auth.languageCode = 'uk';
				return auth;
			},
		);

		return this._auth;
	}
}

function _isAdmin(user: User): boolean {
	const email = user.email?.toLowerCase();

	return !!email && environment.adminEmails.some((admin) => admin.toLowerCase() === email);
}

function _toAdminUser(user: User): AdminUser {
	return {
		email: user.email ?? '',
		hasPassword: user.providerData.some((provider) => provider.providerId === 'password'),
	};
}

function _result(error: unknown): AdminAuthResult {
	const code = (error as { code?: string })?.code ?? '';

	switch (code) {
		case 'auth/invalid-credential':
		case 'auth/invalid-login-credentials':
		case 'auth/wrong-password':
		case 'auth/user-not-found':
		case 'auth/invalid-email':
		case 'auth/user-disabled':
			return 'invalid';
		case 'auth/popup-closed-by-user':
		case 'auth/cancelled-popup-request':
		case 'auth/user-cancelled':
			return 'cancelled';
		case 'auth/popup-blocked':
			return 'popup-blocked';
		case 'auth/unauthorized-domain':
			return 'unauthorized-domain';
		case 'auth/too-many-requests':
			return 'too-many';
		case 'auth/weak-password':
		case 'auth/password-does-not-meet-requirements':
			return 'weak';
		default:
			console.error(error);
			return 'error';
	}
}
