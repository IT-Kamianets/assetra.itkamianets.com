import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAssetsService } from '../../../feature/admin/admin-assets.service';
import { AdminCollectionsService } from '../../../feature/admin/admin-collections.service';
import { JsonSyncCheck, JsonSyncDialogComponent } from '../../../feature/admin/json-sync/json-sync-dialog.component';
import { formatModelCount, imageUrl } from '../../../feature/catalog/catalog.data';
import { describeChanges, parseCollections, toDocument } from './collections-sync';

/** Catalog collections: themed sets of assets, published as src/data/collection/collections.json. */
@Component({
	imports: [RouterLink, JsonSyncDialogComponent],
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

	/** «Синхронізація»: all collections as one JSON document. */
	protected readonly syncSource = () => toDocument(this.collections.collections());
	protected readonly syncValidate = (text: string): JsonSyncCheck => {
		const parsed = parseCollections(text);

		return 'error' in parsed ? { error: parsed.error } : { summary: describeChanges(this.collections.collections(), parsed.collections) };
	};

	protected modelCount(count: number): string {
		return formatModelCount(count);
	}

	protected sync(text: string) {
		const parsed = parseCollections(text);

		if ('error' in parsed) {
			return;
		}

		const kept = new Set(parsed.collections.map((collection) => collection.slug));

		for (const { slug } of this.collections.collections().filter((collection) => !kept.has(collection.slug))) {
			this._detachAssets(slug);
		}

		this.collections.replaceAll(parsed.collections);
	}

	protected remove(slug: string, title: string, count: number) {
		if (!confirm(`Видалити колекцію «${title}»?${count ? ` Ассети (${count}) залишаться, але вже без колекції.` : ''}`)) {
			return;
		}

		this._detachAssets(slug);
		this.collections.remove(slug);
	}

	/** Assets of a deleted collection stay, just without a collection. */
	private _detachAssets(slug: string) {
		for (const asset of this._assets.assets().filter((item) => item.collection === slug)) {
			const { collection: _, ...rest } = asset;

			this._assets.save(rest, asset.slug);
		}
	}
}
