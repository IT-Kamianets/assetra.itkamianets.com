import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, effect, inject, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { CanonicalService } from '@wawjs/ngx-default';
import { LanguageService } from '@wawjs/ngx-translate';
import { environment } from '../environments/environment';
import { FooterComponent } from './layouts/footer/footer.component';
import { ScrollTopComponent } from './layouts/scroll-top/scroll-top.component';
import { TopbarComponent } from './layouts/topbar/topbar.component';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, TopbarComponent, FooterComponent, ScrollTopComponent],
	template: `
		<div class="flex min-h-screen flex-col">
			<app-topbar />
			<main class="flex-1 pt-[var(--topbar-space)]">
				<router-outlet />
			</main>
			<app-footer />
			<app-scroll-top />
		</div>
	`,
})
export class App {
	private readonly _canonicalService = inject(CanonicalService);
	private readonly _document = inject(DOCUMENT);
	private readonly _languageService = inject(LanguageService);
	private readonly _router = inject(Router);
	private readonly _destroyRef = inject(DestroyRef);

	constructor() {
		this._canonicalService.initialize();

		this._markHomeRoute();

		if (isPlatformBrowser(inject(PLATFORM_ID))) {
			this._scrollToTopOnPageChange();
		}

		effect(() => {
			const language = this._languageService.language();
			const htmlLang =
				environment.languages.find((item) => item.code === language)?.htmlLang ?? language;

			if (htmlLang) {
				this._document.documentElement.lang = htmlLang;
			}
		});
	}

	/** `html.route-home` lets the theme keep the home page's own topbar/footer colours (also in prerendered HTML). */
	private _markHomeRoute() {
		const subscription = this._router.events.subscribe((event) => {
			if (event instanceof NavigationEnd) {
				this._document.documentElement.classList.toggle('route-home', _path(event.urlAfterRedirects) === '/');
			}
		});

		this._destroyRef.onDestroy(() => subscription.unsubscribe());
	}

	/**
	 * Opening another page (e.g. a related model at the bottom of a product) starts at the top.
	 * Query-only changes (catalog filters) and back/forward navigation keep their scroll position.
	 */
	private _scrollToTopOnPageChange() {
		let lastPath = _path(this._router.url);
		let isPopState = false;

		const subscription = this._router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				isPopState = event.navigationTrigger === 'popstate';
			}

			if (event instanceof NavigationEnd) {
				const path = _path(event.urlAfterRedirects);

				if (path !== lastPath && !isPopState) {
					window.scrollTo({ top: 0, behavior: 'instant' });
				}

				lastPath = path;
			}
		});

		this._destroyRef.onDestroy(() => subscription.unsubscribe());
	}
}

function _path(url: string): string {
	return url.split(/[?#]/)[0]!;
}
