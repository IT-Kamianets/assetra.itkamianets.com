import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../feature/cart/cart.service';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	formatModelCount,
	formatPrice,
	getCategory,
	getSeller,
	imageUrl,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';

@Component({
	imports: [RouterLink, BreadcrumbsComponent],
	templateUrl: './cart.component.html',
})
export class CartComponent {
	protected readonly cart = inject(CartService);

	protected readonly breadcrumbs: Breadcrumb[] = [
		{ label: 'Головна', path: '/' },
		{ label: 'Каталог', path: '/catalog' },
		{ label: 'Кошик' },
	];

	protected readonly rows = computed(() =>
		this.cart.items().map((product) => ({
			product,
			thumb: imageUrl(product.images[0]!, 200),
			category: getCategory(product.category)?.title ?? '',
			seller: getSeller(product.seller),
			price: formatPrice(product.price),
		})),
	);
	protected readonly countLabel = computed(() => formatModelCount(this.cart.count()));
	protected readonly freeCount = computed(() => this.cart.items().filter((product) => product.price === 0).length);
	protected readonly total = computed(() => formatPrice(this.cart.total()));
}
