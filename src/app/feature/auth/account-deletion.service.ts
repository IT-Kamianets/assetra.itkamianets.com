import { inject, Service } from '@angular/core';
import { deleteFile, getDb } from '../cloud/cloud';
import { AuthResult, AuthService } from './auth.service';

export type DeleteAccountResult = AuthResult | 'data';

/**
 * Deletes the signed-in person's account: the profile, nickname, models, collections and their files,
 * then the Firebase account itself. The person is confirmed again first (Firebase and Apple both want a
 * recent sign-in), and the data goes before the account because Firestore rules need the sign-in.
 */
@Service()
export class AccountDeletionService {
	private readonly _auth = inject(AuthService);

	async delete(password = ''): Promise<DeleteAccountResult> {
		const uid = this._auth.uid();

		if (!uid) {
			return 'error';
		}

		const confirmed = await this._auth.reauthenticate(password);

		if (confirmed !== 'ok') {
			return confirmed;
		}

		try {
			await this._removeData(uid);
		} catch (error) {
			console.error(error);
			return 'data';
		}

		return this._auth.deleteCurrentUser();
	}

	private async _removeData(uid: string) {
		const [db, { collection, deleteDoc, doc, getDoc, getDocs, query, where }] = await Promise.all([getDb(), import('firebase/firestore')]);
		const files: string[] = [];

		for (const name of ['models', 'collections']) {
			const snapshot = await getDocs(query(collection(db, name), where('uid', '==', uid)));

			for (const item of snapshot.docs) {
				const data = item.data() as Record<string, unknown>;

				files.push(String(data['modelFileId'] ?? ''), String(data['lowModelFileId'] ?? ''), String(data['imageFileId'] ?? ''));
				await deleteDoc(item.ref);
			}
		}

		const profileRef = doc(db, 'profiles', uid);
		const profile = await getDoc(profileRef);

		if (profile.exists()) {
			const data = profile.data() as Record<string, unknown>;
			const nickname = String(data['nickname'] ?? '');

			files.push(String(data['avatarFileId'] ?? ''), String(data['coverFileId'] ?? ''));

			if (nickname) {
				await deleteDoc(doc(db, 'nicknames', nickname));
			}

			await deleteDoc(profileRef);
		}

		// Best effort: the file server only remembers uploads until it restarts.
		await Promise.all(files.filter(Boolean).map((id) => deleteFile(id)));
	}
}
