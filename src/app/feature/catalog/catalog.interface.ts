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

/** A themed set of catalog models, managed in the admin («Колекції»). */
export interface CatalogCollection {
	slug: string;
	title: string;
	description: string;
	image: string;
	/** An author's collection that lists every catalog model (not only those with this collection slug). */
	all?: boolean;
	/** Created by a site user in /account, not by the Assetra team. */
	author?: boolean;
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

/** One texture choice of a model: a base-colour image, a plain colour, or both (colour tints the image). */
export interface TextureVariant {
	name: string;
	/** URL of a base-colour texture image. */
	texture?: string;
	/** CSS colour such as #c0392b. */
	color?: string;
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
	/** Lighter GLB for the in-browser 3D preview; `model` stays the full file. */
	modelLow?: string;
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
	/** Uid of the user who uploaded the model from /account; absent for catalog models published by Assetra. */
	uploader?: string;
	/** Optional texture choices shown on the model page; the original textures are always offered too. */
	textureVariants?: TextureVariant[];
	/** Slug of a catalog collection (src/data/collection/collections.json). */
	collection?: string;
	isNew?: boolean;
	isHit?: boolean;
	/** Extra technical info; every field is optional and only filled ones are shown. */
	details?: ProductDetails;
}

/** Technical details buyers expect on 3D marketplaces (CGTrader, TurboSquid, Sketchfab). */
export interface ProductDetails {
	vertices?: number;
	geometry?: 'quads' | 'tris' | 'mixed' | 'ngons';
	/** Separate objects in the scene. */
	meshes?: number;
	lods?: number;
	style?: 'realistic' | 'stylized' | 'low-poly' | 'cartoon';
	dimensions?: { width: number; height: number; depth: number; unit: 'mm' | 'cm' | 'm' | 'in' };
	realWorldScale?: boolean;
	/** Closed, manifold mesh (needed for 3D printing). */
	watertight?: boolean;
	textureResolution?: '512' | '1K' | '2K' | '4K' | '8K';
	pbrWorkflow?: 'metal-rough' | 'spec-gloss' | 'none';
	textureMaps?: string[];
	materials?: number;
	textureCount?: number;
	uv?: 'non-overlapping' | 'overlapping' | 'none';
	udim?: boolean;
	bones?: number;
	/** Animation clips in the file. */
	animations?: number;
	blendShapes?: boolean;
	gameReady?: boolean;
	arReady?: boolean;
	vrReady?: boolean;
	printable?: boolean;
	license?: 'standard' | 'editorial' | 'cc-by' | 'cc0';
	softwareVersion?: string;
	plugins?: string;
	/** ISO date, YYYY-MM-DD. */
	published?: string;
}

export interface Breadcrumb {
	label: string;
	path?: string;
}
