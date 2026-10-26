import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import { AdminCollectionsService } from '../../../feature/admin/admin-collections.service';
import { formatModelCount, imageUrl } from '../../../feature/catalog/catalog.data';

/** Catalog collections: themed sets of assets, published as src/data/collection/collections.json. */
@Component({
	imports: [RouterLink],
	templateUrl: './collections.component.html',
})
export class CollectionsComponent {
	protected readonly collections = inject(AdminCollectionsService);
	private readonly _assets = inject(AdminAssetsService);

	protected readonly search = signal('');

	protected readonly rows = computed(() => {
		const search = this.search().trim().toLowerCase();

		return this.collections
			.collections()
			.filter((collection) => !search || `${collection.title} ${collection.slug}`.toLowerCase().includes(search))
			.map((collection) => ({
				collection,
				thumb: collection.image ? imageUrl(collection.image, 120) : '',
				count: this._assets.assets().filter((asset) => asset.collection === collection.slug).length,
			}));
	});
	protected readonly countLabel = computed(() => {
		const count = this.rows().length;

		return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'колекція' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'колекції' : 'колекцій'}`;
	});

	protected modelCount(count: number): string {
		return formatModelCount(count);
	}

	protected remove(slug: string, title: string, count: number) {
		if (!confirm(`Видалити колекцію «${title}»?${count ? ` Ассети (${count}) залишаться, але вже без колекції.` : ''}`)) {
			return;
		}

		for (const asset of this._assets.assets().filter((item) => item.collection === slug)) {
			const { collection: _, ...rest } = asset;

			this._assets.save(rest, asset.slug);
		}

		this.collections.remove(slug);
	}
}
