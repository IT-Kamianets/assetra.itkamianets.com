import { RenderMode, ServerRoute } from '@angular/ssr';
import categories from '../data/category/categories.json';
import collections from '../data/collection/collections.json';
import info from '../data/info/pages.json';
import products from '../data/product/products.json';
import sellers from '../data/seller/sellers.json';

export const serverRoutes: ServerRoute[] = [
	{
		path: 'catalog/:category',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => categories.map(({ slug }) => ({ category: slug })),
	},
	{
		path: 'model/:slug',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => products.map(({ slug }) => ({ slug })),
	},
	{
		// Old address of a model page: only redirects to /model/:slug in the browser, nothing to prerender.
		path: 'product/:slug',
		renderMode: RenderMode.Client,
	},
	{
		path: 'info/:slug',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => info.map(({ slug }) => ({ slug })),
	},
	{
		path: 'seller/:slug',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => sellers.map(({ slug }) => ({ slug })),
	},
	{
		// Prerendered shells so a reload works on static hosting; new assets fall back to 404.html.
		path: 'admin/assets/:slug',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => [{ slug: 'new' }, ...products.map(({ slug }) => ({ slug }))],
	},
	{
		path: 'admin/collections/:slug',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => [{ slug: 'new' }, ...collections.map(({ slug }) => ({ slug }))],
	},
	{
		path: '**',
		renderMode: RenderMode.Prerender,
	},
];
