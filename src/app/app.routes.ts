import { Routes } from '@angular/router';
import { buildRouteMeta } from '@wawjs/ngx-default';
import {
	categoryMetaResolver,
	productMetaResolver,
	sellerMetaResolver,
} from './feature/catalog/catalog.resolver';
import { companyProfile } from './feature/company/company.data';
import { infoMetaResolver } from './pages/info/info.resolver';
import { adminGuard, adminLoginGuard } from './feature/admin/admin.guard';

const ADMIN_ROBOTS = 'noindex, nofollow';

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
	// Old address of a model page, kept so existing links and search results still work.
	{ path: 'product/:slug', redirectTo: 'model/:slug' },
	{
		path: 'model/:slug',
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
		path: 'collections',
		data: {
			meta: {
				title: 'Колекції 3D-моделей',
				description:
					'Тематичні колекції від авторів Assetra: добірки 3D-моделей для окремих ігор, сцен і сетингів у форматі GLB.',
			},
		},
		loadComponent: () => import('./pages/collections/collections.component').then((m) => m.CollectionsComponent),
	},
	{
		path: 'info/:slug',
		resolve: { meta: infoMetaResolver },
		loadComponent: () => import('./pages/info/info.component').then((m) => m.InfoComponent),
	},
	{
		path: 'favorites',
		data: { meta: { title: 'Обране', robots: 'noindex, follow' } },
		loadComponent: () =>
			import('./pages/favorites/favorites.component').then((m) => m.FavoritesComponent),
	},
	{
		path: 'account',
		data: { meta: { title: 'Вхід і реєстрація', robots: 'noindex, follow' } },
		loadComponent: () =>
			import('./pages/account/account.component').then((m) => m.AccountComponent),
	},
	{
		path: 'admin/login',
		canActivate: [adminLoginGuard],
		data: { meta: { title: 'Вхід в адмінку', robots: ADMIN_ROBOTS } },
		loadComponent: () =>
			import('./pages/admin/login/login.component').then((m) => m.LoginComponent),
	},
	{
		path: 'admin',
		canActivate: [adminGuard],
		loadComponent: () =>
			import('./layouts/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
		children: [
			{ path: '', pathMatch: 'full', redirectTo: 'assets' },
			{
				path: 'profile',
				data: { meta: { title: 'Профіль', robots: ADMIN_ROBOTS } },
				loadComponent: () =>
					import('./pages/admin/profile/profile.component').then((m) => m.ProfileComponent),
			},
			{
				path: 'assets',
				data: { meta: { title: 'Ассети', robots: ADMIN_ROBOTS } },
				loadComponent: () =>
					import('./pages/admin/assets/assets.component').then((m) => m.AssetsComponent),
			},
			{
				path: 'assets/:slug',
				data: { meta: { title: 'Ассет', robots: ADMIN_ROBOTS } },
				loadComponent: () =>
					import('./pages/admin/asset/asset.component').then((m) => m.AssetComponent),
			},
			{
				path: 'collections',
				data: { meta: { title: 'Колекції', robots: ADMIN_ROBOTS } },
				loadComponent: () =>
					import('./pages/admin/collections/collections.component').then((m) => m.CollectionsComponent),
			},
			{
				path: 'collections/:slug',
				data: { meta: { title: 'Колекція', robots: ADMIN_ROBOTS } },
				loadComponent: () =>
					import('./pages/admin/collection/collection.component').then((m) => m.CollectionComponent),
			},
			{
				path: 'settings',
				data: { meta: { title: 'Налаштування', robots: ADMIN_ROBOTS } },
				loadComponent: () =>
					import('./pages/admin/settings/settings.component').then((m) => m.SettingsComponent),
			},
		],
	},
	{
		path: '**',
		redirectTo: '',
	},
];
