import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { deleteFile, getDb, uploadFile } from '../cloud/cloud';

/** Cloudflare accepts request bodies up to ~10 MB, and base64 grows the file by a third. */
export const MAX_MODEL_MB = 7;
export const MAX_IMAGE_MB = 2;

const COLLECTION = 'models';

/** A model a signed-in user uploaded from their profile. Stored in Firestore `models`. */
export interface UserModel {
	id: string;
	uid: string;
	title: string;
	description: string;
	category: string;
	/** Id of the author's collection (see CollectionsService), or '' when the model is not in a collection. */
	collectionId: string;
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
	collectionId: string;
	model: File;
	image: File | null;
}

export type UploadResult = 'ok' | 'too-large' | 'bad-file' | 'storage' | 'database' | 'signed-out';

/**
 * The signed-in user's own models: the GLB (and an optional preview image) go to the Cloudflare
 * container on `environment.apiUrl`, the record goes to Firestore. Firebase is loaded on demand.
 */
@Service()
export class UserModelsService {
	private readonly _auth = inject(AuthService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _models = signal<UserModel[]>([]);

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

		let model: Awaited<ReturnType<typeof uploadFile>> | null = null;
		let image: Awaited<ReturnType<typeof uploadFile>> | null = null;

		try {
			model = await uploadFile(draft.model, 'model/gltf-binary', 'model.glb');
			image = draft.image ? await uploadFile(draft.image, draft.image.type, draft.image.name) : null;
		} catch (error) {
			console.error(error);
			if (model) {
				void deleteFile(model.id);
			}
			return 'storage';
		}

		const record: Omit<UserModel, 'id'> = {
			uid,
			title: draft.title.trim(),
			description: draft.description.trim(),
			category: draft.category,
			collectionId: draft.collectionId,
			modelUrl: model.publicUrl,
			modelFileId: model.id,
			imageUrl: image?.publicUrl ?? '',
			imageFileId: image?.id ?? '',
			fileName: draft.model.name,
			size: draft.model.size,
			createdAt: Date.now(),
		};

		try {
			const [db, { addDoc, collection }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const ref = await addDoc(collection(db, COLLECTION), record);

			this._models.update((models) => [{ id: ref.id, ...record }, ...models]);
			return 'ok';
		} catch (error) {
			console.error(error);
			void deleteFile(model.id);
			if (image) {
				void deleteFile(image.id);
			}
			return 'database';
		}
	}

	/** Moves one of the user's models into a collection, or out of any collection with ''. */
	async setCollection(model: UserModel, collection: string): Promise<boolean> {
		try {
			const [db, { doc, updateDoc }] = await Promise.all([getDb(), import('firebase/firestore')]);

			await updateDoc(doc(db, COLLECTION, model.id), { collectionId: collection });
		} catch (error) {
			console.error(error);
			return false;
		}

		this._models.update((models) => models.map((item) => (item.id === model.id ? { ...item, collectionId: collection } : item)));
		return true;
	}

	/** Called when the user deletes a collection, so its models do not point to it any more. */
	clearCollection(collection: string) {
		return Promise.all(this._models().filter((model) => model.collectionId === collection).map((model) => this.setCollection(model, '')));
	}

	async remove(model: UserModel): Promise<boolean> {
		try {
			const [db, { deleteDoc, doc }] = await Promise.all([getDb(), import('firebase/firestore')]);

			await deleteDoc(doc(db, COLLECTION, model.id));
		} catch (error) {
			console.error(error);
			return false;
		}

		this._models.update((models) => models.filter((item) => item.id !== model.id));
		void deleteFile(model.modelFileId);
		if (model.imageFileId) {
			void deleteFile(model.imageFileId);
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
			const [db, { collection, getDocs, query, where }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const snapshot = await getDocs(query(collection(db, COLLECTION), where('uid', '==', uid)));

			// Sorted here rather than with orderBy, which would need a composite index in Firestore.
			if (this._auth.uid() === uid) {
				this._models.set(
					snapshot.docs
						.map((item) => {
							const data = item.data() as Omit<UserModel, 'id'>;

							return { ...data, collectionId: data.collectionId ?? '', id: item.id };
						})
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
}
