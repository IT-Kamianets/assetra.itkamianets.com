import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../../feature/auth/auth.service';
import { ProductCardComponent } from '../../../feature/catalog/product-card/product-card.component';
import { CollectionsService } from '../../../feature/collections/collections.service';
import { FavoritesService } from '../../../feature/favorites/favorites.service';
import { ACCEPT_ATTR, checkImage, ImageKind } from '../../../feature/profile/image-prepare';
import { PROFILE_ERRORS, PROFILE_ROLES, ProfileService } from '../../../feature/profile/profile.service';
import { UserModelsService } from '../../../feature/user-models/user-models.service';
import { AccountSettingsComponent } from '../account-settings/account-settings.component';
import { MyCollectionsComponent } from '../my-collections/my-collections.component';
import { MyModelsComponent } from '../my-models/my-models.component';
import { ProfileEditComponent } from '../profile-edit/profile-edit.component';

type Tab = 'overview' | 'models' | 'collections' | 'favorites' | 'settings';
interface PendingImage {
	file: File;
	url: string;
}

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const TABS: { id: Tab; label: string; icon: string }[] = [
	{ id: 'overview', label: 'Огляд', icon: 'dashboard' },
	{ id: 'models', label: 'Мої моделі', icon: 'view_in_ar' },
	{ id: 'collections', label: 'Колекції', icon: 'collections_bookmark' },
	{ id: 'favorites', label: 'Обране', icon: 'favorite' },
	{ id: 'settings', label: 'Налаштування', icon: 'settings' },
];

const DATE = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

/** The signed-in user's profile: cover, photo, public details, stats and the tabbed workspace. */
@Component({
	selector: 'app-account-profile',
	imports: [
		RouterLink,
		ProductCardComponent,
		MyModelsComponent,
		MyCollectionsComponent,
		AccountSettingsComponent,
		ProfileEditComponent,
	],
	templateUrl: './account-profile.component.html',
})
export class AccountProfileComponent {
	protected readonly auth = inject(AuthService);
	protected readonly profiles = inject(ProfileService);
	protected readonly userModels = inject(UserModelsService);
	protected readonly collections = inject(CollectionsService);
	protected readonly favorites = inject(FavoritesService);
	private readonly _router = inject(Router);
	private readonly _route = inject(ActivatedRoute);
	private readonly _editor = viewChild.required(ProfileEditComponent);

	/** Page the visitor came from (e.g. a model they wanted to download); shown as a way back. */
	readonly next = input<string | null>(null);

	protected readonly tabs = TABS;
	protected readonly accept = ACCEPT_ATTR;
	protected readonly tab = toSignal(
		this._route.queryParamMap.pipe(map((params) => _tab(params.get('tab')))),
		{ initialValue: _tab(this._route.snapshot.queryParamMap.get('tab')) },
	);
	protected readonly uploading = signal<ImageKind | ''>('');
	/** A picture chosen but not saved yet: shown as a preview until the visitor confirms. */
	protected readonly pendingAvatar = signal<PendingImage | null>(null);
	protected readonly pendingCover = signal<PendingImage | null>(null);
	protected readonly avatarSrc = computed(() => this.pendingAvatar()?.url || this.profiles.profile()?.avatarUrl || '');
	protected readonly coverSrc = computed(() => this.pendingCover()?.url || this.profiles.profile()?.coverUrl || '');
	protected readonly notice = signal<Notice>(null);

