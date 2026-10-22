import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import { formatModelCount, imageUrl, productsBySeller, sellers } from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { SellerAvatarComponent } from '../../feature/catalog/seller-avatar/seller-avatar.component';

@Component({
	imports: [RouterLink, BreadcrumbsComponent, SellerAvatarComponent],
	templateUrl: './sellers.component.html',
})
export class SellersComponent {
	protected readonly breadcrumbs: Breadcrumb[] = [{ label: 'Головна', path: '/' }, { label: 'Продавці' }];

	protected readonly sellers = sellers.map((seller) => {
		const items = productsBySeller(seller.slug);

		return {
			seller,
			count: formatModelCount(items.length),
			previews: items.slice(0, 3).map((product) => imageUrl(product.images[0]!, 300)),
		};
	});
}
