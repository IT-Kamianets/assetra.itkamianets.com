export type ProductStyle = 'modern' | 'scandinavian' | 'loft' | 'minimal' | 'classic' | 'japandi';

export type ProductRoom = 'living' | 'bedroom' | 'kitchen' | 'office' | 'horeca';

export type CatalogSort = 'popular' | 'new' | 'price-asc' | 'price-desc';

export interface Category {
	slug: string;
	title: string;
	intro: string;
	seo: string;
	image: string;
}

export interface ProductDimensions {
	w: number;
	d: number;
	h: number;
}

export interface Product {
	slug: string;
	title: string;
	category: string;
	price: number;
	short: string;
	description: string;
	images: string[];
	model?: string;
	style: ProductStyle;
	rooms: ProductRoom[];
	materials: string[];
	colors: string[];
	dimensions: ProductDimensions;
	polygons: number;
	textures: string;
	software: string[];
	renderers: string[];
	formats: string[];
	archiveSize: string;
	collection?: string;
	isNew?: boolean;
	isHit?: boolean;
}

export interface Breadcrumb {
	label: string;
	path?: string;
}
