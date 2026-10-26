import { categories, PURPOSE_LABELS } from '../../../feature/catalog/catalog.data';
import { Product, ProductPurpose } from '../../../feature/catalog/catalog.interface';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PURPOSES = Object.keys(PURPOSE_LABELS) as ProductPurpose[];

/** The document shown in «Синхронізація». */
export interface AssetsDocument {
	version: 1;
	assets: Product[];
}

export function toDocument(assets: Product[]): AssetsDocument {
	return { version: 1, assets };
}

export type ParsedAssets = { error: string } | { assets: Product[] };

/** Parses the edited JSON: `{ "assets": [...] }` or a bare array (like products.json), one readable error per problem. */
export function parseAssets(text: string): ParsedAssets {
	let data: unknown;

	try {
		data = JSON.parse(text);
	} catch (error) {
		return { error: `Це не коректний JSON: ${(error as Error).message}` };
	}

	const list = Array.isArray(data) ? data : (data as { assets?: unknown })?.assets;

	if (!Array.isArray(list)) {
		return { error: 'Очікується об’єкт з полем "assets" — масивом ассетів.' };
	}

	const seen = new Set<string>();

	for (const [index, raw] of list.entries()) {
		const item = raw as Record<string, unknown>;
		const where = `Ассет №${index + 1}${typeof item?.['slug'] === 'string' ? ` (${item['slug']})` : ''}`;
		const problem = _problem(item);

		if (problem) {
			return { error: `${where}: ${problem}` };
		}

		if (seen.has(item['slug'] as string)) {
			return { error: `${where}: slug повторюється.` };
		}

		seen.add(item['slug'] as string);
	}

	return { assets: list as Product[] };
}

/** «Нових: …, змінено: …, буде видалено: …» — what a sync would do. */
export function describeChanges(current: Product[], next: Product[]): string {
	const bySlug = new Map(current.map((item) => [item.slug, item]));
	const nextSlugs = new Set(next.map((item) => item.slug));
	const added = next.filter((item) => !bySlug.has(item.slug));
	const changed = next.filter((item) => {
		const before = bySlug.get(item.slug);

		return before && JSON.stringify(before) !== JSON.stringify(item);
	});
	const removed = current.filter((item) => !nextSlugs.has(item.slug));
	const names = (items: Product[]) =>
		items.length > 5 ? `${items.slice(0, 5).map((item) => item.title).join(', ')} та ще ${items.length - 5}` : items.map((item) => item.title).join(', ');

	if (!added.length && !changed.length && !removed.length) {
		return 'JSON коректний. Змін немає.';
	}

	return [
		'JSON коректний.',
		added.length ? `Нових: ${names(added)}.` : '',
		changed.length ? `Змінено: ${names(changed)}.` : '',
		removed.length ? `Буде видалено: ${names(removed)}.` : '',
	]
		.filter(Boolean)
		.join(' ');
}

function _problem(item: Record<string, unknown>): string {
	if (typeof item !== 'object' || item === null || Array.isArray(item)) {
		return 'має бути об’єктом.';
	}

	if (typeof item['slug'] !== 'string' || !SLUG_PATTERN.test(item['slug'])) {
		return '"slug" — латиниця в нижньому регістрі, цифри й дефіси.';
	}

	for (const key of ['title', 'short', 'seller']) {
		if (typeof item[key] !== 'string' || !(item[key] as string).trim()) {
			return `потрібне непорожнє поле "${key}".`;
		}
	}

	if (!categories.some((category) => category.slug === item['category'])) {
		return `"category" має бути однією з: ${categories.map((category) => category.slug).join(', ')}.`;
	}

	for (const key of ['price', 'polygons']) {
		if (typeof item[key] !== 'number' || (item[key] as number) < 0) {
			return `"${key}" — невід'ємне число.`;
		}
	}

	for (const key of ['description', 'textures', 'archiveSize']) {
		if (typeof item[key] !== 'string') {
			return `"${key}" має бути рядком (можна порожнім).`;
		}
	}

	for (const key of ['images', 'software', 'renderers', 'formats', 'tags']) {
		if (!Array.isArray(item[key]) || (item[key] as unknown[]).some((value) => typeof value !== 'string')) {
			return `"${key}" має бути масивом рядків.`;
		}
	}

	if (!Array.isArray(item['purpose']) || (item['purpose'] as unknown[]).some((value) => !PURPOSES.includes(value as ProductPurpose))) {
		return `"purpose" — масив з: ${PURPOSES.join(', ')}.`;
	}

	for (const key of ['rigged', 'animated']) {
		if (typeof item[key] !== 'boolean') {
			return `"${key}" має бути true або false.`;
		}
	}

	for (const key of ['model', 'modelLow', 'collection']) {
		if (item[key] !== undefined && typeof item[key] !== 'string') {
			return `"${key}" має бути рядком.`;
		}
	}

	if (item['details'] !== undefined && (typeof item['details'] !== 'object' || item['details'] === null || Array.isArray(item['details']))) {
		return '"details" має бути об’єктом.';
	}

	return '';
}
