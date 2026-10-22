import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import {
	categories,
	formatModelCount,
	formatPolygons,
	formatPrice,
	getCategory,
	getSeller,
	imageUrl,
} from '../../../feature/catalog/catalog.data';

@Component({
	imports: [RouterLink],
	templateUrl: './assets.component.html',
})
export class AssetsComponent {
	protected readonly assets = inject(AdminAssetsService);
	protected readonly categories = categories;

	protected readonly search = signal('');
	protected readonly category = signal('');

	protected readonly rows = computed(() => {
		const search = this.search().trim().toLowerCase();
		const category = this.category();

		return this.assets
			.assets()
			.filter(
				(asset) =>
					(!category || asset.category === category) &&
					(!search || [asset.title, asset.slug, ...asset.tags].join(' ').toLowerCase().includes(search)),
			)
			.map((asset) => ({
				asset,
				thumb: asset.images[0] ? imageUrl(asset.images[0], 120) : '',
				category: getCategory(asset.category)?.title ?? asset.category,
				seller: getSeller(asset.seller)?.name ?? asset.seller,
				price: formatPrice(asset.price),
				polygons: formatPolygons(asset.polygons),
			}));
	});
	protected readonly countLabel = computed(() => formatModelCount(this.rows().length));

	protected remove(slug: string, title: string) {
		if (confirm(`Видалити «${title}»?`)) {
			this.assets.remove(slug);
		}
	}
}
