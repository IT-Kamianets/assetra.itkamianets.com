/** What the model is made for: games, visualization, AR/VR or animation. */
export type ProductPurpose = 'games' | 'viz' | 'arvr' | 'animation';

export type PolygonTier = 'low' | 'mid' | 'high';

export type CatalogSort = 'popular' | 'new' | 'price-asc' | 'price-desc';

export interface Category {
	slug: string;
	title: string;
	intro: string;
	seo: string;
	image: string;
}

export interface Seller {
	slug: string;
	name: string;
	city: string;
	since: number;
	/** Avatar background; sellers are shown with initials until they upload a photo. */
	color: string;
	bio: string;
	specialties: string[];
}

export interface Product {
	slug: string;
	title: string;
	category: string;
	seller: string;
	price: number;
	short: string;
	description: string;
	images: string[];
	model?: string;
	purpose: ProductPurpose[];
	polygons: number;
	textures: string;
	rigged: boolean;
	animated: boolean;
	tags: string[];
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
