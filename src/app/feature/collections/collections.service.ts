import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { deleteFile, getDb, uploadFile } from '../cloud/cloud';
import { MAX_IMAGE_MB, UserModel } from '../user-models/user-models.service';

const COLLECTION = 'collections';

/**
 * An author's collection: a themed set of their models (e.g. everything for VRoom, or one fantasy
 * setting). Stored in Firestore `collections`; models point to it through their `collectionId` field.
 */
export interface ModelCollection {
	id: string;
	uid: string;
	title: string;
	description: string;
	imageUrl: string;
	imageFileId: string;
	createdAt: number;
}

export interface CollectionDraft {
	title: string;
	description: string;
	image: File | null;
}

export type CollectionResult = 'ok' | 'too-large' | 'bad-file' | 'storage' | 'database' | 'signed-out';

/** The signed-in author's collections, plus public reads of every collection for the /collections page. */
@Service()
export class CollectionsService {
	private readonly _auth = inject(AuthService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _mine = signal<ModelCollection[]>([]);

	/** Collections of the signed-in user, newest first. */
	readonly mine = this._mine.asReadonly();

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		effect(() => {
			const uid = this._auth.uid();

			untracked(() => void this._loadMine(uid));
		});
	}

	async create(draft: CollectionDraft): Promise<CollectionResult> {
		const uid = this._auth.uid();

		if (!uid) {
			return 'signed-out';
		}

		if (draft.image && !draft.image.type.startsWith('image/')) {
			return 'bad-file';
		}

		if ((draft.image?.size ?? 0) > MAX_IMAGE_MB * 1024 * 1024) {
			return 'too-large';
		}

		let image: Awaited<ReturnType<typeof uploadFile>> | null = null;

		try {
			image = draft.image ? await uploadFile(draft.image, draft.image.type, draft.image.name) : null;
		} catch (error) {
			console.error(error);
			return 'storage';
		}

		const record: Omit<ModelCollection, 'id'> = {
			uid,
			title: draft.title.trim(),
			description: draft.description.trim(),
			imageUrl: image?.publicUrl ?? '',
			imageFileId: image?.id ?? '',
			createdAt: Date.now(),
		};

		try {
			const [db, { addDoc, collection }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const ref = await addDoc(collection(db, COLLECTION), record);

			this._mine.update((collections) => [{ id: ref.id, ...record }, ...collections]);
			return 'ok';
		} catch (error) {
			console.error(error);
			if (image) {
				void deleteFile(image.id);
			}
			return 'database';
		}
	}

	/** Deletes the collection only; the caller moves its models out first (UserModelsService.clearCollection). */
	async remove(collection: ModelCollection): Promise<boolean> {
		try {
			const [db, { deleteDoc, doc }] = await Promise.all([getDb(), import('firebase/firestore')]);

			await deleteDoc(doc(db, COLLECTION, collection.id));
		} catch (error) {
			console.error(error);
			return false;
		}

		this._mine.update((collections) => collections.filter((item) => item.id !== collection.id));
		if (collection.imageFileId) {
			void deleteFile(collection.imageFileId);
		}
		return true;
	}

	/** Every collection on the site, newest first. */
	async loadAll(): Promise<ModelCollection[]> {
		const [db, { collection, getDocs, limit, query }] = await Promise.all([getDb(), import('firebase/firestore')]);
		const snapshot = await getDocs(query(collection(db, COLLECTION), limit(200)));

		return _newestFirst(snapshot.docs.map((item) => ({ ...(item.data() as Omit<ModelCollection, 'id'>), id: item.id })));
	}

	/** One collection with its models; `collection` is null when the id does not exist. */
	async loadCollection(id: string): Promise<{ collection: ModelCollection | null; models: UserModel[] }> {
		const [db, { collection, doc, getDoc, getDocs, query, where }] = await Promise.all([getDb(), import('firebase/firestore')]);
		const [collectionSnapshot, modelsSnapshot] = await Promise.all([
			getDoc(doc(db, COLLECTION, id)),
			getDocs(query(collection(db, 'models'), where('collectionId', '==', id))),
		]);

		return {
			collection: collectionSnapshot.exists() ? { ...(collectionSnapshot.data() as Omit<ModelCollection, 'id'>), id } : null,
			models: _newestFirst(modelsSnapshot.docs.map((item) => ({ ...(item.data() as Omit<UserModel, 'id'>), id: item.id }))),
		};
	}

	private async _loadMine(uid: string) {
		this._mine.set([]);

		if (!uid) {
			return;
		}

		try {
			const [db, { collection, getDocs, query, where }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const snapshot = await getDocs(query(collection(db, COLLECTION), where('uid', '==', uid)));

			if (this._auth.uid() === uid) {
				this._mine.set(_newestFirst(snapshot.docs.map((item) => ({ ...(item.data() as Omit<ModelCollection, 'id'>), id: item.id }))));
			}
		} catch (error) {
			console.error(error);
		}
	}
}

/** Sorted here rather than with orderBy, which would need composite indexes in Firestore. */
function _newestFirst<T extends { createdAt: number }>(items: T[]): T[] {
	return items.sort((a, b) => b.createdAt - a.createdAt);
}
