import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import type { MetaPage } from '@wawjs/ngx-core';
import { getInfoPage } from './info.data';

export const infoMetaResolver: ResolveFn<MetaPage | RedirectCommand> = (route) => {
	const page = getInfoPage(route.paramMap.get('slug'));

	if (!page) {
		return new RedirectCommand(inject(Router).parseUrl('/'));
	}

	return { title: page.title, description: page.description };
};
