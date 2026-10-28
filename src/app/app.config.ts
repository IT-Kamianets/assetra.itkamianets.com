import {
	APP_INITIALIZER,
	ApplicationConfig,
	provideBrowserGlobalErrorListeners,
	provideZonelessChangeDetection,
} from '@angular/core';

import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
	buildAbsoluteUrl,
	buildSeoTitleSuffix,
	provideNgxDefaultSeo,
	stripTitleSuffix,
} from '@wawjs/ngx-default';
import { provideNgxCore } from '@wawjs/ngx-core';
import { provideTranslate } from '@wawjs/ngx-translate';
import { provideNgxUi } from '@wawjs/ngx-ui';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { BootstrapService } from './feature/bootstrap/bootstrap.service';
import { companyProfile } from './feature/company/company.data';

const initializeBootstrapData = (bootstrapService: BootstrapService) => () =>
	bootstrapService.initialize();

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideZonelessChangeDetection(),
		provideHttpClient(withFetch()),
		provideNgxCore({
			meta: {
				applyFromRoutes: true,
				useTitleSuffix: true,
				defaults: {
					title: stripTitleSuffix(companyProfile.defaultSeo.title, companyProfile.name),
					titleSuffix: buildSeoTitleSuffix(companyProfile),
					description: companyProfile.defaultSeo.description,
					image: buildAbsoluteUrl(
						companyProfile.siteUrl,
						companyProfile.defaultSeo.image,
					),
					robots: companyProfile.defaultSeo.robots,
				},
			},
		}),
		provideNgxDefaultSeo({
			siteUrl: companyProfile.siteUrl,
		}),
		// ThemeService writes these inline at runtime, so they must mirror src/styles/_theme.scss.
		// Graphite & Ivory: dark (graphite) is the default look, light is the ivory inversion.
		provideNgxUi({
			mode: 'dark',
			tokens: {
				ffBase: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
				letterSpacing: '0',
			},
			lightTokens: {
				primary: '#5f644a',
				primaryHover: '#4a4f39',
				onPrimary: '#f3f0e7',
				textMuted: '#5e6054',
				placeholder: '#7a7c70',
				bgPrimary: '#f3f0e7',
				bgSecondary: '#fbf9f3',
				bgTertiary: '#e9e5d8',
				border: '#d6d1c2',
				danger: 'var(--c-danger)',
				onDanger: '#ffffff',
				focusRing: '0 0 0 3px rgba(95, 100, 74, 0.4)',
				shadowSm: '0 1px 2px rgba(32, 34, 29, 0.08)',
				shadowMd: '0 10px 30px rgba(32, 34, 29, 0.1)',
			},
			darkTokens: {
				primary: '#858a69',
				primaryHover: '#a0a586',
				onPrimary: '#141612',
				textMuted: '#b8b8ad',
				placeholder: '#9a9b90',
				bgPrimary: '#20221d',
				bgSecondary: '#353830',
				bgTertiary: '#2b2d26',
				border: '#494b43',
				danger: '#e58f7f',
				onDanger: '#20221d',
				focusRing: '0 0 0 3px rgba(160, 165, 134, 0.5)',
				shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
				shadowMd: '0 12px 32px rgba(0, 0, 0, 0.35)',
			},
		}),
		provideRouter(routes),
		provideClientHydration(withEventReplay()),
		provideTranslate({
			// `defaultLanguage` is the source-text language of the i18n arrays; the site opens in Ukrainian.
			defaultLanguage: environment.defaultLanguage,
			language: 'ua',
			languages: environment.languages,
			folder: '/i18n/',
		}),
		{
			provide: APP_INITIALIZER,
			useFactory: initializeBootstrapData,
			deps: [BootstrapService],
			multi: true,
		},
	],
};
