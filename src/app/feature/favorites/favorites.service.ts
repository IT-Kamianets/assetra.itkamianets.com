import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { StoreService } from '@wawjs/ngx-core';
import { AuthService } from '../auth/auth.service';
import { getProduct } from '../catalog/catalog.data';
import { Product } from '../catalog/catalog.interface';

const GUEST_KEY = 'favorites';

/**
 * Favorite models in browser storage. Guests have one list; each signed-in account has its own,
 * and whatever a guest saved is moved into the account on sign-in so nothing is lost by registering.
 */
@Service()
export class FavoritesService {
	private readonly _store = inject(StoreService);
	private readonly _auth = inject(AuthService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _slugs = signal<string[]>([]);
	private _key = GUEST_KEY;

	readonly items = computed(() =>
		this._slugs()
			.map((slug) => getProduct(slug))
			.filter((product): product is Product => !!product),
	);
	readonly count = computed(() => this.items().length);

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		effect(() => {
			const uid = this._auth.uid();

			untracked(() => void this._load(uid));
		});
	}

	has(slug: string): boolean {
		return this._slugs().includes(slug);
	}

	toggle(slug: string) {
		this._set(this.has(slug) ? this._slugs().filter((item) => item !== slug) : [slug, ...this._slugs()]);
	}

	remove(slug: string) {
		this._set(this._slugs().filter((item) => item !== slug));
	}

	clear() {
		this._set([]);
	}

	private async _load(uid: string) {
		const key = uid ? `${GUEST_KEY}:${uid}` : GUEST_KEY;

		this._key = key;

		let slugs = _valid(await this._store.getJson<string[]>(key));

		if (uid) {
			const guest = _valid(await this._store.getJson<string[]>(GUEST_KEY));

			if (guest.length) {
				slugs = [...new Set([...slugs, ...guest])];
				void this._store.setJson(key, slugs);
				void this._store.remove(GUEST_KEY);
			}
		}

		// The account may have changed again while storage was being read.
		if (this._key === key) {
			this._slugs.set(slugs);
		}
	}

	private _set(slugs: string[]) {
		this._slugs.set(slugs);

		if (this._isBrowser) {
			void this._store.setJson(this._key, slugs);
		}
	}
}

function _valid(saved: unknown): string[] {
	return Array.isArray(saved) ? saved.filter((slug): slug is string => typeof slug === 'string' && !!getProduct(slug)) : [];
}
