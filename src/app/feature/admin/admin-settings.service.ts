import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { StoreService } from '@wawjs/ngx-core';
import companyData from '../../../data/company/company.json';
import { companyProfile } from '../company/company.data';
import { downloadJson } from './admin-download';

const STORE_KEY = 'admin-settings';

/** Store fields an admin can edit; they map one-to-one onto `src/data/company/company.json`. */
export interface StoreSettings {
	name: string;
	title: string;
	description: string;
	email: string;
	phone: string;
	address: string;
	siteUrl: string;
}

/** Like assets, settings are kept in browser storage and published by exporting company.json. */
@Service()
export class AdminSettingsService {
	private readonly _store = inject(StoreService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _settings = signal<StoreSettings>(_fromProfile());

	readonly settings = this._settings.asReadonly();
	readonly ready: Promise<void> = this._isBrowser ? this._restore() : Promise.resolve();

	async save(settings: StoreSettings) {
		this._settings.set(settings);
		await this._store.setJson(STORE_KEY, settings);
	}

	async reset() {
		this._settings.set(_fromProfile());
		await this._store.remove(STORE_KEY);
	}

	export() {
		const settings = this._settings();

		// Keep every other company.json field (SEO, structured data) as it is.
		downloadJson('company.json', {
			...companyData,
			...Object.fromEntries(Object.entries(settings).filter(([, value]) => value.trim())),
		});
	}

	private async _restore() {
		const saved = await this._store.getJson<StoreSettings>(STORE_KEY);

		if (saved) {
			this._settings.set({ ..._fromProfile(), ...saved });
		}
	}
}

function _fromProfile(): StoreSettings {
	return {
		name: companyProfile.name,
		title: companyProfile.title,
		description: companyProfile.description,
		email: companyProfile.email,
		phone: companyProfile.phone,
		address: companyProfile.address,
		siteUrl: companyProfile.siteUrl,
	};
}
