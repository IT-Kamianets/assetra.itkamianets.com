import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { deleteFile, getDb, uploadFile } from '../cloud/cloud';
import { ImageKind, prepareImage } from './image-prepare';

export const PROFILE_ROLES = [
	{ value: '3d-artist', label: '3D-художник' },
	{ value: 'designer', label: 'Дизайнер' },
	{ value: 'game-dev', label: 'Розробник ігор' },
	{ value: 'architect', label: 'Архітектор' },
	{ value: 'buyer', label: 'Покупець' },
	{ value: 'other', label: 'Інше' },
];

export const NICKNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const BIO_MAX = 280;

/**
 * Public profile of a signed-in user (Firestore `profiles/{uid}`). It never contains the email:
 * the email stays in the private account settings. Nicknames are unique through `nicknames/{nickname}`.
 */
export interface UserProfile {
	uid: string;
	nickname: string;
	name: string;
	bio: string;
	role: string;
	city: string;
	portfolio: string;
	instagram: string;
	behance: string;
	artstation: string;
	avatarUrl: string;
	avatarFileId: string;
	coverUrl: string;
	coverFileId: string;
	updatedAt: number;
}

export type ProfileFields = Pick<
	UserProfile,
	'nickname' | 'name' | 'bio' | 'role' | 'city' | 'portfolio' | 'instagram' | 'behance' | 'artstation'
>;

/** What to do with a picture on save: replace it with a file, remove it, or leave it as is (null). */
export type ImageChange = File | 'remove' | null;

export interface ProfileDraft extends ProfileFields {
	avatar: ImageChange;
	cover: ImageChange;
}

export type ProfileResult = 'ok' | 'invalid' | 'taken' | 'bad-file' | 'too-large' | 'storage' | 'database' | 'signed-out';
export type NicknameStatus = 'free' | 'mine' | 'taken' | 'error';

const PROFILES = 'profiles';
const NICKNAMES = 'nicknames';

@Service()
export class ProfileService {
	private readonly _auth = inject(AuthService);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _profile = signal<UserProfile | null>(null);

