import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';
import { ACCEPT_ATTR, checkImage, ImageKind, MAX_SOURCE_MB } from '../../../feature/profile/image-prepare';
import {
	BIO_MAX,
	ImageChange,
	NICKNAME_PATTERN,
	NicknameStatus,
	PROFILE_ERRORS,
	PROFILE_ROLES,
	ProfileService,
} from '../../../feature/profile/profile.service';

type Field = 'nickname' | 'name' | 'bio' | 'city' | 'portfolio' | 'instagram' | 'behance' | 'artstation';
type Notice = { tone: 'ok' | 'error'; text: string } | null;
type NickState = 'idle' | 'checking' | NicknameStatus;

/** Optional link: empty, or a full http(s) address. */
function urlOrEmpty(control: AbstractControl<string>): ValidationErrors | null {
	const value = control.value.trim();

	if (!value) {
		return null;
	}

	try {
		const url = new URL(value);

		return url.protocol === 'http:' || url.protocol === 'https:' ? null : { url: true };
	} catch {
		return { url: true };
	}
}

/** Modal form for editing the public profile: photo, cover, nickname, bio, role, city and links. */
@Component({
	selector: 'app-profile-edit',
	imports: [ReactiveFormsModule],
	templateUrl: './profile-edit.component.html',
})
export class ProfileEditComponent {
	protected readonly profiles = inject(ProfileService);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _destroyRef = inject(DestroyRef);
	private readonly _dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

	protected readonly roles = PROFILE_ROLES;
	protected readonly bioMax = BIO_MAX;
	protected readonly accept = ACCEPT_ATTR;
	protected readonly maxMb = MAX_SOURCE_MB;
	protected readonly form = this._fb.group({
		nickname: this._fb.control('', [Validators.required, Validators.pattern(NICKNAME_PATTERN)]),
		name: this._fb.control('', Validators.maxLength(60)),
		bio: this._fb.control('', Validators.maxLength(BIO_MAX)),
		role: this._fb.control('3d-artist'),
		city: this._fb.control('', Validators.maxLength(60)),
		portfolio: this._fb.control('', [urlOrEmpty, Validators.maxLength(300)]),
		instagram: this._fb.control('', [urlOrEmpty, Validators.maxLength(300)]),
		behance: this._fb.control('', [urlOrEmpty, Validators.maxLength(300)]),
		artstation: this._fb.control('', [urlOrEmpty, Validators.maxLength(300)]),
	});
	protected readonly nickState = signal<NickState>('idle');
	protected readonly avatarChange = signal<ImageChange>(null);
	protected readonly coverChange = signal<ImageChange>(null);
	protected readonly avatarPreview = signal('');
	protected readonly coverPreview = signal('');
	protected readonly imageError = signal('');
	protected readonly saving = signal(false);
	protected readonly saved = signal(false);
	protected readonly notice = signal<Notice>(null);

	constructor() {
		this.form.controls.nickname.valueChanges
			.pipe(
				tap(() => this.nickState.set('idle')),
				debounceTime(450),
				distinctUntilChanged(),
				filter(() => this.form.controls.nickname.valid),
				tap(() => this.nickState.set('checking')),
				switchMap((nickname) => this.profiles.checkNickname(nickname)),
				takeUntilDestroyed(this._destroyRef),
			)
			.subscribe((status) => this.nickState.set(status));
	}

	/** `initial` carries a picture the visitor already picked on the header, so it is saved together with the nickname. */
	open(initial: Partial<Record<ImageKind, File>> = {}) {
		const profile = this.profiles.profile();

		this.form.reset({
			nickname: profile?.nickname ?? '',
			name: profile?.name ?? '',
			bio: profile?.bio ?? '',
			role: profile?.role || '3d-artist',
			city: profile?.city ?? '',
			portfolio: profile?.portfolio ?? '',
			instagram: profile?.instagram ?? '',
			behance: profile?.behance ?? '',
			artstation: profile?.artstation ?? '',
		});
		this._releasePreviews();
		this.avatarChange.set(null);
		this.coverChange.set(null);
		this.avatarPreview.set(profile?.avatarUrl ?? '');
		this.coverPreview.set(profile?.coverUrl ?? '');
		this.nickState.set('idle');
		this.imageError.set('');
		this.notice.set(null);
		this.saved.set(false);

		for (const kind of ['avatar', 'cover'] as const) {
			const file = initial[kind];

			if (file) {
				(kind === 'avatar' ? this.avatarChange : this.coverChange).set(file);
				(kind === 'avatar' ? this.avatarPreview : this.coverPreview).set(URL.createObjectURL(file));
			}
		}

		if (!this._dialog().nativeElement.open) {
			this._dialog().nativeElement.showModal();
		}
	}

	protected close() {
		this._releasePreviews();
		this._dialog().nativeElement.close();
	}

	protected onBackdrop(event: MouseEvent) {
		// A click on the <dialog> element itself (not its content) is a click on the backdrop.
		if (event.target === this._dialog().nativeElement) {
			this.close();
		}
	}

	protected pick(kind: ImageKind, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		input.value = '';

		if (!file) {
			return;
		}

		const problem = checkImage(file);

		if (problem) {
			this.imageError.set(PROFILE_ERRORS[problem]);
			return;
		}

		this.imageError.set('');
		this._releasePreview(kind);
		(kind === 'avatar' ? this.avatarChange : this.coverChange).set(file);
		(kind === 'avatar' ? this.avatarPreview : this.coverPreview).set(URL.createObjectURL(file));
	}

	protected remove(kind: ImageKind) {
		this._releasePreview(kind);
		(kind === 'avatar' ? this.avatarChange : this.coverChange).set('remove');
		(kind === 'avatar' ? this.avatarPreview : this.coverPreview).set('');
	}

	protected showError(control: Field): boolean {
		const field = this.form.controls[control];

		return field.invalid && (field.touched || field.dirty);
	}

	protected async save() {
		this.notice.set(null);

		if (this.form.invalid || this.nickState() === 'taken') {
			this.form.markAllAsTouched();
			this.notice.set({
				tone: 'error',
				text: this.form.controls.nickname.invalid
					? 'Оберіть нікнейм: 3–20 латинських літер, цифр або «_».'
					: this.nickState() === 'taken'
						? PROFILE_ERRORS.taken
						: 'Перевірте виділені поля форми.',
			});
			// Jump to the first field with a problem; the form is long and the field may be off screen.
			setTimeout(() => {
				const field = this._dialog().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');

				field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
				field?.focus({ preventScroll: true });
			});
			return;
		}

		this.saving.set(true);
		const result = await this.profiles.save({
			...this.form.getRawValue(),
			avatar: this.avatarChange(),
			cover: this.coverChange(),
		});
		this.saving.set(false);

		if (result !== 'ok') {
			if (result === 'taken') {
				this.nickState.set('taken');
			}

			this.notice.set({ tone: 'error', text: PROFILE_ERRORS[result] });
			return;
		}

		this.saved.set(true);
		this.notice.set({ tone: 'ok', text: 'Зміни збережено.' });
		setTimeout(() => this.saved() && this.close(), 1100);
	}

	private _releasePreviews() {
		this._releasePreview('avatar');
		this._releasePreview('cover');
	}

	private _releasePreview(kind: ImageKind) {
		const preview = (kind === 'avatar' ? this.avatarPreview : this.coverPreview)();

		if (preview.startsWith('blob:')) {
			URL.revokeObjectURL(preview);
		}
	}
}
