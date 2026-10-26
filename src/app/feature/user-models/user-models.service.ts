import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** Cloudflare accepts request bodies up to ~10 MB, and base64 grows the file by a third. */
export const MAX_MODEL_MB = 7;
export const MAX_IMAGE_MB = 2;

const COLLECTION = 'models';

/** A model a signed-in user uploaded from their profile. Stored in Firestore `models`. */
export interface UserModel {
	id: string;
	uid: string;
	ownerEmail: string;
	title: string;
	description: string;
	category: string;
	modelUrl: string;
	/** Cloudflare file id; deleting it only works while the API server still remembers the upload. */
	modelFileId: string;
	imageUrl: string;
	imageFileId: string;
	fileName: string;
	size: number;
	createdAt: number;
}

export interface UserModelDraft {
	title: string;
	description: string;
	category: string;
	model: File;
	image: File | null;
}

export type UploadResult = 'ok' | 'too-large' | 'bad-file' | 'storage' | 'database' | 'signed-out';

interface UploadedFile {
	id: string;
	publicUrl: string;
}

/**
 * The signed-in user's own models: the GLB (and an optional preview image) go to the Cloudflare
 * container on `environment.apiUrl`, the record goes to Firestore. Firebase is loaded on demand.
 */
@Service()
export class UserModelsService {
	private readonly _auth = inject(AuthService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _models = signal<UserModel[]>([]);
	private _db?: Promise<Firestore>;

	readonly models = this._models.asReadonly();
	readonly count = computed(() => this._models().length);
	readonly loading = signal(false);
	readonly loadFailed = signal(false);

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		effect(() => {
			const uid = this._auth.uid();

			untracked(() => void this._load(uid));
		});
	}

	async add(draft: UserModelDraft): Promise<UploadResult> {
		const uid = this._auth.uid();

		if (!uid) {
			return 'signed-out';
		}

		if (!draft.model.name.toLowerCase().endsWith('.glb') || (draft.image && !draft.image.type.startsWith('image/'))) {
			return 'bad-file';
		}

		if (draft.model.size > MAX_MODEL_MB * 1024 * 1024 || (draft.image?.size ?? 0) > MAX_IMAGE_MB * 1024 * 1024) {
			return 'too-large';
		}

		let model: UploadedFile | null = null;
		let image: UploadedFile | null = null;

		try {
			model = await _upload(draft.model, 'model/gltf-binary', 'model.glb');
			image = draft.image ? await _upload(draft.image, draft.image.type, draft.image.name) : null;
		} catch (error) {
			console.error(error);
			if (model) {
				void _deleteFile(model.id);
			}
			return 'storage';
		}

		const record: Omit<UserModel, 'id'> = {
			uid,
			ownerEmail: this._auth.email(),
			title: draft.title.trim(),
			description: draft.description.trim(),
			category: draft.category,
			modelUrl: model.publicUrl,
			modelFileId: model.id,
			imageUrl: image?.publicUrl ?? '',
			imageFileId: image?.id ?? '',
			fileName: draft.model.name,
			size: draft.model.size,
			createdAt: Date.now(),
		};

		try {
			const [db, { addDoc, collection }] = await Promise.all([this._getDb(), import('firebase/firestore')]);
			const ref = await addDoc(collection(db, COLLECTION), record);

			this._models.update((models) => [{ id: ref.id, ...record }, ...models]);
			return 'ok';
		} catch (error) {
			console.error(error);
			void _deleteFile(model.id);
			if (image) {
				void _deleteFile(image.id);
			}
			return 'database';
		}
	}

	async remove(model: UserModel): Promise<boolean> {
		try {
			const [db, { deleteDoc, doc }] = await Promise.all([this._getDb(), import('firebase/firestore')]);

			await deleteDoc(doc(db, COLLECTION, model.id));
		} catch (error) {
			console.error(error);
			return false;
		}

		this._models.update((models) => models.filter((item) => item.id !== model.id));
		void _deleteFile(model.modelFileId);
		if (model.imageFileId) {
			void _deleteFile(model.imageFileId);
		}
		return true;
	}

	private async _load(uid: string) {
		this._models.set([]);
		this.loadFailed.set(false);

		if (!uid) {
			return;
		}

		this.loading.set(true);

		try {
			const [db, { collection, getDocs, query, where }] = await Promise.all([this._getDb(), import('firebase/firestore')]);
			const snapshot = await getDocs(query(collection(db, COLLECTION), where('uid', '==', uid)));

			// Sorted here rather than with orderBy, which would need a composite index in Firestore.
			if (this._auth.uid() === uid) {
				this._models.set(
					snapshot.docs
						.map((item) => ({ ...(item.data() as Omit<UserModel, 'id'>), id: item.id }))
						.sort((a, b) => b.createdAt - a.createdAt),
				);
			}
		} catch (error) {
			console.error(error);
			this.loadFailed.set(true);
		} finally {
			this.loading.set(false);
		}
	}

	private _getDb(): Promise<Firestore> {
		this._db ??= Promise.all([import('firebase/app'), import('firebase/firestore')]).then(
			([{ getApps, initializeApp }, { getFirestore }]) => getFirestore(getApps()[0] ?? initializeApp(environment.firebase)),
		);

		return this._db;
	}
}

/** Sent through the API server: the R2 bucket does not accept uploads straight from the browser. */
async function _upload(file: File, mime: string, name: string): Promise<UploadedFile> {
	const response = await fetch(`${environment.apiUrl}/api/cloudflare/upload-base64`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ container: environment.uploadContainer, name, mime, base64: await _toBase64(file) }),
	});
	const body = (await response.json().catch(() => null)) as (UploadedFile & { ok?: boolean }) | null;

	if (!response.ok || !body?.ok || !body.publicUrl) {
		throw new Error(`Upload failed: HTTP ${response.status}`);
	}

	return { id: body.id, publicUrl: body.publicUrl };
}

function _deleteFile(id: string) {
	return fetch(`${environment.apiUrl}/api/cloudflare/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
}

function _toBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
