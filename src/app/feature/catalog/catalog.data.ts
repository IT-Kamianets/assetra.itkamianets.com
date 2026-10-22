import categoriesData from '../../../data/category/categories.json';
import productsData from '../../../data/product/products.json';
import sellersData from '../../../data/seller/sellers.json';
import { Category, PolygonTier, Product, ProductPurpose, Seller } from './catalog.interface';

export const categories = categoriesData as Category[];
export const products = productsData as Product[];
export const sellers = sellersData as Seller[];

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

/** Formats, most common first, so the filter list reads naturally. */
const FORMAT_ORDER = ['FBX', 'OBJ', 'GLB', 'BLEND', 'MAX', 'USDZ', 'MA', 'SKP'];
export const FORMAT_OPTIONS = [...new Set(products.flatMap((product) => product.formats))].sort(
	(a, b) => (FORMAT_ORDER.indexOf(a) + 1 || 99) - (FORMAT_ORDER.indexOf(b) + 1 || 99),
);

export function polygonTier(polygons: number): PolygonTier {
	return polygons < 10_000 ? 'low' : polygons <= 100_000 ? 'mid' : 'high';
}

export function getCategory(slug: string | null | undefined): Category | undefined {
	return categories.find((category) => category.slug === slug);
}

export function getProduct(slug: string | null | undefined): Product | undefined {
	return products.find((product) => product.slug === slug);
}

export function getSeller(slug: string | null | undefined): Seller | undefined {
	return sellers.find((seller) => seller.slug === slug);
}

export function productsBySeller(slug: string): Product[] {
	return products.filter((product) => product.seller === slug);
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

	return [product.title, product.short, product.collection ?? '', category, seller, ...product.tags, ...product.formats]
		.join(' ')
		.toLowerCase()
		.includes(search);
}

export function countByCategory(slug: string): number {
	return products.filter((product) => product.category === slug).length;
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
	const sameCollection = product.collection
		? products.filter(
				(item) => item.slug !== product.slug && item.collection === product.collection,
			)
		: [];
	const sameCategory = products.filter(
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
	return polygons.toLocaleString('uk-UA');
}

/** Short card line, e.g. "4 600 полігонів · Rigged · Animated". */
export function formatModelSummary(product: Product): string {
	return [
		`${formatPolygons(product.polygons)} полігонів`,
		product.rigged ? 'Rigged' : '',
		product.animated ? 'Animated' : '',
	]
		.filter(Boolean)
		.join(' · ');
}
