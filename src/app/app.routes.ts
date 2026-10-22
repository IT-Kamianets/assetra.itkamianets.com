import { Routes } from '@angular/router';
import { buildRouteMeta } from '@wawjs/ngx-default';
import {
	categoryMetaResolver,
	productMetaResolver,
	sellerMetaResolver,
} from './feature/catalog/catalog.resolver';
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
				title: 'Каталог 3D-моделей',
				description:
					'Каталог 3D-моделей для ігор, візуалізації, AR/VR та анімації. Усі моделі у форматі GLB, фільтри за призначенням, полігональністю, ригом та анімацією.',
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
		path: 'cart',
		data: { meta: { title: 'Кошик', robots: 'noindex, follow' } },
		loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent),
	},
	{
		path: 'order',
		data: {
			meta: {
				title: 'Замовлення 3D-моделі',
				description:
					'Оформіть замовлення моделей з кошика або замовте нову 3D-модель за референсами, кресленням чи описом у форматі GLB.',
			},
		},
		loadComponent: () => import('./pages/order/order.component').then((m) => m.OrderComponent),
	},
	{
		path: 'sellers',
		data: {
			meta: {
				title: 'Продавці 3D-моделей',
				description:
					'Студії та 3D-художники, які продають моделі персонажів, транспорту, техніки, ігрових предметів і меблів на Assetra.',
			},
		},
		loadComponent: () =>
			import('./pages/sellers/sellers.component').then((m) => m.SellersComponent),
	},
	{
		path: 'seller/:slug',
		resolve: { meta: sellerMetaResolver },
		loadComponent: () =>
			import('./pages/seller/seller.component').then((m) => m.SellerComponent),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
