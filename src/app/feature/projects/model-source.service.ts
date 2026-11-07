import { Service } from '@angular/core';
import { isElectron } from '../electron/electron';
import { AssetraProject } from './assetra-project.plugin';

/**
 * Where a viewer should load a model from. In the browser that is the address itself. In the desktop
 * app the CDN refuses the app's origin in CORS, so the file is downloaded through the plugin (main
 * process) and handed over as a blob address. One download per model; the result is kept.
 */
@Service()
export class ModelSourceService {
	private readonly _cache = new Map<string, Promise<string>>();

	resolve(url: string): Promise<string> {
		if (!isElectron()) {
			return Promise.resolve(url);
		}

		let blobUrl = this._cache.get(url);

		if (!blobUrl) {
			blobUrl = AssetraProject.fetchModel({ url }).then(({ base64 }) => {
				const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

				return URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
			});
			// A failed download is not kept, so the next hover or scroll tries again.
			blobUrl.catch(() => this._cache.delete(url));
			this._cache.set(url, blobUrl);
		}

		return blobUrl;
	}
}
