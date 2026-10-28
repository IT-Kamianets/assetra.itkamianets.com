import infoData from '../../../data/info/pages.json';

export interface InfoSection {
	heading: string;
	text?: string[];
	list?: string[];
}

export interface InfoPage {
	slug: string;
	title: string;
	description: string;
	intro: string;
	sections: InfoSection[];
	cta?: { label: string; path: string };
}

export const infoPages = infoData as InfoPage[];

export function getInfoPage(slug: string | null | undefined): InfoPage | undefined {
	return infoPages.find((page) => page.slug === slug);
}
