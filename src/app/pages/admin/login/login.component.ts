import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuthResult, AdminAuthService } from '../../../feature/admin/admin-auth.service';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const ERRORS: Partial<Record<AdminAuthResult, string>> = {
	invalid: 'Невірний email або пароль.',
	forbidden: 'Цей обліковий запис не має доступу до адмінки.',
	'popup-blocked': 'Браузер заблокував вікно входу Google. Дозвольте спливні вікна для цього сайту й спробуйте ще раз.',
	'unauthorized-domain': 'Цей домен не дозволений у Firebase: додайте його в Authentication → Settings → Authorized domains.',
	'too-many': 'Забагато спроб. Спробуйте трохи пізніше.',
	error: 'Не вдалося увійти. Перевірте інтернет і спробуйте ще раз.',
};

@Component({
	imports: [ReactiveFormsModule, RouterLink],
	host: { ngSkipHydration: 'true' },
	templateUrl: './login.component.html',
})
export class LoginComponent {
	private readonly _auth = inject(AdminAuthService);
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _fb = inject(NonNullableFormBuilder);

	protected readonly form = this._fb.group({
		email: this._fb.control('', [Validators.required, Validators.email]),
		password: this._fb.control('', Validators.required),
	});
	protected readonly showPassword = signal(false);
	protected readonly sending = signal(false);
	protected readonly notice = signal<Notice>(null);

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

		await this._run(() => this._auth.login(email, password));

		if (this.notice()) {
			this.form.controls.password.reset();
		}
	}

	protected async loginWithGoogle() {
		await this._run(() => this._auth.loginWithGoogle());
	}

	protected async resetPassword() {
		const email = this.form.controls.email;

		if (email.invalid) {
			email.markAsTouched();
			this.notice.set({ tone: 'error', text: 'Вкажіть email, на який надіслати лист для зміни пароля.' });
			return;
		}

		this.sending.set(true);
		const result = await this._auth.resetPassword(email.value);
		this.sending.set(false);

		this.notice.set(
			result === 'ok'
				? { tone: 'ok', text: `Якщо акаунт ${email.value} існує, ми надіслали на нього лист для зміни пароля.` }
				: { tone: 'error', text: ERRORS[result] ?? ERRORS.error! },
		);
	}

	private async _run(signIn: () => Promise<AdminAuthResult>) {
		this.sending.set(true);
		this.notice.set(null);

		const result = await signIn();

		this.sending.set(false);

		if (result === 'cancelled') {
			return;
		}

		if (result === 'forbidden' && this._auth.deniedEmail()) {
			this.notice.set({
				tone: 'error',
				text: `Акаунт ${this._auth.deniedEmail()} не має доступу.`,
			});
			return;
		}

		if (result !== 'ok') {
			this.notice.set({ tone: 'error', text: ERRORS[result] ?? ERRORS.error! });
			return;
		}

		const next = this._route.snapshot.queryParamMap.get('next');

		await this._router.navigateByUrl(next?.startsWith('/admin') ? next : '/admin/assets');
	}
}
