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
		provideNgxUi({
			lightTokens: {
				primary: '#6b7259',
				primaryHover: '#414638',
				onPrimary: '#ffffff',
				textMuted: '#707565',
				bgPrimary: '#f7f5ef',
				bgSecondary: '#fffefa',
				bgTertiary: '#edeadf',
				border: '#d9d5c7',
				focusRing: '0 0 0 3px rgba(107, 114, 89, 0.4)',
			},
			darkTokens: {
				primary: '#9aa286',
				primaryHover: '#b0b79c',
				onPrimary: '#1e201b',
				textMuted: '#a3a796',
				bgPrimary: '#1e201b',
				bgSecondary: '#282b24',
				bgTertiary: '#33372e',
				border: '#41463a',
				focusRing: '0 0 0 3px rgba(154, 162, 134, 0.45)',
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
