import { RenderMode, ServerRoute } from '@angular/ssr';
import categories from '../data/category/categories.json';
import products from '../data/product/products.json';

export const serverRoutes: ServerRoute[] = [
	{
		path: 'catalog/:category',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => categories.map(({ slug }) => ({ category: slug })),
	},
	{
		path: 'product/:slug',
		renderMode: RenderMode.Prerender,
		getPrerenderParams: async () => products.map(({ slug }) => ({ slug })),
	},
	{
		path: '**',
		renderMode: RenderMode.Prerender,
	},
];
