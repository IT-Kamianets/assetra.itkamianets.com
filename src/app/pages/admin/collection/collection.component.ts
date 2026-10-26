import { Component, computed, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import { AdminCollectionsService } from '../../../feature/admin/admin-collections.service';
import { COVER_SIZE, cropAndUploadCover } from '../../../feature/admin/image-upload';
import { slugify } from '../../../feature/admin/slugify';
import { BreadcrumbsComponent } from '../../../feature/catalog/breadcrumbs/breadcrumbs.component';
import { Breadcrumb } from '../../../feature/catalog/catalog.interface';
import { formatModelCount, getCollection, imageUrl } from '../../../feature/catalog/catalog.data';

const NEW_SLUG = 'new';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type PageState = 'loading' | 'ready' | 'missing';

/** Create (`/admin/collections/new`) or edit one catalog collection, like the asset page. */
@Component({
	imports: [ReactiveFormsModule, RouterLink, BreadcrumbsComponent],
	templateUrl: './collection.component.html',
})
export class CollectionComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _injector = inject(Injector);
	private readonly _collections = inject(AdminCollectionsService);
	private readonly _assets = inject(AdminAssetsService);

	protected readonly coverSize = COVER_SIZE;
	protected readonly state = signal<PageState>('loading');
	/** Slug the collection is stored under; empty while creating. */
	protected readonly originalSlug = signal('');
	protected readonly saved = signal(false);
	protected readonly isPublished = signal(false);
	/** Mirrors the title field, so the breadcrumbs follow what is typed. */
	private readonly _title = signal('');
	protected readonly breadcrumbs = computed<Breadcrumb[]>(() => [
		{ label: 'Адмінка', path: '/admin' },
		{ label: 'Колекції', path: '/admin/collections' },
		{ label: this.originalSlug() ? this._title() || 'Без назви' : 'Нова колекція' },
	]);
	protected readonly uploading = signal(false);
	protected readonly uploadError = signal('');

	protected readonly form = this._fb.group({
		title: this._fb.control('', [Validators.required, Validators.maxLength(80)]),
		slug: this._fb.control('', [Validators.required, Validators.pattern(SLUG_PATTERN), (control) => this._uniqueSlug(control)]),
		description: this._fb.control('', Validators.maxLength(600)),
		image: this._fb.control(''),
	});
	private readonly _image = signal('');
	protected readonly preview = computed(() => (this._image() ? imageUrl(this._image(), 640) : ''));
	/** Assets in this collection, linked from the sidebar. */
	protected readonly members = computed(() => {
		const slug = this.originalSlug();

		return slug ? this._assets.assets().filter((asset) => asset.collection === slug) : [];
	});
	protected readonly membersLabel = computed(() => formatModelCount(this.members().length));
	/** Last slug generated from the title; any other value means it was typed by hand. */
	private _autoSlug = '';

	constructor() {
		this.form.controls.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => this._title.set(title));

		this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			void this._load(params.get('slug') ?? NEW_SLUG);
		});

		// New collections: the slug follows the title until it is edited by hand.
		this.form.controls.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => {
			const slug = this.form.controls.slug;

			if (this.originalSlug() || (slug.value && slug.value !== this._autoSlug)) {
				return;
			}

			this._autoSlug = slugify(title);
			slug.setValue(this._autoSlug);
			slug.markAsDirty();
		});

		this.form.controls.image.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this._image.set(value));
	}

	protected showError(control: AbstractControl): boolean {
		return control.invalid && (control.touched || control.dirty);
	}

	protected async pickCover(input: HTMLInputElement) {
		const file = input.files?.[0];

		input.value = '';

		if (!file) {
			return;
		}

		if (!file.type.startsWith('image/')) {
			this.uploadError.set('Оберіть зображення (JPG, PNG або WebP).');
			return;
		}

		this.uploading.set(true);
		this.uploadError.set('');

		try {
			const url = await cropAndUploadCover(this._injector, file, 'Обкладинка колекції');

			if (url) {
				this.form.controls.image.setValue(url);
				this.form.controls.image.markAsDirty();
			}
		} catch (error) {
			console.error(error);
			this.uploadError.set('Не вдалося завантажити обкладинку. Спробуйте ще раз.');
		} finally {
			this.uploading.set(false);
		}
	}

	protected async save() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const value = this.form.getRawValue();
		const originalSlug = this.originalSlug();
		const isRename = value.slug !== originalSlug;

		this._collections.save(
			{ slug: value.slug, title: value.title.trim(), description: value.description.trim(), image: value.image },
			originalSlug || undefined,
		);

		// A renamed slug must follow into the assets that belong to the collection.
		if (originalSlug && isRename) {
			await this._moveAssets(originalSlug, value.slug);
		}

		this.originalSlug.set(value.slug);
		this.isPublished.set(!!getCollection(value.slug));
		this.form.markAsPristine();

		if (isRename) {
			await this._router.navigate(['/admin/collections', value.slug], { replaceUrl: true });
		}

		this.saved.set(true);
	}

	protected async remove() {
		const used = this.members().length;

		if (!confirm(`Видалити колекцію «${this.form.controls.title.value}»?${used ? ` Ассети (${used}) залишаться, але вже без колекції.` : ''}`)) {
			return;
		}

		await this._moveAssets(this.originalSlug(), '');
		this._collections.remove(this.originalSlug());
		await this._router.navigateByUrl('/admin/collections');
	}

	private async _load(slug: string) {
		await Promise.all([this._collections.ready, this._assets.ready]);

		// Arriving here right after a rename: the form already holds the saved collection.
		if (slug === this.originalSlug()) {
			return;
		}

		this.saved.set(false);
		this.uploadError.set('');

		if (slug === NEW_SLUG) {
			this._autoSlug = '';
			this.originalSlug.set('');
			this.isPublished.set(false);
			this.form.reset();
			this.state.set('ready');
			return;
		}

		const collection = this._collections.get(slug);

		if (!collection) {
			this.state.set('missing');
			return;
		}

		this.originalSlug.set(collection.slug);
		this.isPublished.set(!!getCollection(collection.slug));
		this.form.reset(collection);
		this.state.set('ready');
	}

	private _moveAssets(from: string, to: string) {
		return Promise.all(
			this._assets.assets().filter((item) => item.collection === from).map((asset) => {
				const { collection: _, ...rest } = asset;

				return this._assets.save(to ? { ...rest, collection: to } : rest, asset.slug);
			}),
		);
	}

	private _uniqueSlug(control: AbstractControl<string>): ValidationErrors | null {
		return this._collections.isSlugTaken(control.value, this.originalSlug() || undefined) ? { taken: true } : null;
	}
}
