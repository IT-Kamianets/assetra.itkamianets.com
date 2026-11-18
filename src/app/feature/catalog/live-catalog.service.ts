import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { getDb } from '../cloud/cloud';
import { categories, setLiveProducts, setUserCatalog } from './catalog.data';
import { CatalogCollection, Product, Seller } from './catalog.interface';

/** Firestore collection with the assets admins publish from /admin (one document per slug). */
export const ASSETS_COLLECTION = 'assets';

/** Owner and timestamps kept next to the product fields in Firestore. */
export interface StoredAsset extends Product {
	uid: string;
	updatedAt: number;
}

interface UserProfileDoc {
	nickname?: string;
	name?: string;
	city?: string;
	bio?: string;
}

interface UserModelDoc {
	uid: string;
	title: string;
	description?: string;
	category: string;
	collectionId?: string;
	modelUrl: string;
	lowModelUrl?: string;
	imageUrl?: string;
	size?: number;
	createdAt: number;
}

interface UserCollectionDoc {
	title: string;
	description?: string;
	imageUrl?: string;
}

const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/** A model a user uploaded in /account, shown in the catalog as a free GLB download. */
function _toProduct(id: string, data: UserModelDoc, seller: string): Product {
	const description = (data.description ?? '').trim();

	return {
		slug: `u-${id}`,
		title: data.title,
		category: categories.some((category) => category.slug === data.category) ? data.category : categories[0]!.slug,
		seller,
		price: 0,
		short: description.length > 140 ? `${description.slice(0, 137)}…` : description || data.title,
		description,
		images: [data.imageUrl || 'logo.png'],
		model: data.modelUrl,
		...(data.lowModelUrl ? { modelLow: data.lowModelUrl } : {}),
		purpose: [],
		polygons: 0,
		textures: '',
		rigged: false,
		animated: false,
		tags: [],
		software: [],
		renderers: [],
		formats: ['GLB'],
		archiveSize: data.size ? `${(data.size / 1024 / 1024).toFixed(1)} МБ` : '',
		...(data.collectionId ? { collection: data.collectionId } : {}),
		...(Date.now() - data.createdAt < NEW_FOR_MS ? { isNew: true } : {}),
		uploader: data.uid,
	};
}

/** Avatar colour taken from the uid, so an author keeps the same one. */
function _color(uid: string): string {
	let hash = 0;

	for (const char of uid) {
		hash = (hash * 31 + char.charCodeAt(0)) % 360;
	}

	return `hsl(${hash} 28% 38%)`;
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

		await this._loadUsers();
	}

	/** Models, authors and collections users created in /account; they appear in the catalog next to Assetra's own. */
	private async _loadUsers() {
		try {
			const [db, { collection, getDocs }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const [models, profiles, groups] = await Promise.all([
				getDocs(collection(db, 'models')),
				getDocs(collection(db, 'profiles')),
				getDocs(collection(db, 'collections')),
			]);
			const profileByUid = new Map(profiles.docs.map((item) => [item.id, item.data() as UserProfileDoc]));
			const sellers = new Map<string, Seller>();
			const sellerOf = (uid: string, since: number): string => {
				const profile = profileByUid.get(uid);
				const slug = profile?.nickname || `u-${uid.slice(0, 8)}`;

				if (!sellers.has(slug)) {
					sellers.set(slug, {
						slug,
						name: profile?.name || (profile?.nickname ? `@${profile.nickname}` : `Автор ${uid.slice(0, 4)}`),
						city: profile?.city ?? '',
						since: new Date(since).getFullYear(),
						color: _color(uid),
						bio: profile?.bio ?? '',
						specialties: [],
					});
				}

				return slug;
			};
			const products = models.docs.map((item) => {
				const data = item.data() as UserModelDoc;

				return _toProduct(item.id, data, sellerOf(data.uid, data.createdAt));
			});

			setUserCatalog({
				products,
				sellers: [...sellers.values()],
				collections: groups.docs.map((item) => {
					const data = item.data() as UserCollectionDoc;

					return { slug: item.id, title: data.title, description: data.description ?? '', image: data.imageUrl ?? '', author: true };
				}),
			});
		} catch (error) {
			console.error(error);
		}
	}
}
