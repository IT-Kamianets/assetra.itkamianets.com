import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../feature/auth/auth.service';
import { CartService } from '../../feature/cart/cart.service';
import { FavoritesService } from '../../feature/favorites/favorites.service';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	formatModelCount,
	getCollection,
	formatPolygons,
	formatPrice,
	getCategory,
	getProduct,
	getRelatedProducts,
	getSeller,
	imageUrl,
	productsBySeller,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { detailGroups } from '../../feature/catalog/product-details';
import { ModelViewerComponent } from '../../feature/catalog/model-viewer/model-viewer.component';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';
import { SellerAvatarComponent } from '../../feature/catalog/seller-avatar/seller-avatar.component';

type ViewerTab = 'renders' | '3d';

@Component({
	imports: [RouterLink, BreadcrumbsComponent, ModelViewerComponent, ProductCardComponent, SellerAvatarComponent],
	templateUrl: './product.component.html',
})
export class ProductComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	protected readonly cart = inject(CartService);
	protected readonly auth = inject(AuthService);
	protected readonly favorites = inject(FavoritesService);
	private readonly _params = toSignal(this._route.paramMap, {
		initialValue: this._route.snapshot.paramMap,
	});

	// The route resolver redirects unknown slugs, so a product is always present here.
	protected readonly product = computed(() => getProduct(this._params().get('slug'))!);
	protected readonly category = computed(() => getCategory(this.product().category));
	protected readonly collection = computed(() => getCollection(this.product().collection));
	/** The 3D preview prefers the light low-poly file; downloads always get the full `model`. */
	protected readonly viewerModel = computed(() => this.product().modelLow || this.product().model || '');
	protected readonly seller = computed(() => getSeller(this.product().seller));
	protected readonly inCart = computed(() => this.cart.has(this.product().slug));
	protected readonly isFavorite = computed(() => this.favorites.has(this.product().slug));
	protected readonly sellerProducts = computed(() => productsBySeller(this.product().seller));
	protected readonly sellerCount = computed(() => formatModelCount(this.sellerProducts().length));
	protected readonly moreFromSeller = computed(() =>
		this.sellerProducts()
			.filter((item) => item.slug !== this.product().slug)
			.slice(0, 4),
	);

	protected readonly tab = linkedSignal<ViewerTab>(() => {
		this.product();
		return 'renders';
	});
	protected readonly activeImage = linkedSignal(() => {
		this.product();
		return 0;
	});
	protected readonly darkStage = signal(false);
	protected readonly downloading = signal(false);

	protected readonly images = computed(() =>
		this.product().images.map((image) => ({
			full: imageUrl(image, 1200),
			thumb: imageUrl(image, 160),
		})),
	);
	protected readonly poster = computed(() => this.images()[0]!.full);

	protected readonly price = computed(() => formatPrice(this.product().price));
	protected readonly rigLabel = computed(() => {
		const { rigged, animated } = this.product();

		return rigged && animated ? 'Так / Так' : rigged ? 'Так / Ні' : 'Ні';
	});

	protected readonly polygons = computed(() => formatPolygons(this.product().polygons));
	/** Every filled technical field, grouped like on 3D marketplaces. */
	protected readonly detailGroups = computed(() => detailGroups(this.product()));

	/** Similar models, minus the ones already shown in "more from this seller". */
	protected readonly related = computed(() =>
		getRelatedProducts(this.product(), 8)
			.filter((item) => !this.moreFromSeller().includes(item))
			.slice(0, 4),
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

	/** Buying goes through the cart: add this model and open checkout. */
	protected orderNow() {
		this.cart.add(this.product().slug);
		void this._router.navigate(['/order'], { queryParams: { from: 'cart' } });
	}

	protected show3d() {
		this.tab.set('3d');
	}

	/** Signed-in users get the GLB file; guests are sent to sign in and brought back here afterwards. */
	protected async download() {
		const { model, slug } = this.product();

		if (!model || this.downloading()) {
			return;
		}

		this.downloading.set(true);
		await this.auth.ready;

		if (!this.auth.isLoggedIn()) {
			this.downloading.set(false);
			await this._router.navigate(['/account'], { queryParams: { next: this._router.url } });
			return;
		}

		try {
			// Fetching as a blob keeps the file name; `download` is ignored on cross-origin links.
			const response = await fetch(model);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const url = URL.createObjectURL(await response.blob());
			const link = document.createElement('a');

			link.href = url;
			link.download = `${slug}.glb`;
			link.click();
			URL.revokeObjectURL(url);
		} catch {
			window.open(model, '_blank', 'noopener');
		} finally {
			this.downloading.set(false);
		}
	}
}
