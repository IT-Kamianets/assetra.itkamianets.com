import { Component, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminProfileService } from '../../../feature/admin/admin-profile.service';
import { slugify } from '../../../feature/admin/slugify';
import { sellers } from '../../../feature/catalog/catalog.data';
import { Seller } from '../../../feature/catalog/catalog.interface';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const THIS_YEAR = new Date().getFullYear();

/** The admin's seller profile: shown on /seller/<slug> and attached to every new asset. */
@Component({
	imports: [ReactiveFormsModule],
	templateUrl: './profile.component.html',
})
export class ProfileComponent {
	private readonly _fb = inject(NonNullableFormBuilder);
	protected readonly profile = inject(AdminProfileService);

	protected readonly sellers = sellers;
	protected readonly thisYear = THIS_YEAR;
	protected readonly form = this._fb.group({
		name: this._fb.control('', [Validators.required, Validators.maxLength(80)]),
		slug: this._fb.control('', [Validators.required, Validators.pattern(SLUG_PATTERN)]),
		city: this._fb.control(''),
		since: this._fb.control(THIS_YEAR, [Validators.required, Validators.min(1990), Validators.max(THIS_YEAR)]),
		color: this._fb.control('#6b7259', Validators.pattern(/^#[0-9a-fA-F]{6}$/)),
		bio: this._fb.control('', Validators.maxLength(600)),
		specialties: this._fb.control(''),
	});
	protected readonly notice = signal<Notice>(null);
	/** Last slug generated from the name; any other value means it was typed by hand. */
	private _autoSlug = '';

	constructor() {
		// The profile is read from storage asynchronously; fill the form once it arrives.
		effect(() => {
			const saved = this.profile.profile();

			untracked(() => {
				if (saved && this.form.pristine) {
					this._fill(saved);
				}
			});
		});

		this.form.controls.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
			const slug = this.form.controls.slug;

			if (slug.value && slug.value !== this._autoSlug) {
				return;
			}

			this._autoSlug = slugify(name);
			slug.setValue(this._autoSlug);
		});
	}

	protected showError(control: AbstractControl): boolean {
		return control.invalid && (control.touched || control.dirty);
	}

	/** Start from a seller already in sellers.json (e.g. to edit your existing studio). */
	protected copyFrom(slug: string) {
		const seller = sellers.find((item) => item.slug === slug);

		if (seller) {
			this._fill(seller);
			this.form.markAsDirty();
			this.notice.set(null);
		}
	}

	protected async save() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const value = this.form.getRawValue();

		await this.profile.save({
			slug: value.slug,
			name: value.name.trim(),
			city: value.city.trim(),
			since: Number(value.since),
			color: value.color,
			bio: value.bio.trim(),
			specialties: value.specialties
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean),
		});
		this.form.markAsPristine();
		this.notice.set({ tone: 'ok', text: 'Профіль збережено в цьому браузері. Нові ассети створюватимуться від цього продавця.' });
	}

	protected export() {
		this.profile.export();
	}

	private _fill(seller: Seller) {
		this._autoSlug = seller.slug;
		this.form.setValue({
			name: seller.name,
			slug: seller.slug,
			city: seller.city,
			since: seller.since,
			color: seller.color,
			bio: seller.bio,
			specialties: seller.specialties.join(', '),
		});
	}
}
