import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import type { Auth, User } from 'firebase/auth';
import { environment } from '../../../environments/environment';

export type AuthResult =
	| 'ok'
	| 'invalid'
	| 'email-in-use'
	| 'cancelled'
	| 'popup-blocked'
	| 'unauthorized-domain'
	| 'too-many'
	| 'weak'
	| 'error';

interface AuthUser {
	uid: string;
	email: string;
	/** Only email/password accounts can change their password here; Google ones do it at Google. */
	hasPassword: boolean;
	/** Registration time (ms), from Firebase account metadata. */
	createdAt: number;
}

/**
 * Site accounts through Firebase Auth (email/password or Google). Anyone can register; a signed-in
 * user can download models. Firebase is loaded on demand in the browser, so prerender never pulls it in.
 */
@Service()
export class AuthService {
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _user = signal<AuthUser | null>(null);
	private _auth?: Promise<Auth>;

	readonly uid = computed(() => this._user()?.uid ?? '');
	readonly email = computed(() => this._user()?.email ?? '');
	readonly hasPassword = computed(() => !!this._user()?.hasPassword);
	readonly createdAt = computed(() => this._user()?.createdAt ?? 0);
	readonly isLoggedIn = computed(() => !!this._user());
	/** Resolves once Firebase has restored (or not) the previous session. */
	readonly ready: Promise<void> = this._isBrowser ? this._watch() : Promise.resolve();

	async login(email: string, password: string): Promise<AuthResult> {
		const [auth, { signInWithEmailAndPassword }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		return this._signIn(() => signInWithEmailAndPassword(auth, email.trim(), password));
	}

	async register(email: string, password: string): Promise<AuthResult> {
		const [auth, { createUserWithEmailAndPassword }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		return this._signIn(() => createUserWithEmailAndPassword(auth, email.trim(), password));
	}

	async loginWithGoogle(): Promise<AuthResult> {
		const [auth, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		return this._signIn(() => signInWithPopup(auth, new GoogleAuthProvider()));
	}

	/** Firebase does not reveal whether the account exists, so a valid email always reports 'ok'. */
	async resetPassword(email: string): Promise<AuthResult> {
		const [auth, { sendPasswordResetEmail }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		try {
			await sendPasswordResetEmail(auth, email.trim());
			return 'ok';
		} catch (error) {
			return _result(error);
		}
	}

	async changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
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

	/**
	 * Sends a confirmation link to the new address; the email changes once it is opened.
	 * Only for email/password accounts (the current password is asked again for safety).
	 */
	async changeEmail(currentPassword: string, newEmail: string): Promise<AuthResult> {
		const [auth, { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail }] = await Promise.all([
			this._getAuth(),
			import('firebase/auth'),
		]);
		const user = auth.currentUser;

		if (!user?.email) {
			return 'error';
		}

		try {
			await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
			await verifyBeforeUpdateEmail(user, newEmail.trim());
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

	private async _signIn(signIn: () => Promise<{ user: User }>): Promise<AuthResult> {
		try {
			const { user } = await signIn();

			this._user.set(_toAuthUser(user));
			return 'ok';
		} catch (error) {
			return _result(error);
		}
	}

	private async _watch() {
		const [auth, { onAuthStateChanged }] = await Promise.all([this._getAuth(), import('firebase/auth')]);

		await new Promise<void>((resolve) => {
			onAuthStateChanged(auth, (user) => {
				this._user.set(user ? _toAuthUser(user) : null);
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

function _toAuthUser(user: User): AuthUser {
	return {
		uid: user.uid,
		email: user.email ?? '',
		hasPassword: user.providerData.some((provider) => provider.providerId === 'password'),
		createdAt: Date.parse(user.metadata.creationTime ?? '') || Date.now(),
	};
}

function _result(error: unknown): AuthResult {
	const code = (error as { code?: string })?.code ?? '';

	switch (code) {
		case 'auth/invalid-credential':
		case 'auth/invalid-login-credentials':
		case 'auth/wrong-password':
		case 'auth/user-not-found':
		case 'auth/invalid-email':
		case 'auth/user-disabled':
			return 'invalid';
		case 'auth/email-already-in-use':
			return 'email-in-use';
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