	protected readonly registered = computed(() => (this.auth.createdAt() ? DATE.format(this.auth.createdAt()) : ''));
	protected readonly roleLabel = computed(
		() => PROFILE_ROLES.find((role) => role.value === this.profiles.profile()?.role)?.label ?? '',
	);
	protected readonly links = computed(() => {
		const profile = this.profiles.profile();

		return profile
			? [
					{ label: 'Портфоліо', url: profile.portfolio, icon: 'language' },
					{ label: 'Instagram', url: profile.instagram, icon: 'photo_camera' },
					{ label: 'Behance', url: profile.behance, icon: 'palette' },
					{ label: 'ArtStation', url: profile.artstation, icon: 'brush' },
				].filter((link) => !!link.url)
			: [];
	});
	/** Real numbers only: what this user has uploaded, created and saved. */
	protected readonly stats = computed(() => [
		{ tab: 'models' as Tab, label: 'Моделей', value: this.userModels.count(), icon: 'view_in_ar' },
		{ tab: 'collections' as Tab, label: 'Колекцій', value: this.collections.mine().length, icon: 'collections_bookmark' },
		{ tab: 'favorites' as Tab, label: 'Збережено', value: this.favorites.count(), icon: 'favorite' },
	]);
	/** Latest real actions: uploaded models and created collections, newest first. */
	protected readonly activity = computed(() =>
		[
			...this.userModels.models().map((model) => ({
				icon: 'view_in_ar',
				text: `Додано модель «${model.title}»`,
				at: model.createdAt,
				tab: 'models' as Tab,
			})),
			...this.collections.mine().map((collection) => ({
				icon: 'collections_bookmark',
				text: `Створено колекцію «${collection.title}»`,
				at: collection.createdAt,
				tab: 'collections' as Tab,
			})),
		]
			.sort((a, b) => b.at - a.at)
			.slice(0, 6)
			.map((item) => ({ ...item, date: DATE.format(item.at) })),
	);

	protected setTab(tab: Tab) {
		void this._router.navigate([], {
			relativeTo: this._route,
			queryParams: { tab: tab === 'overview' ? null : tab },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}

	protected edit() {
		this._editor().open();
	}

	/** Picks a photo or cover and shows it as a preview; nothing is uploaded until it is confirmed. */
	protected pick(kind: ImageKind, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		input.value = '';

		if (!file) {
			return;
		}

		const problem = checkImage(file);

		if (problem) {
			this.notice.set({ tone: 'error', text: PROFILE_ERRORS[problem] });
			return;
		}

		this.notice.set(null);
		this._pending(kind).update((previous) => {
			if (previous) {
				URL.revokeObjectURL(previous.url);
			}

			return { file, url: URL.createObjectURL(file) };
		});
	}

	protected cancelPending(kind: ImageKind) {
		const pending = this._pending(kind);

		if (pending()) {
			URL.revokeObjectURL(pending()!.url);
		}

		pending.set(null);
	}

	protected async savePending(kind: ImageKind) {
		const pending = this._pending(kind)();

		if (!pending) {
			return;
		}

		// A public profile needs a nickname first: continue in the edit form with this picture attached.
		if (!this.profiles.hasProfile()) {
			this.cancelPending(kind);
			this.notice.set({ tone: 'ok', text: 'Оберіть нікнейм і натисніть «Зберегти»: фото збережеться разом з профілем.' });
			this._editor().open({ [kind]: pending.file });
			return;
		}

		const saved = await this._setImage(kind, pending.file, kind === 'avatar' ? 'Фото профілю оновлено.' : 'Обкладинку оновлено.');

		if (saved) {
			this.cancelPending(kind);
		}
	}

	protected async removeCover() {
		await this._setImage('cover', 'remove', 'Обкладинку видалено.');
	}

	protected onLoggedOut() {
		this.notice.set(null);
	}

	private _pending(kind: ImageKind) {
		return kind === 'avatar' ? this.pendingAvatar : this.pendingCover;
	}

	private async _setImage(kind: ImageKind, change: File | 'remove', success: string): Promise<boolean> {
		this.uploading.set(kind);
		this.notice.set(null);
		const result = await this.profiles.setImage(kind, change);
		this.uploading.set('');
		this.notice.set(result === 'ok' ? { tone: 'ok', text: success } : { tone: 'error', text: PROFILE_ERRORS[result] });

		return result === 'ok';
	}
}

function _tab(value: string | null): Tab {
	return TABS.some((tab) => tab.id === value) ? (value as Tab) : 'overview';
}
