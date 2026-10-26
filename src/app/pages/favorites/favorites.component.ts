import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../feature/auth/auth.service';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import { formatModelCount } from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';
import { FavoritesService } from '../../feature/favorites/favorites.service';

@Component({
	imports: [RouterLink, BreadcrumbsComponent, ProductCardComponent],
	templateUrl: './favorites.component.html',
})
export class FavoritesComponent {
	protected readonly favorites = inject(FavoritesService);
	protected readonly auth = inject(AuthService);

	protected readonly breadcrumbs: Breadcrumb[] = [
		{ label: 'Головна', path: '/' },
		{ label: 'Обране' },
	];

	protected readonly countLabel = computed(() => formatModelCount(this.favorites.count()));
}
