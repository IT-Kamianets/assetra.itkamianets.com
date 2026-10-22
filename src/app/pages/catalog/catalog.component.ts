import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	categories,
	getCategory,
	MATERIAL_OPTIONS,
	matchesSearch,
	products,
	ROOM_LABELS,
	SOFTWARE_OPTIONS,
	STYLE_LABELS,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb, CatalogSort, Product } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';

type MultiFilterKey = 'style' | 'room' | 'soft' | 'material';
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

const FILTER_GROUPS: FilterGroup[] = [
	{
		key: 'style',
		title: 'Стиль',
		options: Object.entries(STYLE_LABELS).map(([value, label]) => ({ value, label })),
	},
	{
		key: 'room',
		title: 'Приміщення',
		options: Object.entries(ROOM_LABELS).map(([value, label]) => ({ value, label })),
	},
	{
		key: 'soft',
		title: 'Програма та рушій',
		options: SOFTWARE_OPTIONS.map((value) => ({ value, label: value })),
	},
	{
		key: 'material',
		title: 'Матеріал',
		options: MATERIAL_OPTIONS.map((value) => ({ value, label: value })),
	},
];

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

	protected readonly category = computed(() => getCategory(this._params().get('category')));

	protected readonly filters = computed(() => {
		const query = this._query();
		const list = (key: string) => query.get(key)?.split(',').filter(Boolean) ?? [];
		const sort = query.get('sort') as CatalogSort | null;
		const price = query.get('price');

		return {
			q: query.get('q') ?? '',
			style: list('style'),
			room: list('room'),
			soft: list('soft'),
			material: list('material'),
			price: (price === 'free' || price === 'paid' ? price : '') as PriceFilter,
			sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort! : 'popular',
		};
	});

	protected readonly activeFilterCount = computed(() => {
		const filters = this.filters();

		return (
			filters.style.length +
			filters.room.length +
			filters.soft.length +
			filters.material.length +
			(filters.price ? 1 : 0) +
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
				(!filters.style.length || filters.style.includes(product.style)) &&
				(!filters.room.length || product.rooms.some((room) => filters.room.includes(room))) &&
				(!filters.soft.length ||
					[...product.software, ...product.renderers].some((soft) => filters.soft.includes(soft))) &&
				(!filters.material.length ||
					product.materials.some((material) => filters.material.includes(material))) &&
				(filters.price !== 'free' || product.price === 0) &&
				(filters.price !== 'paid' || product.price > 0),
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
			"Меблі, світильники та декор для візуалізації інтер'єрів з реальними габаритами й готовими матеріалами.",
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
