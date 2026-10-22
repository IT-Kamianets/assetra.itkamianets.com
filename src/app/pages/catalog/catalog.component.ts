import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	categories,
	getCategory,
	matchesSearch,
	POLYGON_TIER_LABELS,
	polygonTier,
	products,
	PURPOSE_LABELS,
	sellers,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb, CatalogSort, Product } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';

type MultiFilterKey = 'seller' | 'purpose' | 'poly' | 'feature';
type Feature = 'rigged' | 'animated' | 'pbr';
type PriceFilter = '' | 'free' | 'paid';

interface FilterOption {
	value: string;
	label: string;
}

interface FilterGroup {
	key: MultiFilterKey;
	title: string;
	options: FilterOption[];
}

const PAGE_SIZE = 12;

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
	{ value: 'popular', label: 'Спочатку популярні' },
	{ value: 'new', label: 'Спочатку нові' },
	{ value: 'price-asc', label: 'Ціна: від дешевших' },
	{ value: 'price-desc', label: 'Ціна: від дорожчих' },
];

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
	{ value: '', label: 'Усі' },
	{ value: 'free', label: 'Безкоштовні' },
	{ value: 'paid', label: 'Платні' },
];

const PRICE_BOUNDS = {
	min: Math.min(...products.map((product) => product.price)),
	max: Math.max(...products.map((product) => product.price)),
};

const FILTER_GROUPS: FilterGroup[] = [
	{
		key: 'seller',
		title: 'Продавець',
		options: sellers.map(({ slug, name }) => ({ value: slug, label: name })),
	},
	{
		key: 'purpose',
		title: 'Призначення',
		options: Object.entries(PURPOSE_LABELS).map(([value, label]) => ({ value, label })),
	},
	{
		key: 'poly',
		title: 'Полігональність',
		options: Object.entries(POLYGON_TIER_LABELS).map(([value, label]) => ({ value, label })),
	},
	{
		key: 'feature',
		title: 'Особливості',
		options: [
			{ value: 'rigged', label: 'З ригом' },
			{ value: 'animated', label: 'З анімацією' },
			{ value: 'pbr', label: 'PBR-текстури' },
		],
	},
];

const FEATURE_CHECKS: Record<Feature, (product: Product) => boolean> = {
	rigged: (product) => product.rigged,
	animated: (product) => product.animated,
	pbr: (product) => product.textures.startsWith('PBR'),
};

