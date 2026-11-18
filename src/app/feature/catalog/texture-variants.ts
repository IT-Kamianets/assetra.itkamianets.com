import { TextureVariant } from './catalog.interface';

export const MAX_TEXTURE_VARIANTS = 12;

const COLOR = /^#[0-9a-f]{3,8}$/i;

/**
 * Colour choices as site users may add them to their models: a short name and a hex colour. Anything
 * else is dropped, names are trimmed and the list is capped, so data read back from Firestore is safe
 * to show and to apply to the 3D model.
 */
export function cleanColorVariants(list: unknown): TextureVariant[] {
	if (!Array.isArray(list)) {
		return [];
	}

	return list
		.filter((item): item is { name?: unknown; color: string } => typeof item?.color === 'string' && COLOR.test(item.color))
		.slice(0, MAX_TEXTURE_VARIANTS)
		.map((item) => ({ name: (typeof item.name === 'string' ? item.name.trim() : '').slice(0, 30) || item.color, color: item.color }));
}
