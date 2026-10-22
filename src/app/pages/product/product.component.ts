import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	formatDimensions,
	formatPolygons,
	formatPrice,
	getCategory,
	getProduct,
	getRelatedProducts,
	imageUrl,
	orderHref,
	ROOM_LABELS,
	STYLE_LABELS,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { ModelViewerComponent } from '../../feature/catalog/model-viewer/model-viewer.component';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';

type ViewerTab = 'renders' | '3d';

@Component({
	imports: [RouterLink, BreadcrumbsComponent, ModelViewerComponent, ProductCardComponent],
	templateUrl: './product.component.html',
})
export class ProductComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _params = toSignal(this._route.paramMap, {
		initialValue: this._route.snapshot.paramMap,
	});

	// The route resolver redirects unknown slugs, so a product is always present here.
	protected readonly product = computed(() => getProduct(this._params().get('slug'))!);
	protected readonly category = computed(() => getCategory(this.product().category));

	protected readonly tab = linkedSignal<ViewerTab>(() => {
		this.product();
		return 'renders';
	});
	protected readonly activeImage = linkedSignal(() => {
		this.product();
		return 0;
	});
	protected readonly darkStage = signal(false);

	protected readonly images = computed(() =>
		this.product().images.map((image) => ({
			full: imageUrl(image, 1200),
			thumb: imageUrl(image, 160),
		})),
	);
	protected readonly poster = computed(() => this.images()[0]!.full);

	protected readonly price = computed(() => formatPrice(this.product().price));
	protected readonly orderLink = computed(() =>
		orderHref(`Замовлення моделі: ${this.product().title}`),
	);

	protected readonly specs = computed(() => {
		const product = this.product();

		return [
			{ label: 'Габарити (Ш × Г × В)', value: formatDimensions(product) },
			{ label: 'Полігони', value: formatPolygons(product.polygons) },
			{ label: 'Формати', value: product.formats.join(', ') },
			{ label: 'Програми', value: product.software.join(', ') },
			{ label: 'Рушії рендеру', value: product.renderers.join(', ') },
			{ label: 'Текстури', value: product.textures },
			{ label: 'Матеріали', value: product.materials.join(', ') },
			{ label: 'Кольорові варіанти', value: product.colors.join(', ') },
			{ label: 'Стиль', value: STYLE_LABELS[product.style] },
			{ label: 'Приміщення', value: product.rooms.map((room) => ROOM_LABELS[room]).join(', ') },
			{ label: 'Розмір архіву', value: product.archiveSize },
		];
	});

	protected readonly related = computed(() => getRelatedProducts(this.product()));
	protected readonly relatedTitle = computed(() =>
		this.product().collection ? `З колекції ${this.product().collection} та схожі` : 'Схожі моделі',
	);

	protected readonly breadcrumbs = computed<Breadcrumb[]>(() => {
		const category = this.category();

		return [
			{ label: 'Головна', path: '/' },
			{ label: 'Каталог', path: '/catalog' },
			...(category ? [{ label: category.title, path: `/catalog/${category.slug}` }] : []),
			{ label: this.product().title },
		];
	});

	protected show3d() {
		this.tab.set('3d');
	}
}
