/** Formats accepted for profile photos and covers. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
/** Largest file a visitor may pick; it is resized and compressed before upload. */
export const MAX_SOURCE_MB = 8;

/** The upload API takes ~10 MB bodies and base64 adds a third, so keep prepared images small. */
const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024;

export type ImageKind = 'avatar' | 'cover';
export type ImageProblem = 'bad-file' | 'too-large';

const TARGETS: Record<ImageKind, { width: number; height: number }> = {
	avatar: { width: 512, height: 512 },
	cover: { width: 1600, height: 500 },
};

/** Checks type and size of a picked file; returns the problem or null when it is fine. */
export function checkImage(file: File): ImageProblem | null {
	if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
		return 'bad-file';
	}

	return file.size > MAX_SOURCE_MB * 1024 * 1024 ? 'too-large' : null;
}

/** Centre-crops to the avatar (square) or cover (wide) shape, scales down and re-encodes as WebP. */
export async function prepareImage(file: File, kind: ImageKind): Promise<File> {
	const problem = checkImage(file);

	if (problem) {
		throw new Error(problem);
	}

	const { width, height } = TARGETS[kind];
	const bitmap = await createImageBitmap(file);
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');

	if (!context) {
		throw new Error('bad-file');
	}

	// Never upscale a small picture: keep the target shape but at the source's own resolution.
	const scale = Math.min(1, bitmap.width / width, bitmap.height / height);

	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);

	const ratio = width / height;
	const cropWidth = Math.min(bitmap.width, bitmap.height * ratio);
	const cropHeight = cropWidth / ratio;

	context.imageSmoothingQuality = 'high';
	context.drawImage(
		bitmap,
		(bitmap.width - cropWidth) / 2,
		(bitmap.height - cropHeight) / 2,
		cropWidth,
		cropHeight,
		0,
		0,
		canvas.width,
		canvas.height,
	);
	bitmap.close();

	let quality = 0.88;
	let blob = await _toBlob(canvas, quality);

	while (blob.size > MAX_OUTPUT_BYTES && quality > 0.5) {
		quality -= 0.1;
		blob = await _toBlob(canvas, quality);
	}

	if (blob.size > MAX_OUTPUT_BYTES) {
		throw new Error('too-large');
	}

	return new File([blob], `${kind}.webp`, { type: 'image/webp' });
}

function _toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('bad-file'))), 'image/webp', quality),
	);
}
