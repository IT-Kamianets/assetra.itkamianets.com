import { Injector } from '@angular/core';
import { uploadFile } from '../cloud/cloud';

/** Covers are square HD JPEGs. */
export const COVER_SIZE = 1920;

/**
 * Opens the Fabric crop editor for a picked photo and uploads the square result.
 * Resolves with the public URL, or null when the editor was cancelled; throws if the upload fails.
 * Fabric is browser-only and heavy, so it is imported only here, when a cover is being cropped.
 */
export async function cropAndUploadCover(injector: Injector, file: File, title: string): Promise<string | null> {
	const { FabricCropModalService } = await import('@wawjs/ngx-fabric');

	const base64 = await new Promise<string | null>((resolve) => {
		injector.get(FabricCropModalService).open({
			image: file,
			title,
			aspectRatio: 1,
			format: 'jpeg',
			quality: 0.9,
			outputWidth: COVER_SIZE,
			outputHeight: COVER_SIZE,
			labels: { cancel: 'Скасувати', crop: 'Обрізати', loading: 'Завантаження…' },
			onCrop: (result) => resolve(result.base64),
			onCancel: () => resolve(null),
		});
	});

	if (!base64) {
		return null;
	}

	const blob = await (await fetch(base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`)).blob();
	const { publicUrl } = await uploadFile(new File([blob], 'cover.jpg', { type: 'image/jpeg' }), 'image/jpeg', 'cover.jpg');

	return publicUrl;
}
