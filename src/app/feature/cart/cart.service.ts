import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { StoreService } from '@wawjs/ngx-core';
import { getProduct } from '../catalog/catalog.data';
import { Product } from '../catalog/catalog.interface';

const STORE_KEY = 'cart';

/**
 * Cart of digital models: each model is added once, so there is no quantity.
 * Persisted in browser storage; empty during prerender and filled after restore.
 */
@Service()
export class CartService {
	private readonly _store = inject(StoreService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _slugs = signal<string[]>([]);

	readonly items = computed(() =>
		this._slugs()
			.map((slug) => getProduct(slug))
			.filter((product): product is Product => !!product),
	);
	readonly count = computed(() => this.items().length);
	readonly total = computed(() => this.items().reduce((sum, product) => sum + product.price, 0));

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		void this._store.getJson<string[]>(STORE_KEY).then((saved) => {
			if (Array.isArray(saved)) {
				// Keep anything added before the restore finished.
				this._slugs.update((current) => [...new Set([...saved, ...current])].filter((slug) => getProduct(slug)));
			}
		});
	}

	has(slug: string): boolean {
		return this._slugs().includes(slug);
	}

	add(slug: string) {
		if (!this.has(slug)) {
			this._set([...this._slugs(), slug]);
		}
	}

	remove(slug: string) {
		this._set(this._slugs().filter((item) => item !== slug));
	}

	toggle(slug: string) {
		if (this.has(slug)) {
			this.remove(slug);
		} else {
			this.add(slug);
		}
	}

	clear() {
		this._set([]);
	}

	private _set(slugs: string[]) {
		this._slugs.set(slugs);

		if (this._isBrowser) {
			void this._store.setJson(STORE_KEY, slugs);
		}
	}
}
