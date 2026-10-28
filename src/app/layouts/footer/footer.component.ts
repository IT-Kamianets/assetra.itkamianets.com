import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getCategory } from '../../feature/catalog/catalog.data';
import { companyEmailHref, companyProfile } from '../../feature/company/company.data';
import { CompanyService } from '../../feature/company/company.service';

interface FooterLink {
	label: string;
	path: string;
	query?: Record<string, string>;
}

/** Catalog column: a few key categories plus the free models filter. */
const CATALOG_CATEGORIES = ['characters', 'vehicles', 'interior', 'architecture'];

@Component({
	selector: 'app-footer',
	imports: [RouterLink, NgTemplateOutlet],
	templateUrl: './footer.component.html',
})
export class FooterComponent {
	private readonly _companyService = inject(CompanyService);

	protected readonly company = this._companyService.company;
	protected readonly currentYear = new Date().getFullYear();

	protected readonly catalogLinks: FooterLink[] = [
		...CATALOG_CATEGORIES.flatMap((slug) => {
			const category = getCategory(slug);

			return category ? [{ label: category.title, path: `/catalog/${slug}` }] : [];
		}),
		{ label: 'Безкоштовні моделі', path: '/catalog', query: { price: 'free' } },
	];
	protected readonly userLinks: FooterLink[] = [
		{ label: 'Про нас', path: '/info/about' },
		{ label: 'Допомога та FAQ', path: '/info/faq' },
		{ label: 'Контакти', path: '/info/contacts' },
		{ label: 'Політика конфіденційності', path: '/info/privacy' },
		{ label: 'Умови використання', path: '/info/terms' },
	];
	protected readonly sellerLinks: FooterLink[] = [
		{ label: 'Стати продавцем', path: '/info/sell' },
		{ label: 'Завантажити модель', path: '/account' },
		{ label: 'Правила публікації', path: '/info/rules' },
		{ label: 'Ліцензії та продажі', path: '/info/licenses' },
	];

	/** Social links come from `structuredData.sameAs` in company.json; the icon is hidden until one is set. */
	protected readonly instagramUrl = _social('instagram.com');
	protected readonly youtubeUrl = _social('youtube.com') || _social('youtu.be');
	protected readonly emailHref = companyEmailHref;
	protected readonly companyImage = computed(() => this.company().image || 'logo.png');
	protected readonly companyImageAlt = computed(() => this.company().name || 'Assetra');
}

function _social(host: string): string {
	return companyProfile.structuredData.sameAs.find((url) => url.includes(host)) ?? '';
}
