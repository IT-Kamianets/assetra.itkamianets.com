import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import {
	categories,
	getProduct,
	imageUrl,
	PURPOSE_LABELS,
	sellers,
} from '../../../feature/catalog/catalog.data';
import { Product, ProductPurpose } from '../../../feature/catalog/catalog.interface';

const NEW_SLUG = 'new';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PURPOSES = (Object.keys(PURPOSE_LABELS) as ProductPurpose[]).map((value) => ({
	value,
	label: PURPOSE_LABELS[value],
}));

const FLAGS = [
	{ key: 'rigged', label: 'Rigged' },
	{ key: 'animated', label: 'Animated' },
	{ key: 'isNew', label: 'Позначка «Новинка»' },
	{ key: 'isHit', label: 'Позначка «Хіт»' },
] as const;

type PageState = 'loading' | 'ready' | 'missing';

/** Create (`/admin/assets/new`) or edit one asset of the catalog. */
@Component({
	imports: [ReactiveFormsModule, RouterLink],
	templateUrl: './asset.component.html',
})
export class AssetComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _assets = inject(AdminAssetsService);

	protected readonly categories = categories;
	protected readonly sellers = sellers;
	protected readonly purposes = PURPOSES;
	protected readonly flags = FLAGS;

	protected readonly state = signal<PageState>('loading');
	/** Slug the asset is stored under; empty while creating. */
	protected readonly originalSlug = signal('');
	protected readonly saved = signal(false);
	protected readonly preview = signal('');
	protected readonly isPublished = signal(false);

	protected readonly form = this._fb.group({
		title: this._fb.control('', Validators.required),
		slug: this._fb.control('', [Validators.required, Validators.pattern(SLUG_PATTERN), (control) => this._uniqueSlug(control)]),
		category: this._fb.control(categories[0]!.slug, Validators.required),
		seller: this._fb.control(sellers[0]!.slug, Validators.required),
		price: this._fb.control(0, [Validators.required, Validators.min(0)]),
		short: this._fb.control('', Validators.required),
		description: this._fb.control(''),
		images: this._fb.control(''),
		model: this._fb.control('', Validators.pattern(/^(https?:\/\/\S+|[\w./-]+\.glb)$/)),
		purpose: this._fb.control<ProductPurpose[]>([]),
		polygons: this._fb.control(0, [Validators.required, Validators.min(0)]),
		textures: this._fb.control(''),
		archiveSize: this._fb.control(''),
		collection: this._fb.control(''),
		tags: this._fb.control(''),
		software: this._fb.control(''),
		renderers: this._fb.control(''),
		rigged: this._fb.control(false),
		animated: this._fb.control(false),
		isNew: this._fb.control(false),
		isHit: this._fb.control(false),
	});

	constructor() {
		this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			void this._load(params.get('slug') ?? NEW_SLUG);
		});

		this.form.controls.images.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			const first = _lines(value)[0];

			this.preview.set(first ? imageUrl(first, 640) : '');
		});
	}

	protected showError(control: AbstractControl): boolean {
		return control.invalid && (control.touched || control.dirty);
	}

	protected hasPurpose(purpose: ProductPurpose): boolean {
		return this.form.controls.purpose.value.includes(purpose);
	}

	protected togglePurpose(purpose: ProductPurpose) {
		const current = this.form.controls.purpose.value;

		this.form.controls.purpose.setValue(
			current.includes(purpose) ? current.filter((item) => item !== purpose) : [...current, purpose],
		);
		this.form.controls.purpose.markAsDirty();
	}

	protected async save() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const asset = this._toProduct();
		const isRename = asset.slug !== this.originalSlug();

		this._assets.save(asset, this.originalSlug() || undefined);
		this.originalSlug.set(asset.slug);
		this.isPublished.set(!!getProduct(asset.slug));
		this.form.markAsPristine();

		if (isRename) {
			await this._router.navigate(['/admin/assets', asset.slug], { replaceUrl: true });
		}

		this.saved.set(true);
	}

	protected async remove() {
		if (!confirm(`Видалити «${this.form.controls.title.value}»?`)) {
			return;
		}

		this._assets.remove(this.originalSlug());
		await this._router.navigateByUrl('/admin/assets');
	}

	private async _load(slug: string) {
		await this._assets.ready;

		// Arriving here right after a rename: the form already holds the saved asset.
		if (slug === this.originalSlug()) {
			return;
		}

		this.saved.set(false);

		if (slug === NEW_SLUG) {
			this.originalSlug.set('');
			this.isPublished.set(false);
			this.form.reset();
			this.state.set('ready');
			return;
		}

		const asset = this._assets.get(slug);

		if (!asset) {
			this.state.set('missing');
			return;
		}

		this.originalSlug.set(asset.slug);
		this.isPublished.set(!!getProduct(asset.slug));
		this.form.reset({
			...asset,
			images: asset.images.join('\n'),
			model: asset.model ?? '',
			collection: asset.collection ?? '',
			tags: asset.tags.join(', '),
			software: asset.software.join(', '),
			renderers: asset.renderers.join(', '),
			isNew: !!asset.isNew,
			isHit: !!asset.isHit,
		});
		this.state.set('ready');
	}

	private _toProduct(): Product {
		const value = this.form.getRawValue();
		const existing = this.originalSlug() ? this._assets.get(this.originalSlug()) : undefined;

		return {
			slug: value.slug,
			title: value.title.trim(),
			category: value.category,
			seller: value.seller,
			price: Number(value.price),
			short: value.short.trim(),
			description: value.description.trim(),
			images: _lines(value.images),
			...(value.model.trim() ? { model: value.model.trim() } : {}),
			purpose: PURPOSES.map(({ value: purpose }) => purpose).filter((purpose) => value.purpose.includes(purpose)),
			polygons: Number(value.polygons),
			textures: value.textures.trim(),
			rigged: value.rigged,
			animated: value.animated,
			software: _list(value.software),
			renderers: _list(value.renderers),
			formats: existing?.formats ?? ['GLB'],
			tags: _list(value.tags),
			archiveSize: value.archiveSize.trim(),
			...(value.collection.trim() ? { collection: value.collection.trim() } : {}),
			...(value.isNew ? { isNew: true } : {}),
			...(value.isHit ? { isHit: true } : {}),
		};
	}

	private _uniqueSlug(control: AbstractControl): ValidationErrors | null {
		return this._assets.isSlugTaken(control.value, this.originalSlug()) ? { taken: true } : null;
	}
}

function _lines(value: string): string[] {
	return value
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

function _list(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}
