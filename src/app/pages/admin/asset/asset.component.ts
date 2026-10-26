import { Component, computed, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import { AdminCollectionsService } from '../../../feature/admin/admin-collections.service';
import { AdminProfileService } from '../../../feature/admin/admin-profile.service';
import { COVER_SIZE, cropAndUploadCover } from '../../../feature/admin/image-upload';
import { slugify } from '../../../feature/admin/slugify';
import { BreadcrumbsComponent } from '../../../feature/catalog/breadcrumbs/breadcrumbs.component';
import { uploadFile } from '../../../feature/cloud/cloud';
import {
	categories,
	getProduct,
	getSeller,
	imageUrl,
	PURPOSE_LABELS,
} from '../../../feature/catalog/catalog.data';
import { Breadcrumb, Product, ProductDetails, ProductPurpose } from '../../../feature/catalog/catalog.interface';
import {
	DetailFlag,
	FILE_FORMATS,
	FLAG_LABELS,
	GEOMETRY_LABELS,
	LICENSE_LABELS,
	PBR_LABELS,
	STYLE_LABELS,
	TEXTURE_MAPS,
	TEXTURE_RESOLUTIONS,
	UNIT_LABELS,
	UV_LABELS,
} from '../../../feature/catalog/product-details';

const NEW_SLUG = 'new';
const GLB_PATTERN = /^(https?:\/\/\S+|[\w./-]+\.glb)$/;
/** The upload API rejects bodies over ~10 MB, and base64 adds a third. */
const MAX_GLB_MB = 7;

type UploadKind = 'cover' | 'model' | 'modelLow';

/** Label/value pairs for the selects of the details section. */
const _options = <T extends string>(labels: Record<T, string>) =>
	(Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

const DETAIL_OPTIONS = {
	geometry: _options(GEOMETRY_LABELS),
	style: _options(STYLE_LABELS),
	uv: _options(UV_LABELS),
	pbrWorkflow: _options(PBR_LABELS),
	license: _options(LICENSE_LABELS),
	unit: _options(UNIT_LABELS),
};

const DETAIL_COUNTS = [
	{ key: 'vertices', label: 'Вершини' },
	{ key: 'meshes', label: "Об'єкти (меші)" },
	{ key: 'lods', label: 'Рівні LOD' },
	{ key: 'materials', label: 'Матеріали' },
	{ key: 'textureCount', label: 'Файли текстур' },
	{ key: 'bones', label: 'Кістки' },
	{ key: 'animations', label: 'Анімаційні кліпи' },
] as const;

const DETAIL_FLAGS = (Object.keys(FLAG_LABELS) as DetailFlag[]).map((key) => ({ key, label: FLAG_LABELS[key] }));

const GLB_FIELDS = [
	{ kind: 'model', label: 'GLB-модель', hint: 'Повний файл для завантаження покупцем.' },
	{ kind: 'modelLow', label: 'GLB low-poly', hint: 'Легка версія для 3D-перегляду на сторінці моделі.' },
] as const;
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
	imports: [ReactiveFormsModule, RouterLink, BreadcrumbsComponent],
	templateUrl: './asset.component.html',
})
export class AssetComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _assets = inject(AdminAssetsService);
	private readonly _profile = inject(AdminProfileService);
	private readonly _collections = inject(AdminCollectionsService);
	private readonly _injector = inject(Injector);

	protected readonly categories = categories;
	protected readonly purposes = PURPOSES;
	protected readonly flags = FLAGS;

	protected readonly state = signal<PageState>('loading');
	/** Slug the asset is stored under; empty while creating. */
	protected readonly originalSlug = signal('');
	protected readonly saved = signal(false);
	protected readonly preview = signal('');
	/** Which upload is running, and the last upload error per field. */
	protected readonly uploading = signal<UploadKind | ''>('');
	protected readonly uploadError = signal<Partial<Record<UploadKind, string>>>({});
	protected readonly maxGlbMb = MAX_GLB_MB;
	protected readonly coverSize = COVER_SIZE;
	protected readonly glbFields = GLB_FIELDS;
	/** Admin collections, plus the asset's current one if it was removed meanwhile, so the select never loses it. */
	protected readonly collectionOptions = computed(() => {
		const list = this._collections.collections();
		const current = this._currentCollection();

		return current && !list.some((item) => item.slug === current) ? [...list, { slug: current, title: current }] : list;
	});
	private readonly _currentCollection = signal('');
	protected readonly detailOptions = DETAIL_OPTIONS;
	protected readonly detailCounts = DETAIL_COUNTS;
	protected readonly detailFlags = DETAIL_FLAGS;
	protected readonly textureResolutions = TEXTURE_RESOLUTIONS;
	protected readonly textureMaps = TEXTURE_MAPS;
	protected readonly fileFormats = FILE_FORMATS;
	protected readonly isPublished = signal(false);
	/** Mirrors the title field, so the breadcrumbs follow what is typed. */
	private readonly _title = signal('');
	protected readonly breadcrumbs = computed<Breadcrumb[]>(() => [
		{ label: 'Адмінка', path: '/admin' },
		{ label: 'Ассети', path: '/admin/assets' },
		{ label: this.originalSlug() ? this._title() || 'Без назви' : 'Новий ассет' },
	]);
	/** Seller of the asset being edited; new assets get the admin's profile seller. */
	private readonly _sellerSlug = signal('');
	protected readonly needsProfile = computed(() => !this.originalSlug() && !this._profile.hasProfile());
	protected readonly sellerName = computed(() => {
		const slug = this._sellerSlug() || this._profile.profile()?.slug || '';
		const profile = this._profile.profile();

		return profile?.slug === slug ? profile.name : (getSeller(slug)?.name ?? slug);
	});
	/** Last slug generated from the name; any other value means the slug was typed by hand. */
	private _autoSlug = '';

	protected readonly form = this._fb.group({
		title: this._fb.control('', Validators.required),
		slug: this._fb.control('', [Validators.required, Validators.pattern(SLUG_PATTERN), (control) => this._uniqueSlug(control)]),
		category: this._fb.control(categories[0]!.slug, Validators.required),
		price: this._fb.control(0, [Validators.required, Validators.min(0)]),
		short: this._fb.control('', Validators.required),
		description: this._fb.control(''),
		images: this._fb.control(''),
		model: this._fb.control('', Validators.pattern(GLB_PATTERN)),
		modelLow: this._fb.control('', Validators.pattern(GLB_PATTERN)),
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
		formats: this._fb.control<string[]>(['GLB']),
		details: this._fb.group({
			vertices: this._fb.control<number | null>(null, Validators.min(0)),
			meshes: this._fb.control<number | null>(null, Validators.min(0)),
			lods: this._fb.control<number | null>(null, Validators.min(0)),
			materials: this._fb.control<number | null>(null, Validators.min(0)),
			textureCount: this._fb.control<number | null>(null, Validators.min(0)),
			bones: this._fb.control<number | null>(null, Validators.min(0)),
			animations: this._fb.control<number | null>(null, Validators.min(0)),
			geometry: this._fb.control(''),
			style: this._fb.control(''),
			uv: this._fb.control(''),
			pbrWorkflow: this._fb.control(''),
			license: this._fb.control(''),
			textureResolution: this._fb.control(''),
			textureMaps: this._fb.control<string[]>([]),
			width: this._fb.control<number | null>(null, Validators.min(0)),
			height: this._fb.control<number | null>(null, Validators.min(0)),
			depth: this._fb.control<number | null>(null, Validators.min(0)),
			unit: this._fb.control('cm'),
			realWorldScale: this._fb.control(false),
			watertight: this._fb.control(false),
			udim: this._fb.control(false),
			blendShapes: this._fb.control(false),
			gameReady: this._fb.control(false),
			arReady: this._fb.control(false),
			vrReady: this._fb.control(false),
			printable: this._fb.control(false),
			softwareVersion: this._fb.control(''),
			plugins: this._fb.control(''),
			published: this._fb.control(''),
		}),
	});

	constructor() {
		this.form.controls.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => this._title.set(title));

		this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			void this._load(params.get('slug') ?? NEW_SLUG);
		});

		// New assets: the slug follows the name until it is edited by hand. Existing slugs never
		// change on their own, because that would break published product URLs.
		this.form.controls.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => {
			const slug = this.form.controls.slug;

			if (this.originalSlug() || (slug.value && slug.value !== this._autoSlug)) {
				return;
			}

			this._autoSlug = slugify(title);
			slug.setValue(this._autoSlug);
			slug.markAsDirty();
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

	/** Picks a photo, crops it square in the Fabric editor and uploads it as the cover (first image). */
	protected async pickCover(input: HTMLInputElement) {
		const file = input.files?.[0];

		input.value = '';

		if (!file) {
			return;
		}

		if (!file.type.startsWith('image/')) {
			this._setUploadError('cover', 'Оберіть зображення (JPG, PNG або WebP).');
			return;
		}

		this.uploading.set('cover');
		this._setUploadError('cover', '');

		try {
			const url = await cropAndUploadCover(this._injector, file, 'Обкладинка ассета');

			if (url) {
				const rest = _lines(this.form.controls.images.value).slice(1);

				this.form.controls.images.setValue([url, ...rest].join('\n'));
				this.form.controls.images.markAsDirty();
			}
		} catch (error) {
			console.error(error);
			this._setUploadError('cover', 'Не вдалося завантажити обкладинку. Спробуйте ще раз.');
		} finally {
			this.uploading.set('');
		}
	}

	/** Uploads a .glb file and puts its URL into the `model` or `modelLow` field. */
	protected async pickGlb(input: HTMLInputElement, kind: 'model' | 'modelLow') {
		const file = input.files?.[0];

		input.value = '';

		if (!file) {
			return;
		}

		if (!file.name.toLowerCase().endsWith('.glb')) {
			this._setUploadError(kind, 'Потрібен файл у форматі .glb.');
			return;
		}

		if (file.size > MAX_GLB_MB * 1024 * 1024) {
			this._setUploadError(kind, `Файл завеликий: до ${MAX_GLB_MB} МБ.`);
			return;
		}

		await this._upload(kind, file, 'model/gltf-binary', kind === 'model' ? 'model.glb' : 'model-low.glb', (url) => {
			this.form.controls[kind].setValue(url);
			this.form.controls[kind].markAsDirty();
		});
	}

	protected clearModel(kind: 'model' | 'modelLow') {
		this.form.controls[kind].setValue('');
		this.form.controls[kind].markAsDirty();
	}

	protected fileName(url: string): string {
		return url.split('/').slice(-2).join('/');
	}

	/** Checkbox lists stored as string arrays: formats and texture maps. */
	protected hasItem(list: string[], item: string): boolean {
		return list.includes(item);
	}

	protected toggleItem(control: AbstractControl<string[]>, item: string) {
		const list = control.value;

		control.setValue(list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);
		control.markAsDirty();
	}

	protected async save() {
		if (this.needsProfile()) {
			return;
		}

		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const asset = this._toProduct();
		const isRename = asset.slug !== this.originalSlug();

		this._assets.save(asset, this.originalSlug() || undefined);
		this.originalSlug.set(asset.slug);
		this._sellerSlug.set(asset.seller);
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

	private async _upload(kind: UploadKind, file: File, mime: string, name: string, done: (url: string) => void) {
		this.uploading.set(kind);
		this._setUploadError(kind, '');

		try {
			done((await uploadFile(file, mime, name)).publicUrl);
		} catch (error) {
			console.error(error);
			this._setUploadError(kind, 'Не вдалося завантажити файл. Спробуйте ще раз.');
		} finally {
			this.uploading.set('');
		}
	}

	private _setUploadError(kind: UploadKind, message: string) {
		this.uploadError.update((errors) => ({ ...errors, [kind]: message }));
	}

	private async _load(slug: string) {
		await Promise.all([this._assets.ready, this._profile.ready, this._collections.ready]);

		// Arriving here right after a rename: the form already holds the saved asset.
		if (slug === this.originalSlug()) {
			return;
		}

		this.saved.set(false);

		if (slug === NEW_SLUG) {
			this._autoSlug = '';
			this._sellerSlug.set('');
			this._currentCollection.set('');
			this.originalSlug.set('');
			this.isPublished.set(false);
			this.form.reset();

			// «Додати ассет у колекцію» opens /admin/assets/new?collection=<slug>.
			const preset = this._route.snapshot.queryParamMap.get('collection');

			if (preset && this._collections.get(preset)) {
				this.form.controls.collection.setValue(preset);
			}
			this.state.set('ready');
			return;
		}

		const asset = this._assets.get(slug);

		if (!asset) {
			this.state.set('missing');
			return;
		}

		this.originalSlug.set(asset.slug);
		this._sellerSlug.set(asset.seller);
		this._currentCollection.set(asset.collection ?? '');
		this.isPublished.set(!!getProduct(asset.slug));
		this.form.reset({
			...asset,
			images: asset.images.join('\n'),
			model: asset.model ?? '',
			modelLow: asset.modelLow ?? '',
			collection: asset.collection ?? '',
			tags: asset.tags.join(', '),
			software: asset.software.join(', '),
			renderers: asset.renderers.join(', '),
			isNew: !!asset.isNew,
			isHit: !!asset.isHit,
			formats: asset.formats,
			details: _detailsToForm(asset.details ?? {}),
		});
		this.state.set('ready');
	}

	private _toProduct(): Product {
		const value = this.form.getRawValue();
		const existing = this.originalSlug() ? this._assets.get(this.originalSlug()) : undefined;
		const details = _formToDetails(value.details);

		return {
			slug: value.slug,
			title: value.title.trim(),
			category: value.category,
			seller: existing?.seller ?? this._profile.profile()!.slug,
			price: Number(value.price),
			short: value.short.trim(),
			description: value.description.trim(),
			images: _lines(value.images),
			...(value.model.trim() ? { model: value.model.trim() } : {}),
			...(value.modelLow.trim() ? { modelLow: value.modelLow.trim() } : {}),
			purpose: PURPOSES.map(({ value: purpose }) => purpose).filter((purpose) => value.purpose.includes(purpose)),
			polygons: Number(value.polygons),
			textures: value.textures.trim(),
			rigged: value.rigged,
			animated: value.animated,
			software: _list(value.software),
			renderers: _list(value.renderers),
			formats: FILE_FORMATS.filter((format) => value.formats.includes(format)),
			tags: _list(value.tags),
			archiveSize: value.archiveSize.trim(),
			...(value.collection.trim() ? { collection: value.collection.trim() } : {}),
			...(value.isNew ? { isNew: true } : {}),
			...(value.isHit ? { isHit: true } : {}),
			...(Object.keys(details).length ? { details } : {}),
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

type DetailsForm = ReturnType<AssetComponent['form']['getRawValue']>['details'];

function _detailsToForm(details: ProductDetails): Partial<DetailsForm> {
	const { dimensions, ...rest } = details;

	return {
		...rest,
		textureMaps: details.textureMaps ?? [],
		...(dimensions ?? {}),
	};
}

/** Keeps only filled fields, so products.json stays small and the product page shows only real data. */
function _formToDetails(form: DetailsForm): ProductDetails {
	const details: Record<string, unknown> = {};
	const { width, height, depth, unit, textureMaps, ...rest } = form;

	for (const [key, value] of Object.entries(rest)) {
		if (typeof value === 'string' ? value.trim() : typeof value === 'number' ? value >= 0 : value === true) {
			details[key] = typeof value === 'string' ? value.trim() : value;
		}
	}

	if (textureMaps.length) {
		details['textureMaps'] = TEXTURE_MAPS.filter((map) => textureMaps.includes(map));
	}

	if (width != null && height != null && depth != null) {
		details['dimensions'] = { width, height, depth, unit };
	}

	return details as ProductDetails;
}
