import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { getDb } from '../cloud/cloud';
import { setLiveProducts } from './catalog.data';
import { Product } from './catalog.interface';

/** Firestore collection with the assets admins publish from /admin (one document per slug). */
export const ASSETS_COLLECTION = 'assets';

/** Owner and timestamps kept next to the product fields in Firestore. */
export interface StoredAsset extends Product {
	uid: string;
	updatedAt: number;
}

/** Product fields of a stored asset, without the owner bookkeeping. */
export function toProduct(stored: StoredAsset): Product {
	const { uid: _uid, updatedAt: _updatedAt, ...product } = stored;

	return product;
}

/**
 * Loads the assets admins published in Firestore into the catalog (see `allProducts`), so they show
 * on the site without a rebuild. Browser only; prerendered pages contain products.json alone.
 */
@Service()
export class LiveCatalogService {
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private _ready?: Promise<void>;

	/** Resolves once the first load finished (or failed); never rejects. */
	get ready(): Promise<void> {
		this._ready ??= this._isBrowser ? this.refresh() : Promise.resolve();

		return this._ready;
	}

	async refresh() {
		try {
			const [db, { collection, getDocs }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const snapshot = await getDocs(collection(db, ASSETS_COLLECTION));

			setLiveProducts(snapshot.docs.map((item) => toProduct(item.data() as StoredAsset)));
		} catch (error) {
			console.error(error);
		}
	}
}
