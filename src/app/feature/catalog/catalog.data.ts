import categoriesData from '../../../data/category/categories.json';
import productsData from '../../../data/product/products.json';
import { companyProfile } from '../company/company.data';
import { Category, Product, ProductRoom, ProductStyle } from './catalog.interface';

export const categories = categoriesData as Category[];
export const products = productsData as Product[];

export const STYLE_LABELS: Record<ProductStyle, string> = {
	modern: 'Сучасний',
	scandinavian: 'Скандинавський',
	loft: 'Лофт',
	minimal: 'Мінімалізм',
	classic: 'Класика',
	japandi: 'Japandi',
};

export const ROOM_LABELS: Record<ProductRoom, string> = {
	living: 'Вітальня',
	bedroom: 'Спальня',
	kitchen: 'Кухня та їдальня',
	office: 'Кабінет',
	horeca: 'HoReCa',
};

export const SOFTWARE_OPTIONS = ['3ds Max', 'Corona', 'V-Ray', 'SketchUp', 'Blender'];

export const MATERIAL_OPTIONS = [...new Set(products.flatMap((product) => product.materials))];

export function getCategory(slug: string | null | undefined): Category | undefined {
	return categories.find((category) => category.slug === slug);
}

export function getProduct(slug: string | null | undefined): Product | undefined {
	return products.find((product) => product.slug === slug);
}

export function matchesSearch(product: Product, query: string): boolean {
	const search = query.trim().toLowerCase();

	if (!search) {
		return true;
	}

	const category = getCategory(product.category)?.title ?? '';

	return [product.title, product.short, product.collection ?? '', category, ...product.materials]
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

/** Pexels serves resized variants through query params; keep the source URL clean in JSON. */
export function imageUrl(url: string, width: number): string {
	return url.includes('images.pexels.com')
		? `${url}?auto=compress&cs=tinysrgb&w=${width}`
		: url;
}

/** Orders go by email until a checkout exists; set `email` in company.json to receive them. */
export function orderHref(subject: string): string {
	return `mailto:${companyProfile.email}?subject=${encodeURIComponent(subject)}`;
}

export function formatPrice(price: number): string {
	return price > 0 ? `${price.toLocaleString('uk-UA')} ₴` : 'Безкоштовно';
}

export function formatPolygons(polygons: number): string {
	return polygons.toLocaleString('uk-UA');
}

export function formatDimensions(product: Product): string {
	const { w, d, h } = product.dimensions;

	return `${w} × ${d} × ${h} см`;
}