	readonly profile = this._profile.asReadonly();
	readonly loading = signal(false);
	readonly loadFailed = signal(false);
	/** True once the user has chosen a nickname, i.e. has a public profile. */
	readonly hasProfile = computed(() => !!this._profile()?.nickname);
	/** Public name: the display name, else the nickname. Never the email. */
	readonly displayName = computed(() => this._profile()?.name || (this._profile()?.nickname ? `@${this._profile()!.nickname}` : 'Новий користувач'));

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		effect(() => {
			const uid = this._auth.uid();

			untracked(() => void this._load(uid));
		});
	}

	/** Whether a nickname is free. Done with a plain read first so a taken name is told apart from missing database access. */
	async checkNickname(nickname: string): Promise<NicknameStatus> {
		const nick = nickname.trim().toLowerCase();

		if (!NICKNAME_PATTERN.test(nick)) {
			return 'error';
		}

		if (nick === this._profile()?.nickname) {
			return 'mine';
		}

		try {
			const [db, { doc, getDoc }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const snapshot = await getDoc(doc(db, NICKNAMES, nick));

			return !snapshot.exists() ? 'free' : snapshot.data()['uid'] === this._auth.uid() ? 'mine' : 'taken';
		} catch (error) {
			console.error(error);
			return 'error';
		}
	}

	async save(draft: ProfileDraft): Promise<ProfileResult> {
		const uid = this._auth.uid();

		if (!uid) {
			return 'signed-out';
		}

		const nickname = draft.nickname.trim().toLowerCase();

		if (!NICKNAME_PATTERN.test(nickname)) {
			return 'invalid';
		}

		const current = this._profile();
		const nicknameChanged = nickname !== current?.nickname;

		if (nicknameChanged && (await this.checkNickname(nickname)) === 'taken') {
			return 'taken';
		}

		const uploaded: { id: string }[] = [];
		const avatar = await this._resolveImage('avatar', draft.avatar, current?.avatarUrl ?? '', current?.avatarFileId ?? '', uploaded);
		const cover = await this._resolveImage('cover', draft.cover, current?.coverUrl ?? '', current?.coverFileId ?? '', uploaded);

		if (typeof avatar === 'string' || typeof cover === 'string') {
			uploaded.forEach((file) => void deleteFile(file.id));
			return typeof avatar === 'string' ? avatar : (cover as ProfileResult);
		}

		const profile: UserProfile = {
			uid,
			nickname,
			name: draft.name.trim(),
			bio: draft.bio.trim(),
			role: draft.role,
			city: draft.city.trim(),
			portfolio: draft.portfolio.trim(),
			instagram: draft.instagram.trim(),
			behance: draft.behance.trim(),
			artstation: draft.artstation.trim(),
			avatarUrl: avatar.url,
			avatarFileId: avatar.fileId,
			coverUrl: cover.url,
			coverFileId: cover.fileId,
			updatedAt: Date.now(),
		};

		try {
			const [db, { doc, writeBatch }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const batch = writeBatch(db);

			batch.set(doc(db, PROFILES, uid), profile);

			if (nicknameChanged) {
				batch.set(doc(db, NICKNAMES, nickname), { uid });

				if (current?.nickname) {
					batch.delete(doc(db, NICKNAMES, current.nickname));
				}
			}

			await batch.commit();
		} catch (error) {
			console.error(error);
			uploaded.forEach((file) => void deleteFile(file.id));
			return 'database';
		}

		// Replaced or removed pictures are no longer referenced; best effort, the API forgets old uploads anyway.
		if (current?.avatarFileId && current.avatarFileId !== profile.avatarFileId) {
			void deleteFile(current.avatarFileId);
		}

		if (current?.coverFileId && current.coverFileId !== profile.coverFileId) {
			void deleteFile(current.coverFileId);
		}

		this._profile.set(profile);
		return 'ok';
	}

	/** Changes only one picture (quick actions on the profile header), keeping every other field. */
	async setImage(kind: ImageKind, change: ImageChange): Promise<ProfileResult> {
		const current = this._profile();

		if (!current) {
			return 'invalid';
		}

		const { nickname, name, bio, role, city, portfolio, instagram, behance, artstation } = current;

		return this.save({
			nickname,
			name,
			bio,
			role,
			city,
			portfolio,
			instagram,
			behance,
			artstation,
			avatar: kind === 'avatar' ? change : null,
			cover: kind === 'cover' ? change : null,
		});
	}

	private async _resolveImage(
		kind: ImageKind,
		change: ImageChange,
		url: string,
		fileId: string,
		uploaded: { id: string }[],
	): Promise<{ url: string; fileId: string } | ProfileResult> {
		if (change === null) {
			return { url, fileId };
		}

		if (change === 'remove') {
			return { url: '', fileId: '' };
		}

		let prepared: File;

		try {
			prepared = await prepareImage(change, kind);
		} catch (error) {
			return (error as Error).message === 'too-large' ? 'too-large' : 'bad-file';
		}

		try {
			const file = await uploadFile(prepared, prepared.type, prepared.name);

			uploaded.push({ id: file.id });
			return { url: file.publicUrl, fileId: file.id };
		} catch (error) {
			console.error(error);
			return 'storage';
		}
	}

	private async _load(uid: string) {
		this._profile.set(null);
		this.loadFailed.set(false);

		if (!uid) {
			return;
		}

		this.loading.set(true);

		try {
			const [db, { doc, getDoc }] = await Promise.all([getDb(), import('firebase/firestore')]);
			const snapshot = await getDoc(doc(db, PROFILES, uid));

			if (this._auth.uid() === uid && snapshot.exists()) {
				this._profile.set({ ...(snapshot.data() as UserProfile), uid });
			}
		} catch (error) {
			console.error(error);
			this.loadFailed.set(true);
		} finally {
			if (this._auth.uid() === uid) {
				this.loading.set(false);
			}
		}
	}
}

export const PROFILE_ERRORS: Record<Exclude<ProfileResult, 'ok'>, string> = {
	invalid: 'Перевірте поля форми: нікнейм має містити 3–20 латинських літер, цифр або «_».',
	taken: 'Цей нікнейм уже зайнятий. Оберіть інший.',
	'bad-file': 'Підтримуються лише зображення JPG, PNG і WebP.',
	'too-large': 'Зображення завелике. Оберіть файл до 8 МБ.',
	storage: 'Не вдалося завантажити зображення. Спробуйте ще раз трохи пізніше.',
	database: 'Не вдалося зберегти профіль. Правила бази даних для профілів, ймовірно, ще не опубліковані — спробуйте пізніше.',
	'signed-out': 'Увійдіть в акаунт, щоб редагувати профіль.',
};
