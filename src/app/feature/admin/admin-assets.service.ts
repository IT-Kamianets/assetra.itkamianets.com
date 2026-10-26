import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { products } from '../catalog/catalog.data';
import { Product } from '../catalog/catalog.interface';
import { ASSETS_COLLECTION, LiveCatalogService, StoredAsset, toProduct } from '../catalog/live-catalog.service';
import { getDb } from '../cloud/cloud';

export type AssetSaveResult = 'ok' | 'taken' | 'error';

const STATIC_SLUGS = new Set(products.map((product) => product.slug));

/**
 * The signed-in admin's own assets, stored in Firestore `assets/{slug}` with their `uid`. Each admin
 * sees and edits only what they uploaded; saved assets appear on the site right away.
 */
@Service()
export class AdminAssetsService {
	private readonly _auth = inject(AuthService);
	private readonly _live = inject(LiveCatalogService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _assets = signal<Product[]>([]);
	private _ready: Promise<void> = Promise.resolve();

	readonly assets = this._assets.asReadonly();
	readonly count = computed(() => this._assets().length);
	readonly loading = signal(false);
	readonly loadFailed = signal(false);

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		effect(() => {
			const uid = this._auth.uid();

			untracked(() => (this._ready = this._load(uid)));
		});
	}

	/** Resolves once the current admin's assets have been read. */
	get ready(): Promise<void> {
		return this._ready;
	}

	get(slug: string): Product | undefined {
		return this._assets().find((asset) => asset.slug === slug);
	}

	/** Slugs of products.json and of this admin's assets; other admins' slugs are rejected on save. */
	isSlugTaken(slug: string, exceptSlug?: string): boolean {
		return slug !== exceptSlug && (STATIC_SLUGS.has(slug) || this._assets().some((asset) => asset.slug === slug));
	}

	/** Creates the asset, or replaces the one stored under `originalSlug` (the slug itself may change). */
	async save(asset: Product, originalSlug?: string): Promise<AssetSaveResult> {
		const uid = this._auth.uid();

		if (!uid) {
			return 'error';
		}

		try {
			const [db, { deleteDoc, doc, setDoc }] = await Promise.all([getDb(), import('firebase/firestore')]);

			await setDoc(doc(db, ASSETS_COLLECTION, asset.slug), { ...asset, uid, updatedAt: Date.now() } satisfies StoredAsset);

			if (originalSlug && originalSlug !== asset.slug) {
				await deleteDoc(doc(db, ASSETS_COLLECTION, originalSlug));
			}
		} catch (error) {
			console.error(error);
			// Writing over a slug another admin owns is refused by the Firestore rules.
			return (error as { code?: string })?.code === 'permission-denied' ? 'taken' : 'error';
		}

		const list = this._assets().filter((item) => item.slug !== asset.slug && item.slug !== originalSlug);

		this._assets.set([asset, ...list]);
		void this._live.refresh();
		return 'ok';
	}

	async remove(slug: string): Promise<boolean> {
		try {
			const [db, { deleteDoc, doc }] = await Promise.all([getDb(), import('firebase/firestore')]);

			await deleteDoc(doc(db, ASSETS_COLLECTION, slug));
		} catch (error) {
			console.error(error);
			return false;
		}

		this._assets.update((list) => list.filter((asset) => asset.slug !== slug));
		void this._live.refresh();
		return true;
	}

	/** JSON sync: writes `list` and deletes this admin's assets missing from it, in one batch. */
	async replaceAll(list: Product[]): Promise<AssetSaveResult> {
		const uid = this._auth.uid();

		if (!uid) {
			return 'error';
		}

		const keep = new Set(list.map((asset) => asset.slug));

		try {
			const [db, { doc, writeBatch }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const batch = writeBatch(db);
			const now = Date.now();

			for (const asset of list) {
				batch.set(doc(db, ASSETS_COLLECTION, asset.slug), { ...asset, uid, updatedAt: now } satisfies StoredAsset);
			}

			for (const asset of this._assets().filter((item) => !keep.has(item.slug))) {
				batch.delete(doc(db, ASSETS_COLLECTION, asset.slug));
			}

			await batch.commit();
		} catch (error) {
			console.error(error);
			return (error as { code?: string })?.code === 'permission-denied' ? 'taken' : 'error';
		}

		this._assets.set(list);
		void this._live.refresh();
		return 'ok';
	}

	private async _load(uid: string) {
		this._assets.set([]);
		this.loadFailed.set(false);

		if (!uid) {
			return;
		}

		this.loading.set(true);

		try {
			const [db, { collection, getDocs, query, where }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const snapshot = await getDocs(query(collection(db, ASSETS_COLLECTION), where('uid', '==', uid)));

			if (this._auth.uid() === uid) {
				this._assets.set(
					snapshot.docs
						.map((item) => item.data() as StoredAsset)
						.sort((a, b) => b.updatedAt - a.updatedAt)
						.map((stored) => toProduct(stored)),
				);
			}
		} catch (error) {
			console.error(error);
			this.loadFailed.set(true);
		} finally {
			this.loading.set(false);
		}
	}
}
