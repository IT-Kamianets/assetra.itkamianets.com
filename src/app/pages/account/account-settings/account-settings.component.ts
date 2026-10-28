import { Component, computed, inject, output, signal } from '@angular/core';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import { AuthResult, AuthService } from '../../../feature/auth/auth.service';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const MIN_PASSWORD = 6;

const ERRORS: Partial<Record<AuthResult, string>> = {
	invalid: 'Невірний поточний пароль.',
	'email-in-use': 'Цей email уже використовується іншим акаунтом.',
	weak: `Новий пароль надто простий: потрібно щонайменше ${MIN_PASSWORD} символів.`,
	'too-many': 'Забагато спроб. Спробуйте трохи пізніше.',
	error: 'Не вдалося виконати дію. Перевірте інтернет і спробуйте ще раз.',
};

/** Private account settings: email, password, language, theme and sign-out. The email is never public. */
@Component({
	selector: 'app-account-settings',
	imports: [ReactiveFormsModule],
	templateUrl: './account-settings.component.html',
})
export class AccountSettingsComponent {
	protected readonly auth = inject(AuthService);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _router = inject(Router);
	private readonly _translate = inject(TranslateService);
	private readonly _languages = inject(LanguageService);
	private readonly _theme = inject(ThemeService);

	readonly loggedOut = output<void>();

	protected readonly minPassword = MIN_PASSWORD;
	protected readonly languages = computed(() => this._languages.languages());
	protected readonly activeLanguage = this._languages.language;
	protected readonly mode = computed(() => this._theme.mode() ?? 'dark');

	protected readonly emailForm = this._fb.group({
		email: this._fb.control('', [Validators.required, Validators.email]),
		password: this._fb.control('', Validators.required),
	});
	protected readonly passwordForm = this._fb.group({
		current: this._fb.control('', Validators.required),
		next: this._fb.control('', [Validators.required, Validators.minLength(MIN_PASSWORD)]),
	});
	protected readonly emailNotice = signal<Notice>(null);
	protected readonly passwordNotice = signal<Notice>(null);
	protected readonly emailSending = signal(false);
	protected readonly passwordSending = signal(false);

	protected invalid(form: FormGroup, control: string): boolean {
		const field = form.get(control);

		return !!field && field.invalid && (field.touched || field.dirty);
	}

	protected async changeEmail() {
		if (this.emailForm.invalid) {
			this.emailForm.markAllAsTouched();
			return;
		}

		const { email, password } = this.emailForm.getRawValue();

		this.emailSending.set(true);
		this.emailNotice.set(null);
		const result = await this.auth.changeEmail(password, email);
		this.emailSending.set(false);

		if (result === 'ok') {
			this.emailForm.reset();
			this.emailNotice.set({
				tone: 'ok',
				text: `Ми надіслали лист із підтвердженням на ${email}. Email зміниться після переходу за посиланням.`,
			});
			return;
		}

		this.emailNotice.set({ tone: 'error', text: ERRORS[result] ?? ERRORS.error! });
	}

	protected async changePassword() {
		if (this.passwordForm.invalid) {
			this.passwordForm.markAllAsTouched();
			return;
		}

		const { current, next } = this.passwordForm.getRawValue();

		this.passwordSending.set(true);
		this.passwordNotice.set(null);
		const result = await this.auth.changePassword(current, next);
		this.passwordSending.set(false);

		if (result === 'ok') {
			this.passwordForm.reset();
			this.passwordNotice.set({ tone: 'ok', text: 'Пароль змінено.' });
			return;
		}

		this.passwordNotice.set({ tone: 'error', text: ERRORS[result] ?? ERRORS.error! });
	}

	protected async setLanguage(code: string) {
		await this._translate.setLanguage(code);
		await this._router.navigateByUrl(this._router.url);
	}

	protected setMode(mode: 'dark' | 'light') {
		this._theme.setMode(mode);
	}

	protected async logout() {
		await this.auth.logout();
		this.loggedOut.emit();
	}
}
