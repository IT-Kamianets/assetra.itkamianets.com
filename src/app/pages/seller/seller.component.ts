import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import { getSeller, productsBySeller } from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';
import { SellerAvatarComponent } from '../../feature/catalog/seller-avatar/seller-avatar.component';

@Component({
	imports: [RouterLink, BreadcrumbsComponent, ProductCardComponent, SellerAvatarComponent],
	templateUrl: './seller.component.html',
})
export class SellerComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _params = toSignal(this._route.paramMap, {
		initialValue: this._route.snapshot.paramMap,
	});

	// The route resolver redirects unknown sellers, so one is always present here.
	protected readonly seller = computed(() => getSeller(this._params().get('slug'))!);
	protected readonly products = computed(() => productsBySeller(this.seller().slug));
	protected readonly freeCount = computed(() => this.products().filter((product) => product.price === 0).length);

	protected readonly breadcrumbs = computed<Breadcrumb[]>(() => [
		{ label: 'Головна', path: '/' },
		{ label: 'Продавці', path: '/sellers' },
		{ label: this.seller().name },
	]);
}
