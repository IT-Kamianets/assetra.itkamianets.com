import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { StoreService } from '@wawjs/ngx-core';
import { collections } from '../catalog/catalog.data';
import { CatalogCollection } from '../catalog/catalog.interface';
import { downloadJson } from './admin-download';

const STORE_KEY = 'admin-collections';

/**
 * Editable copy of `src/data/collection/collections.json`. Like assets, edits stay in browser
 * storage until they are exported and committed, so the public site changes on the next build.
 */
@Service()
export class AdminCollectionsService {
	private readonly _store = inject(StoreService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _collections = signal<CatalogCollection[]>(structuredClone(collections));
	private readonly _changed = signal(false);

	readonly collections = this._collections.asReadonly();
	readonly hasChanges = this._changed.asReadonly();
	readonly count = computed(() => this._collections().length);
	readonly ready: Promise<void> = this._isBrowser ? this._restore() : Promise.resolve();

	get(slug: string): CatalogCollection | undefined {
		return this._collections().find((collection) => collection.slug === slug);
	}

	isSlugTaken(slug: string, exceptSlug?: string): boolean {
		return this._collections().some((collection) => collection.slug === slug && collection.slug !== exceptSlug);
	}

	/** Creates the collection, or replaces the one stored under `originalSlug`. */
	save(collection: CatalogCollection, originalSlug?: string) {
		const list = this._collections();
		const index = originalSlug ? list.findIndex((item) => item.slug === originalSlug) : -1;

		this._set(index === -1 ? [collection, ...list] : list.map((item, i) => (i === index ? collection : item)));
	}

	remove(slug: string) {
		this._set(this._collections().filter((collection) => collection.slug !== slug));
	}

	reset() {
		this._collections.set(structuredClone(collections));
		this._changed.set(false);
		void this._store.remove(STORE_KEY);
	}

	export() {
		downloadJson('collections.json', this._collections());
	}

	private async _restore() {
		const saved = await this._store.getJson<CatalogCollection[]>(STORE_KEY);

		if (Array.isArray(saved)) {
			this._collections.set(saved);
			this._changed.set(true);
		}
	}

	private _set(list: CatalogCollection[]) {
		this._collections.set(list);
		this._changed.set(true);

		if (this._isBrowser) {
			void this._store.setJson(STORE_KEY, list);
		}
	}
}