/** Serves both `/catalog` and `/catalog/:category`. Filter state lives in query params. */
@Component({
	imports: [RouterLink, BreadcrumbsComponent, ProductCardComponent],
	templateUrl: './catalog.component.html',
})
export class CatalogComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);

	private readonly _params = toSignal(this._route.paramMap, {
		initialValue: this._route.snapshot.paramMap,
	});
	private readonly _query = toSignal(this._route.queryParamMap, {
		initialValue: this._route.snapshot.queryParamMap,
	});

	protected readonly categories = categories;
	protected readonly filterGroups = FILTER_GROUPS;
	protected readonly sortOptions = SORT_OPTIONS;
	protected readonly priceOptions = PRICE_OPTIONS;
	protected readonly priceBounds = PRICE_BOUNDS;

	protected readonly category = computed(() => getCategory(this._params().get('category')));

	protected readonly filters = computed(() => {
		const query = this._query();
		const list = (key: string) => query.get(key)?.split(',').filter(Boolean) ?? [];
		const sort = query.get('sort') as CatalogSort | null;
		const price = query.get('price');
		const amount = (key: string) => {
			const value = Number(query.get(key) ?? NaN);

			return query.has(key) && Number.isFinite(value) && value >= 0 ? value : null;
		};

		return {
			q: query.get('q') ?? '',
			seller: list('seller'),
			purpose: list('purpose'),
			poly: list('poly'),
			feature: list('feature'),
			min: amount('min'),
			max: amount('max'),
			price: (price === 'free' || price === 'paid' ? price : '') as PriceFilter,
			sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort! : 'popular',
		};
	});

	protected readonly activeFilterCount = computed(() => {
		const filters = this.filters();

		return (
			filters.seller.length +
			filters.purpose.length +
			filters.poly.length +
			filters.feature.length +
			(filters.price ? 1 : 0) +
			(filters.min !== null || filters.max !== null ? 1 : 0) +
			(filters.q ? 1 : 0)
		);
	});

	protected readonly results = computed(() => {
		const category = this.category();
		const filters = this.filters();

		const matches = products.filter(
			(product) =>
				(!category || product.category === category.slug) &&
				matchesSearch(product, filters.q) &&
				(!filters.seller.length || filters.seller.includes(product.seller)) &&
				(!filters.purpose.length || product.purpose.some((purpose) => filters.purpose.includes(purpose))) &&
				(!filters.poly.length || filters.poly.includes(polygonTier(product.polygons))) &&
				filters.feature.every((feature) => FEATURE_CHECKS[feature as Feature]?.(product) ?? true) &&
				(filters.price !== 'free' || product.price === 0) &&
				(filters.price !== 'paid' || product.price > 0) &&
				(filters.min === null || product.price >= filters.min) &&
				(filters.max === null || product.price <= filters.max),
		);

		return _sortProducts(matches, filters.sort);
	});

	protected readonly limit = linkedSignal({
		source: this.results,
		computation: () => PAGE_SIZE,
	});
	protected readonly visible = computed(() => this.results().slice(0, this.limit()));

	protected readonly filtersOpen = signal(false);

	protected readonly title = computed(() => this.category()?.title ?? 'Каталог 3D-моделей');
	protected readonly intro = computed(
		() =>
			this.category()?.intro ??
			'Персонажі, транспорт, техніка, ігрові предмети, меблі та декор від незалежних авторів. Переглядайте кожну модель у 3D просто в браузері.',
	);
	protected readonly breadcrumbs = computed<Breadcrumb[]>(() => {
		const items: Breadcrumb[] = [
			{ label: 'Головна', path: '/' },
			{ label: 'Каталог', path: '/catalog' },
		];
		const category = this.category();

		return category ? [...items, { label: category.title }] : items;
	});

	protected isChecked(key: MultiFilterKey, value: string): boolean {
		return this.filters()[key].includes(value);
	}

	protected toggle(key: MultiFilterKey, value: string) {
		const current = this.filters()[key];
		const next = current.includes(value)
			? current.filter((item) => item !== value)
			: [...current, value];

		this._update({ [key]: next.length ? next.join(',') : null });
	}

	protected setPrice(price: PriceFilter) {
		this._update({ price: price || null });
	}

	protected setPriceRange(key: 'min' | 'max', value: string) {
		const amount = Number(value);

		this._update({ [key]: value.trim() && Number.isFinite(amount) ? String(Math.max(0, Math.round(amount))) : null });
	}

	protected setSort(sort: string) {
		this._update({ sort: sort === 'popular' ? null : sort });
	}

	protected setSearch(q: string) {
		this._update({ q: q.trim() ? q : null });
	}

	protected reset() {
		void this._router.navigate([], { relativeTo: this._route, queryParams: {}, replaceUrl: true });
	}

	protected showMore() {
		this.limit.update((limit) => limit + PAGE_SIZE);
	}

	private _update(params: Params) {
		void this._router.navigate([], {
			relativeTo: this._route,
			queryParams: params,
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}
}

function _sortProducts(list: Product[], sort: CatalogSort): Product[] {
	const score = (product: Product) =>
		sort === 'new' ? Number(!!product.isNew) : Number(!!product.isHit) * 2 + Number(!!product.isNew);

	return [...list].sort((a, b) => {
		switch (sort) {
			case 'price-asc':
				return a.price - b.price;
			case 'price-desc':
				return b.price - a.price;
			case 'popular':
			case 'new':
				return score(b) - score(a);
		}
	});
}
