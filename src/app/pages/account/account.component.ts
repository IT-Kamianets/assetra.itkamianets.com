import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthResult, AuthService } from '../../feature/auth/auth.service';
import { MyModelsComponent } from './my-models/my-models.component';

type Mode = 'login' | 'register';
type Notice = { tone: 'ok' | 'error'; text: string } | null;

const MIN_PASSWORD = 6;

const ERRORS: Partial<Record<AuthResult, string>> = {
	invalid: 'Невірний email або пароль.',
	'email-in-use': 'Акаунт з цим email уже існує. Увійдіть або відновіть пароль.',
	weak: `Пароль надто простий: потрібно щонайменше ${MIN_PASSWORD} символів.`,
	'popup-blocked': 'Браузер заблокував вікно входу Google. Дозвольте спливні вікна для цього сайту й спробуйте ще раз.',
	'unauthorized-domain': 'Вхід з цього домену поки не налаштовано. Спробуйте пізніше.',
	'too-many': 'Забагато спроб. Спробуйте трохи пізніше.',
	error: 'Не вдалося увійти. Перевірте інтернет і спробуйте ще раз.',
};

@Component({
	imports: [ReactiveFormsModule, RouterLink, MyModelsComponent],
	host: { ngSkipHydration: 'true' },
	templateUrl: './account.component.html',
})
export class AccountComponent {
	protected readonly auth = inject(AuthService);
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _fb = inject(NonNullableFormBuilder);

	protected readonly minPassword = MIN_PASSWORD;
	protected readonly mode = signal<Mode>(this._route.snapshot.queryParamMap.get('mode') === 'register' ? 'register' : 'login');
	protected readonly form = this._fb.group({
		email: this._fb.control('', [Validators.required, Validators.email]),
		password: this._fb.control('', [Validators.required, Validators.minLength(MIN_PASSWORD)]),
	});
	protected readonly ready = signal(false);
	protected readonly showPassword = signal(false);
	protected readonly sending = signal(false);
	protected readonly notice = signal<Notice>(null);
	/** Page the visitor came from (e.g. a model they wanted to download); set by the `next` query param. */
	protected readonly next = _safeNext(this._route.snapshot.queryParamMap.get('next'));

	constructor() {
		void this.auth.ready.then(() => this.ready.set(true));
	}

	protected setMode(mode: Mode) {
		this.mode.set(mode);
		this.notice.set(null);
	}

	protected showError(control: 'email' | 'password'): boolean {
		const field = this.form.controls[control];

		return field.invalid && (field.touched || field.dirty);
	}

	protected async submit() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const { email, password } = this.form.getRawValue();

		await this._run(() =>
			this.mode() === 'register' ? this.auth.register(email, password) : this.auth.login(email, password),
		);

		if (this.notice()) {
			this.form.controls.password.reset();
		}
	}

	protected async loginWithGoogle() {
		await this._run(() => this.auth.loginWithGoogle());
	}

	protected async resetPassword() {
		const email = this.form.controls.email;

		if (email.invalid) {
			email.markAsTouched();
			this.notice.set({ tone: 'error', text: 'Вкажіть email, на який надіслати лист для зміни пароля.' });
			return;
		}

		this.sending.set(true);
		const result = await this.auth.resetPassword(email.value);
		this.sending.set(false);

		this.notice.set(
			result === 'ok'
				? { tone: 'ok', text: `Якщо акаунт ${email.value} існує, ми надіслали на нього лист для зміни пароля.` }
				: { tone: 'error', text: ERRORS[result] ?? ERRORS.error! },
		);
	}

	protected async logout() {
		await this.auth.logout();
		this.form.reset();
		this.notice.set(null);
	}

	private async _run(signIn: () => Promise<AuthResult>) {
		this.sending.set(true);
		this.notice.set(null);

		const result = await signIn();

		this.sending.set(false);

		if (result === 'cancelled') {
			return;
		}

		if (result !== 'ok') {
			this.notice.set({ tone: 'error', text: ERRORS[result] ?? ERRORS.error! });
			return;
		}

		this.form.reset();

		if (this.next) {
			await this._router.navigateByUrl(this.next);
		}
	}
}

/** Only same-site paths, so a crafted link cannot send the visitor elsewhere after sign-in. */
function _safeNext(next: string | null): string | null {
	return next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/account') ? next : null;
}
