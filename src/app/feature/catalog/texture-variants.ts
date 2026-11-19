import { TextureVariant } from './catalog.interface';

export const MAX_TEXTURE_VARIANTS = 12;

const COLOR = /^#[0-9a-f]{3,8}$/i;
/** Files users upload are kept on this storage; a colour's own GLB must be one of them. */
const UPLOADS = /^https:\/\/cdn-it\.webart\.work\/assetka\//;

/** A row of the colour editor: a stored colour plus a GLB that was picked but is not uploaded yet. */
export interface ColorVariantRow extends TextureVariant {
	file?: File | null;
}

/**
 * Colour choices as site users may add them to their models: a short name, a hex colour and, if the
 * colour is a separate GLB file, that file's address. Anything else is dropped, names are trimmed and
 * the list is capped, so data read back from Firestore is safe to show and to load into the viewer.
 */
export function cleanColorVariants(list: unknown): TextureVariant[] {
	if (!Array.isArray(list)) {
		return [];
	}

	return list
		.filter((item): item is { name?: unknown; color: string; model?: unknown; modelFileId?: unknown } => typeof item?.color === 'string' && COLOR.test(item.color))
		.slice(0, MAX_TEXTURE_VARIANTS)
		.map((item) => {
			const model = typeof item.model === 'string' && UPLOADS.test(item.model) ? item.model : '';

			return {
				name: (typeof item.name === 'string' ? item.name.trim() : '').slice(0, 30) || item.color,
				color: item.color,
				...(model ? { model } : {}),
				...(model && typeof item.modelFileId === 'string' ? { modelFileId: item.modelFileId.slice(0, 100) } : {}),
			};
		});
}
