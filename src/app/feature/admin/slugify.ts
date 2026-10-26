/** Ukrainian (and a few Russian) letters in Latin, so Cyrillic names still give a valid slug. */
const TRANSLIT: Record<string, string> = {
	а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
	ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
	ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
	ё: 'io', ы: 'y', э: 'e', ъ: '',
};

/** "Персонаж Cesium Man" → "personazh-cesium-man": lower case, spaces and symbols become "-". */
export function slugify(value: string): string {
	return [...value.toLowerCase()]
		.map((char) => TRANSLIT[char] ?? char)
		.join('')
		.replace(/['’ʼ`]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
