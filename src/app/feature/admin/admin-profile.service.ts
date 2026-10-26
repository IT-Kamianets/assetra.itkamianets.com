import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { StoreService } from '@wawjs/ngx-core';
import { sellers } from '../catalog/catalog.data';
import { Seller } from '../catalog/catalog.interface';
import { AdminAuthService } from './admin-auth.service';
import { downloadJson } from './admin-download';

const STORE_KEY = 'admin-profile';

/**
 * The signed-in admin's seller profile: new assets are published under it. Like assets and
 * settings it lives in browser storage (one per admin email) until exported as sellers.json.
 */
@Service()
export class AdminProfileService {
	private readonly _store = inject(StoreService);
	private readonly _auth = inject(AdminAuthService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _profile = signal<Seller | null>(null);
	private _ready?: Promise<void>;

	readonly profile = this._profile.asReadonly();
	readonly hasProfile = computed(() => !!this._profile()?.slug);

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		effect(() => {
			const email = this._auth.email();

			untracked(() => (this._ready = this._restore(email)));
		});
	}

	/** Resolves once the profile of the current admin has been read from storage. */
	get ready(): Promise<void> {
		return this._ready ?? Promise.resolve();
	}

	async save(profile: Seller) {
		this._profile.set(profile);
		await this._store.setJson(this._key(this._auth.email()), profile);
	}

	/** sellers.json with this profile added, or replacing the seller with the same slug. */
	export() {
		const profile = this._profile();

		if (!profile) {
			return;
		}

		const exists = sellers.some((seller) => seller.slug === profile.slug);

		downloadJson(
			'sellers.json',
			exists ? sellers.map((seller) => (seller.slug === profile.slug ? profile : seller)) : [...sellers, profile],
		);
	}

	private async _restore(email: string) {
		this._profile.set(null);

		if (!email) {
			return;
		}

		const saved = await this._store.getJson<Seller>(this._key(email));

		if (this._auth.email() === email) {
			this._profile.set(saved?.slug ? saved : null);
		}
	}

	private _key(email: string): string {
		return `${STORE_KEY}:${email.toLowerCase()}`;
	}
}
