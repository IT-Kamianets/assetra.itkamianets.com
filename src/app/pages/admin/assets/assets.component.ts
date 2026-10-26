import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import { AdminCollectionsService } from '../../../feature/admin/admin-collections.service';
import { AdminProfileService } from '../../../feature/admin/admin-profile.service';
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
	private readonly _profile = inject(AdminProfileService);
	protected readonly categories = categories;

	protected readonly search = signal('');
	protected readonly category = signal('');
	protected readonly adminCollections = inject(AdminCollectionsService);
	private readonly _router = inject(Router);
	/** `?collection=<slug>` (from «Колекції») shows only that collection's assets. */
	protected readonly collection = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('collection') ?? '')), {
		initialValue: '',
	});
	protected readonly collectionTitle = computed(() => this.adminCollections.get(this.collection())?.title ?? this.collection());

	protected readonly rows = computed(() => {
		const search = this.search().trim().toLowerCase();
		const category = this.category();
		const collection = this.collection();
		const profile = this._profile.profile();

		return this.assets
			.assets()
			.filter(
				(asset) =>
					(!category || asset.category === category) &&
					(!collection || asset.collection === collection) &&
					(!search || [asset.title, asset.slug, ...asset.tags].join(' ').toLowerCase().includes(search)),
			)
			.map((asset) => ({
				asset,
				thumb: asset.images[0] ? imageUrl(asset.images[0], 120) : '',
				category: getCategory(asset.category)?.title ?? asset.category,
				seller: (profile?.slug === asset.seller ? profile.name : getSeller(asset.seller)?.name) ?? asset.seller,
				price: formatPrice(asset.price),
				polygons: formatPolygons(asset.polygons),
			}));
	});
	protected readonly countLabel = computed(() => formatModelCount(this.rows().length));

	protected setCollection(collection: string) {
		void this._router.navigate([], { queryParams: { collection: collection || null }, queryParamsHandling: 'merge' });
	}

	protected remove(slug: string, title: string) {
		if (confirm(`Видалити «${title}»?`)) {
			this.assets.remove(slug);
		}
	}
}
