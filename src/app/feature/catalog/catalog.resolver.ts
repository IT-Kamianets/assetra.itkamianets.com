import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import type { MetaPage } from '@wawjs/ngx-core';
import { getCategory, getProduct, getSeller, imageUrl, productsBySeller } from './catalog.data';

export const categoryMetaResolver: ResolveFn<MetaPage | RedirectCommand> = (route) => {
	const category = getCategory(route.paramMap.get('category'));

	if (!category) {
		return new RedirectCommand(inject(Router).parseUrl('/catalog'));
	}

	return {
		title: `3D-моделі: ${category.title}`,
		description: category.seo,
		image: imageUrl(category.image, 1200),
	};
};

export const productMetaResolver: ResolveFn<MetaPage | RedirectCommand> = (route) => {
	const product = getProduct(route.paramMap.get('slug'));

	if (!product) {
		return new RedirectCommand(inject(Router).parseUrl('/catalog'));
	}

	return {
		title: `${product.title}: 3D-модель`,
		description: `${product.short} Формат GLB, перегляд у 3D.`,
		image: imageUrl(product.images[0]!, 1200),
	};
};

export const sellerMetaResolver: ResolveFn<MetaPage | RedirectCommand> = (route) => {
	const seller = getSeller(route.paramMap.get('slug'));

	if (!seller) {
		return new RedirectCommand(inject(Router).parseUrl('/sellers'));
	}

	const first = productsBySeller(seller.slug)[0];

	return {
		title: `${seller.name}: 3D-моделі продавця`,
		description: `${seller.bio.split('. ')[0]}. ${seller.city}, на Assetra з ${seller.since} року.`,
		...(first ? { image: imageUrl(first.images[0]!, 1200) } : {}),
	};
};
