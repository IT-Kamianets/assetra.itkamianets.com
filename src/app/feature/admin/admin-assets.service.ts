import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { StoreService } from '@wawjs/ngx-core';
import { products } from '../catalog/catalog.data';
import { Product } from '../catalog/catalog.interface';
import { downloadJson } from './admin-download';

/** Snapshot of the data in the build, to tell real edits from an unchanged saved copy. */
const _BUILT = JSON.stringify(products);
const STORE_KEY = 'admin-assets';

/**
 * Editable copy of `src/data/product/products.json`. Edits stay in browser storage until they are
 * exported and committed as the new products.json, so the public catalog changes on the next build.
 */
@Service()
export class AdminAssetsService {
	private readonly _store = inject(StoreService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _assets = signal<Product[]>(structuredClone(products));

	readonly assets = this._assets.asReadonly();
	/** True when the list differs from the products.json the site was built with. */
	/** True when the list differs from the products data the site was built with. */
	readonly hasChanges = computed(() => JSON.stringify(this._assets()) !== _BUILT);
	readonly count = computed(() => this._assets().length);
	readonly ready: Promise<void> = this._isBrowser ? this._restore() : Promise.resolve();

	get(slug: string): Product | undefined {
		return this._assets().find((asset) => asset.slug === slug);
	}

	isSlugTaken(slug: string, exceptSlug?: string): boolean {
		return this._assets().some((asset) => asset.slug === slug && asset.slug !== exceptSlug);
	}

	/** Creates the asset, or replaces the one stored under `originalSlug` (the slug itself may change). */
	save(asset: Product, originalSlug?: string) {
		const assets = this._assets();
		const index = originalSlug ? assets.findIndex((item) => item.slug === originalSlug) : -1;

		this._set(index === -1 ? [asset, ...assets] : assets.map((item, i) => (i === index ? asset : item)));
	}

	remove(slug: string) {
		this._set(this._assets().filter((asset) => asset.slug !== slug));
	}

	/** Drops local edits and returns to the products.json from the build. */
	reset() {
		this._assets.set(structuredClone(products));
		void this._store.remove(STORE_KEY);
	}

	export() {
		downloadJson('products.json', this._assets());
	}

	private async _restore() {
		const saved = await this._store.getJson<Product[]>(STORE_KEY);

		if (Array.isArray(saved)) {
			this._assets.set(saved);
		}
	}

	private _set(assets: Product[]) {
		this._assets.set(assets);

		if (this._isBrowser) {
			void this._store.setJson(STORE_KEY, assets);
		}
	}
}
