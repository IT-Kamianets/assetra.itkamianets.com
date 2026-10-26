import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import { AdminAuthResult, AdminAuthService } from '../../../feature/admin/admin-auth.service';
import { AdminSettingsService } from '../../../feature/admin/admin-settings.service';
import { formatModelCount } from '../../../feature/catalog/catalog.data';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const PASSWORD_ERRORS: Partial<Record<AdminAuthResult, string>> = {
	invalid: 'Поточний пароль невірний.',
	weak: 'Пароль занадто простий.',
	'too-many': 'Забагато спроб. Спробуйте трохи пізніше.',
	error: 'Не вдалося змінити пароль. Спробуйте ще раз.',
};

const STORE_FIELDS = [
	{ key: 'name', label: 'Назва магазину', type: 'text', wide: false },
	{ key: 'siteUrl', label: 'Адреса сайту', type: 'url', wide: false },
	{ key: 'email', label: 'Email', type: 'email', wide: false },
	{ key: 'phone', label: 'Телефон', type: 'tel', wide: false },
	{ key: 'address', label: 'Адреса', type: 'text', wide: true },
	{ key: 'title', label: 'SEO-заголовок', type: 'text', wide: true },
] as const;

@Component({
	imports: [ReactiveFormsModule],
	templateUrl: './settings.component.html',
})
export class SettingsComponent {
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _settings = inject(AdminSettingsService);
	protected readonly auth = inject(AdminAuthService);
	protected readonly assets = inject(AdminAssetsService);
	protected readonly assetsLabel = computed(() => formatModelCount(this.assets.count()));

	protected readonly storeFields = STORE_FIELDS;

	protected readonly storeForm = this._fb.group({
		name: this._fb.control('', Validators.required),
		title: this._fb.control(''),
		description: this._fb.control(''),
		email: this._fb.control('', Validators.email),
		phone: this._fb.control(''),
		address: this._fb.control(''),
		siteUrl: this._fb.control('', [Validators.required, Validators.pattern(/^https?:\/\/\S+$/)]),
	});
	protected readonly storeNotice = signal<Notice>(null);

	protected readonly accountForm = this._fb.group(
		{
			currentPassword: this._fb.control('', Validators.required),
			newPassword: this._fb.control('', [Validators.required, Validators.minLength(8)]),
			confirmPassword: this._fb.control(''),
		},
		{ validators: _passwordsMatch },
	);
	protected readonly accountNotice = signal<Notice>(null);

	constructor() {
		void this._settings.ready.then(() => this.storeForm.setValue(this._settings.settings()));
	}

	protected showError(control: AbstractControl): boolean {
		return control.invalid && (control.touched || control.dirty);
	}

	protected async saveStore() {
		if (this.storeForm.invalid) {
			this.storeForm.markAllAsTouched();
			return;
		}

		await this._settings.save(this.storeForm.getRawValue());
		this.storeForm.markAsPristine();
		this.storeNotice.set({ tone: 'ok', text: 'Налаштування збережено в цьому браузері.' });
	}

	protected async resetStore() {
		await this._settings.reset();
		this.storeForm.setValue(this._settings.settings());
		this.storeNotice.set({ tone: 'ok', text: 'Повернуто значення з company.json.' });
	}

	protected exportStore() {
		this._settings.export();
	}

	protected async saveAccount() {
		if (this.accountForm.invalid) {
			this.accountForm.markAllAsTouched();
			return;
		}

		const { currentPassword, newPassword } = this.accountForm.getRawValue();
		const result = await this.auth.changePassword(currentPassword, newPassword);

		if (result !== 'ok') {
			this.accountNotice.set({ tone: 'error', text: PASSWORD_ERRORS[result] ?? PASSWORD_ERRORS.error! });
			return;
		}

		this.accountForm.reset();
		this.accountNotice.set({ tone: 'ok', text: 'Пароль змінено.' });
	}

}

function _passwordsMatch(group: AbstractControl): ValidationErrors | null {
	const { newPassword, confirmPassword } = group.value as { newPassword: string; confirmPassword: string };

	return newPassword && newPassword !== confirmPassword ? { mismatch: true } : null;
}
