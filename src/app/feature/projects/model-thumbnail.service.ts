import { inject, Service, signal } from '@angular/core';
import { ModelSourceService } from './model-source.service';

const STORE_KEY = 'assetra.modelThumbs.v2';
const MAX_STORED = 150;
const WIDTH = 320;
const HEIGHT = 240;
const LOAD_TIMEOUT_MS = 20000;

/** The slice of the <model-viewer> element that thumbnails use. */
interface ViewerElement extends HTMLElement {
	src: string;
	loaded: boolean;
	updateComplete: Promise<unknown>;
	toBlob(options: { mimeType: string; idealAspect?: boolean }): Promise<Blob>;
}

/**
 * Pictures for models that have no preview image. The GLB is loaded in an off-screen <model-viewer>,
 * one model at a time, and a snapshot of it is kept (in memory and in local storage) for next time.
 * Models of the library cannot get an image afterwards, so the desktop app draws its own.
 */
@Service()
export class ModelThumbnailService {
	private readonly _source = inject(ModelSourceService);
	private readonly _thumbs = signal<Record<string, string>>(_load());
	private readonly _queued = new Set<string>();
	private readonly _failed = new Set<string>();
	private _queue: Promise<void> = Promise.resolve();

	/** Snapshot of the model at `url` as an image address, or '' while it is not ready. */
	thumb(url: string): string {
		return this._thumbs()[url] ?? '';
	}

	/** Starts making the snapshot, once per model. */
	request(url: string): void {
		if (!url || this._thumbs()[url] || this._queued.has(url) || this._failed.has(url)) {
			return;
		}

		this._queued.add(url);
		this._queue = this._queue.then(() => this._make(url));
	}

	private async _make(url: string): Promise<void> {
		try {
			await import('@google/model-viewer');

			const dataUrl = await _snapshot(await this._source.resolve(url));

			this._thumbs.update((all) => ({ ...all, [url]: dataUrl }));
			_save(this._thumbs());
		} catch {
			this._failed.add(url);
		} finally {
			this._queued.delete(url);
		}
	}
}

/** Loads the model in a hidden viewer and returns a PNG of it as a data address. */
async function _snapshot(url: string): Promise<string> {
	const viewer = document.createElement('model-viewer') as ViewerElement;

	viewer.setAttribute('environment-image', 'neutral');
	viewer.setAttribute('shadow-intensity', '0');
	viewer.setAttribute('camera-orbit', '35deg 70deg auto');
	viewer.setAttribute('interaction-prompt', 'none');
	// Visible to the browser (a viewer outside the screen does not draw) but invisible to the person.
	viewer.style.cssText = `position:fixed;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px;opacity:0.01;pointer-events:none;z-index:-1`;

	try {
		const loaded = new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);

			viewer.addEventListener('load', () => (clearTimeout(timer), resolve()), { once: true });
			viewer.addEventListener('error', () => (clearTimeout(timer), reject(new Error('load error'))), { once: true });
		});

		viewer.src = url;
		document.body.append(viewer);
		await loaded;
		await viewer.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 150));

		const blob = await viewer.toBlob({ mimeType: 'image/png', idealAspect: false });

		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});
	} finally {
		viewer.remove();
	}
}

function _load(): Record<string, string> {
	try {
		const value = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');

		return value && typeof value === 'object' ? value : {};
	} catch {
		return {};
	}
}

function _save(all: Record<string, string>): void {
	try {
		const keys = Object.keys(all);
		const kept = keys.length > MAX_STORED ? Object.fromEntries(keys.slice(-MAX_STORED).map((key) => [key, all[key]])) : all;

		localStorage.setItem(STORE_KEY, JSON.stringify(kept));
	} catch {
		// Storage full or blocked: thumbnails are simply made again next time.
	}
}
