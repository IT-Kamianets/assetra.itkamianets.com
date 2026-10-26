import { NgOptimizedImage } from '@angular/common';
import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import type { Language } from '@wawjs/ngx-translate';
import type { AppLanguage } from '../../../environments/environment.prod';
import { AuthService } from '../../feature/auth/auth.service';
import { CartService } from '../../feature/cart/cart.service';
import { FavoritesService } from '../../feature/favorites/favorites.service';
import { CompanyService } from '../../feature/company/company.service';
import { ScrollService } from '../../services/scroll.service';
import { TopbarSearchComponent } from './search/topbar-search.component';

@Component({
	selector: 'app-topbar',
	imports: [NgOptimizedImage, RouterLink, RouterLinkActive, TranslateDirective, TopbarSearchComponent],
	templateUrl: './topbar.component.html',
	styleUrl: './topbar.component.scss',
	host: {
		'[class.is-hidden]': 'hidden()',
		'[class.is-glass]': 'overHero()',
		'(document:click)': 'onDocumentClick($event)',
		'(keydown.escape)': 'languageMenuOpen.set(false)',
	},
})
export class TopbarComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _themeService = inject(ThemeService);
	private readonly _languageService = inject(LanguageService);
	private readonly _companyService = inject(CompanyService);
	private readonly _router = inject(Router);
	private readonly _scrollService = inject(ScrollService);
	protected readonly cart = inject(CartService);
	protected readonly auth = inject(AuthService);
	protected readonly favorites = inject(FavoritesService);
	private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

	protected readonly navLinks = [
		{ label: 'Каталог', path: '/catalog', query: null, secondary: false },
		{ label: 'Колекції', path: '/collections', query: null, secondary: true },
		{ label: 'Продавці', path: '/sellers', query: null, secondary: true },
	];
	protected readonly mode = computed(() => this._themeService.mode() ?? 'light');
	protected readonly languageMenuOpen = signal(false);
	private readonly _isHome = toSignal(
		this._router.events.pipe(
			filter((event): event is NavigationEnd => event instanceof NavigationEnd),
			map((event) => _isHomeUrl(event.urlAfterRedirects)),
		),
		{ initialValue: _isHomeUrl(this._router.url) },
	);
	/** Frosted glass only while the topbar floats over the home hero photo; olive pill elsewhere. */
	protected readonly overHero = computed(() => {
		const viewport = this._scrollService.viewportHeight();

		return this._isHome() && (viewport === 0 || this._scrollService.y() < viewport - 80);
	});
	/** Hide while scrolling down past the hero, reveal on any scroll up. */
	protected readonly hidden = computed(
		() =>
			this._scrollService.direction() === 'down' &&
			this._scrollService.y() > 120 &&
			!this.languageMenuOpen(),
	);
	protected readonly languages = computed(() =>
		this._languageService.languages().map((language) => _toAppLanguage(language)),
	);
	protected readonly company = this._companyService.company;
	protected readonly activeLanguage = this._languageService.language;
	protected readonly currentLanguage = computed(() =>
		_toAppLanguage(this._languageService.getLanguage(this.activeLanguage())),
	);
	protected readonly toggleIcon = computed(() =>
		this.mode() === 'dark' ? 'light_mode' : 'dark_mode',
	);
	protected readonly toggleLabel = computed(() => {
		this.activeLanguage();
		return this.mode() === 'dark'
			? this._translateService.translate('Switch to light mode')()
			: this._translateService.translate('Switch to dark mode')();
	});
	protected readonly languageMenuLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Open language menu')();
	});

	constructor() {
		this._themeService.init();
	}

	protected toggleMode() {
		const nextMode = this.mode() === 'dark' ? 'light' : 'dark';
		this._themeService.setMode(nextMode);
	}

	protected onDocumentClick(event: MouseEvent) {
		if (this.languageMenuOpen() && !this._host.nativeElement.contains(event.target as Node)) {
			this.languageMenuOpen.set(false);
		}
	}

	protected toggleLanguageMenu() {
		this.languageMenuOpen.update((open) => !open);
	}

	protected async setLanguage(language: AppLanguage) {
		await this._translateService.setLanguage(language.code);
		await this._router.navigateByUrl(this._router.url);
		this.languageMenuOpen.set(false);
	}

}

function _isHomeUrl(url: string): boolean {
	return url.split(/[?#]/)[0] === '/';
}

function _toAppLanguage(language: Language | undefined): AppLanguage {
	const fallback: AppLanguage = {
		code: 'en',
		name: 'English',
		nativeName: 'English',
		flagSrc: 'flags/united-kingdom.svg',
		htmlLang: 'en',
		population: 0,
	};

	return { ...fallback, ...(language as Partial<AppLanguage> | undefined) };
}
