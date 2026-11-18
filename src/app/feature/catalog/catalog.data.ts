import { computed, signal } from '@angular/core';
import categoriesData from '../../../data/category/categories.json';
import collectionsData from '../../../data/collection/collections.json';
import productsData from '../../../data/product/products.json';
import sellersData from '../../../data/seller/sellers.json';
import { CatalogCollection, Category, PolygonTier, Product, ProductPurpose, Seller } from './catalog.interface';

export const categories = categoriesData as Category[];
/** Built-in catalog from products.json; prerendered with the site. */
export const products = productsData as Product[];
export const sellers = sellersData as Seller[];
export const collections = collectionsData as CatalogCollection[];

const _live = signal<Product[]>([]);
/** Models, authors and collections that site users published from /account (loaded in the browser). */
const _userProducts = signal<Product[]>([]);
const _userSellers = signal<Seller[]>([]);
const _userCollections = signal<CatalogCollection[]>([]);

const _staticSlugs = new Set(products.map((product) => product.slug));

/**
 * Every product on the site. Once an admin has added the built-in catalog to the admin page (so some
 * published asset has a products.json slug), the catalog is exactly what is published in Firestore
 * (loaded in the browser by LiveCatalogService). Until then, and in prerendered HTML, products.json is
 * shown together with anything admins published. The helpers below read it, so computed views update
 * when it loads.
 */
const _published = computed(() => {
	const live = _live();

	return live.some((product) => _staticSlugs.has(product.slug))
		? live
		: [...products, ...live.filter((product) => !_staticSlugs.has(product.slug))];
});

/** The catalog: what Assetra published, plus the models users uploaded from their profiles. */
export const allProducts = computed(() => [..._published(), ..._userProducts()]);

export const allSellers = computed(() => [...sellers, ..._userSellers()]);

/** Slugs already published in Firestore. */
export const liveSlugs = computed(() => new Set(_live().map((product) => product.slug)));

export function setLiveProducts(list: Product[]) {
	_live.set(list);
}

export function setUserCatalog(data: { products: Product[]; sellers: Seller[]; collections: CatalogCollection[] }) {
	_userProducts.set(data.products);
	_userSellers.set(data.sellers);
	_userCollections.set(data.collections);
}

export const PURPOSE_LABELS: Record<ProductPurpose, string> = {
	games: 'Ігри',
	viz: 'Візуалізація',
	arvr: 'AR / VR',
	animation: 'Анімація',
};

export const POLYGON_TIER_LABELS: Record<PolygonTier, string> = {
	low: 'Low-poly (до 10 тис.)',
	mid: 'Mid-poly (10–100 тис.)',
	high: 'High-poly (понад 100 тис.)',
};

export function polygonTier(polygons: number): PolygonTier {
	return polygons < 10_000 ? 'low' : polygons <= 100_000 ? 'mid' : 'high';
}

export function getCategory(slug: string | null | undefined): Category | undefined {
	return categories.find((category) => category.slug === slug);
}

export function getCollection(slug: string | null | undefined): CatalogCollection | undefined {
	return collections.find((collection) => collection.slug === slug) ?? _userCollections().find((collection) => collection.slug === slug);
}

export function productsInCollection(slug: string): Product[] {
	// An author's full collection lists everything Assetra published, but not other people's uploads.
	return getCollection(slug)?.all
		? allProducts().filter((product) => !product.uploader)
		: allProducts().filter((product) => product.collection === slug);
}

export function getProduct(slug: string | null | undefined): Product | undefined {
	return allProducts().find((product) => product.slug === slug);
}

export function getSeller(slug: string | null | undefined): Seller | undefined {
	return allSellers().find((seller) => seller.slug === slug);
}

export function productsBySeller(slug: string): Product[] {
	return allProducts().filter((product) => product.seller === slug);
}

export function sellerInitials(seller: Seller): string {
	return seller.name
		.split(/[\s&]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]!.toUpperCase())
		.join('');
}

export function matchesSearch(product: Product, query: string): boolean {
	const search = query.trim().toLowerCase();

	if (!search) {
		return true;
	}

	const category = getCategory(product.category)?.title ?? '';
	const seller = getSeller(product.seller)?.name ?? '';

	return [product.title, product.short, getCollection(product.collection)?.title ?? '', category, seller, ...product.tags, ...product.formats]
		.join(' ')
		.toLowerCase()
		.includes(search);
}

export function countByCategory(slug: string): number {
	return allProducts().filter((product) => product.category === slug).length;
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
	const all = allProducts();
	const sameCollection = product.collection
		? all.filter(
				(item) => item.slug !== product.slug && item.collection === product.collection,
			)
		: [];
	const sameCategory = all.filter(
		(item) =>
			item.slug !== product.slug &&
			item.category === product.category &&
			!sameCollection.includes(item),
	);

	return [...sameCollection, ...sameCategory].slice(0, limit);
}

/** Product renders are local assets; remote Pexels images get a resized variant via query params. */
export function imageUrl(url: string, width: number): string {
	return url.includes('images.pexels.com') ? `${url}?auto=compress&cs=tinysrgb&w=${width}` : url;
}

/** Ukrainian plural: 1 модель, 3 моделі, 5 моделей. */
export function formatModelCount(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	const word =
		mod10 === 1 && mod100 !== 11
			? 'модель'
			: mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
				? 'моделі'
				: 'моделей';

	return `${count} ${word}`;
}

export function formatPrice(price: number): string {
	return price > 0 ? `${price.toLocaleString('uk-UA')} ₴` : 'Безкоштовно';
}

export function formatPolygons(polygons: number): string {
	return polygons > 0 ? polygons.toLocaleString('uk-UA') : '—';
}

/** Short card line, e.g. "4 600 полігонів · Rigged · Animated". */
export function formatModelSummary(product: Product): string {
	return [
		product.polygons > 0 ? `${formatPolygons(product.polygons)} полігонів` : '',
		product.rigged ? 'Rigged' : '',
		product.animated ? 'Animated' : '',
	]
		.filter(Boolean)
		.join(' · ');
}
