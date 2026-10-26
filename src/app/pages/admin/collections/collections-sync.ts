import { CatalogCollection } from '../../../feature/catalog/catalog.interface';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The document shown in «Синхронізація». */
export interface CollectionsDocument {
	version: 1;
	collections: CatalogCollection[];
}

export function toDocument(collections: CatalogCollection[]): CollectionsDocument {
	return { version: 1, collections };
}

export type ParsedCollections = { error: string } | { collections: CatalogCollection[] };

/** Parses the edited JSON: `{ "collections": [...] }` or a bare array, with a readable error per problem. */
export function parseCollections(text: string): ParsedCollections {
	let data: unknown;

	try {
		data = JSON.parse(text);
	} catch (error) {
		return { error: `Це не коректний JSON: ${(error as Error).message}` };
	}

	const list = Array.isArray(data) ? data : (data as { collections?: unknown })?.collections;

	if (!Array.isArray(list)) {
		return { error: 'Очікується об’єкт з полем "collections" — масивом колекцій.' };
	}

	const seen = new Set<string>();
	const collections: CatalogCollection[] = [];

	for (const [index, raw] of list.entries()) {
		const item = raw as Partial<Record<keyof CatalogCollection, unknown>>;
		const where = `Колекція №${index + 1}`;

		if (typeof item !== 'object' || item === null) {
			return { error: `${where}: має бути об’єктом.` };
		}

		if (typeof item.slug !== 'string' || !SLUG_PATTERN.test(item.slug)) {
			return { error: `${where}: "slug" — латиниця в нижньому регістрі, цифри й дефіси.` };
		}

		if (seen.has(item.slug)) {
			return { error: `${where}: slug "${item.slug}" повторюється.` };
		}

		if (typeof item.title !== 'string' || !item.title.trim()) {
			return { error: `${where} (${item.slug}): потрібна назва "title".` };
		}

		for (const key of ['description', 'image'] as const) {
			if (item[key] !== undefined && typeof item[key] !== 'string') {
				return { error: `${where} (${item.slug}): "${key}" має бути рядком.` };
			}
		}

		seen.add(item.slug);
		collections.push({
			slug: item.slug,
			title: item.title.trim(),
			description: ((item.description as string | undefined) ?? '').trim(),
			image: (item.image as string | undefined) ?? '',
		});
	}

	return { collections };
}

/** «Нових: 1, змінено: 2, буде видалено: Volt» — what a sync would do. */
export function describeChanges(current: CatalogCollection[], next: CatalogCollection[]): string {
	const bySlug = new Map(current.map((item) => [item.slug, item]));
	const nextSlugs = new Set(next.map((item) => item.slug));
	const added = next.filter((item) => !bySlug.has(item.slug));
	const changed = next.filter((item) => {
		const before = bySlug.get(item.slug);

		return before && JSON.stringify(before) !== JSON.stringify(item);
	});
	const removed = current.filter((item) => !nextSlugs.has(item.slug));

	if (!added.length && !changed.length && !removed.length) {
		return 'JSON коректний. Змін немає.';
	}

	return [
		'JSON коректний.',
		added.length ? `Нових: ${added.map((item) => item.title).join(', ')}.` : '',
		changed.length ? `Змінено: ${changed.map((item) => item.title).join(', ')}.` : '',
		removed.length ? `Буде видалено: ${removed.map((item) => item.title).join(', ')}.` : '',
	]
		.filter(Boolean)
		.join(' ');
}
