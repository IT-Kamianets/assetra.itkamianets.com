import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { categories } from '../../feature/catalog/catalog.data';
import { CompanyService } from '../../feature/company/company.service';

interface FooterPageLink {
	label: string;
	path: string;
}

@Component({
	selector: 'app-footer',
	imports: [RouterLink, TranslateDirective],
	templateUrl: './footer.component.html',
})
export class FooterComponent {
	private readonly _companyService = inject(CompanyService);

	protected readonly company = this._companyService.company;
	protected readonly currentYear = new Date().getFullYear();
	protected readonly pageLinks: FooterPageLink[] = [
		{ label: 'Головна', path: '/' },
		{ label: 'Каталог', path: '/catalog' },
		{ label: 'Колекції', path: '/collections' },
		{ label: 'Продавці', path: '/sellers' },
		...categories.map((category) => ({
			label: category.title,
			path: `/catalog/${category.slug}`,
		})),
	];
	protected readonly companyImage = computed(() => this.company().image || 'logo.png');
	protected readonly companyImageAlt = computed(() =>
		this.company().name ? this.company().name : 'Company image',
	);
}
