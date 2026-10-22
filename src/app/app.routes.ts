import { Routes } from '@angular/router';
import { buildRouteMeta } from '@wawjs/ngx-default';
import { categoryMetaResolver, productMetaResolver } from './feature/catalog/catalog.resolver';
import { companyProfile } from './feature/company/company.data';

export const routes: Routes = [
	{
		path: '',
		data: {
			meta: {
				...buildRouteMeta(companyProfile, '/'),
				titleSuffix: '',
			},
		},
		loadComponent: () =>
			import('./pages/landing/landing.component').then((m) => m.LandingComponent),
	},
	{
		path: 'catalog',
		data: {
			meta: {
				title: 'Каталог 3D-моделей меблів та декору',
				description:
					"Каталог 3D-моделей меблів, світильників і декору для візуалізації інтер'єрів. Фільтри за стилем, приміщенням, матеріалом і програмою.",
			},
		},
		loadComponent: () =>
			import('./pages/catalog/catalog.component').then((m) => m.CatalogComponent),
	},
	{
		path: 'catalog/:category',
		resolve: { meta: categoryMetaResolver },
		loadComponent: () =>
			import('./pages/catalog/catalog.component').then((m) => m.CatalogComponent),
	},
	{
		path: 'product/:slug',
		resolve: { meta: productMetaResolver },
		loadComponent: () =>
			import('./pages/product/product.component').then((m) => m.ProductComponent),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
