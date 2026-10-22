import type { FirebaseOptions } from 'firebase/app';

export const environment: {
	apiUrl: string;
	appVersion: string;
	production: boolean;
	companyId: string;
	defaultLanguage: string;
	languages: AppLanguage[];
	firebase: FirebaseOptions;
	adminEmails: string[];
} = {
	apiUrl: 'https://it.webart.work',
	appVersion: '1.0.0',
	production: true,
	companyId: 'demo',
	defaultLanguage: 'en',
	// Public web config of the Firebase project (not a secret); access is enforced by Firebase.
	firebase: {
		apiKey: 'AIzaSyDDvvPlZfa7RSmpZUaqHTHqu7LK9yXgQxc',
		authDomain: 'vroom-8ef42.firebaseapp.com',
		projectId: 'vroom-8ef42',
		storageBucket: 'vroom-8ef42.firebasestorage.app',
		messagingSenderId: '398914265119',
		appId: '1:398914265119:web:df4bbfdbd7af072e18752a',
		measurementId: 'G-RP486LZW2B',
	},
	// Firebase accounts allowed into /admin; anyone else is signed out after login.
	adminEmails: ['alina.siruk26@gmail.com', 'ceo@webart.work', 'kristinaolefirenko5@gmail.com'],
	// The site is Ukrainian-first; English is the only other language.
	languages: [
		{
			code: 'ua',
			name: 'Ukrainian',
			nativeName: 'Українська',
			flagSrc: 'flags/ukraine.svg',
			htmlLang: 'uk',
			population: 35,
		},
		{
			code: 'en',
			name: 'English',
			nativeName: 'English',
			flagSrc: 'flags/united-kingdom.svg',
			htmlLang: 'en',
			population: 280,
		},
	],
};

export interface AppLanguage {
	code: string;
	name: string;
	nativeName: string;
	flagSrc: string;
	htmlLang: string;
	population: number;
}

