import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { companyEmailHref, companyProfile } from '../../feature/company/company.data';
import { getInfoPage, infoPages } from './info.data';

@Component({
	imports: [RouterLink, BreadcrumbsComponent],
	templateUrl: './info.component.html',
})
export class InfoComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _slug = toSignal(this._route.paramMap.pipe(map((params) => params.get('slug'))), {
		initialValue: this._route.snapshot.paramMap.get('slug'),
	});

	protected readonly page = computed(() => getInfoPage(this._slug()));
	protected readonly breadcrumbs = computed<Breadcrumb[]>(() => [
		{ label: 'Головна', path: '/' },
		{ label: this.page()?.title ?? '' },
	]);
	/** Other info pages as quick links under the article. */
	protected readonly others = computed(() => infoPages.filter((item) => item.slug !== this._slug()));
	protected readonly email = companyProfile.email;
	protected readonly emailHref = companyEmailHref;
}
