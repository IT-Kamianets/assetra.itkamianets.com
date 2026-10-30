import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MAX_IMAGE_MB, UserModelsService } from '../../../feature/user-models/user-models.service';
import { ModelCollection, CollectionResult, CollectionsService } from '../../../feature/collections/collections.service';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const ERRORS: Record<Exclude<CollectionResult, 'ok'>, string> = {
	'too-large': `Обкладинка завелика: до ${MAX_IMAGE_MB} МБ.`,
	'bad-file': 'Обкладинка має бути зображенням (JPG, PNG або WebP).',
	storage: 'Не вдалося завантажити обкладинку. Спробуйте ще раз трохи пізніше.',
	database: 'Не вдалося зберегти колекцію. Спробуйте ще раз; якщо помилка повторюється, правила бази даних, ймовірно, ще не оновлені.',
	'signed-out': 'Увійдіть в акаунт, щоб створювати колекції.',
};

/** "My collections" in the profile: themed sets an author groups their models into. */
@Component({
	selector: 'app-my-collections',
	imports: [ReactiveFormsModule, RouterLink],
	templateUrl: './my-collections.component.html',
})
export class MyCollectionsComponent {
	protected readonly collections = inject(CollectionsService);
	private readonly _userModels = inject(UserModelsService);
	private readonly _fb = inject(NonNullableFormBuilder);

	protected readonly maxImageMb = MAX_IMAGE_MB;
	protected readonly form = this._fb.group({
		title: this._fb.control('', [Validators.required, Validators.maxLength(80)]),
		description: this._fb.control('', Validators.maxLength(1000)),
		vroom: this._fb.control(false),
	});
	protected readonly imageFile = signal<File | null>(null);
	/** The collection being edited, or null while the form creates a new one. */
	protected readonly editing = signal<ModelCollection | null>(null);
	protected readonly removeImage = signal(false);
	protected readonly formOpen = signal(false);
	protected readonly sending = signal(false);
	protected readonly removing = signal('');
	protected readonly notice = signal<Notice>(null);

	protected showError(): boolean {
		const field = this.form.controls.title;

		return field.invalid && (field.touched || field.dirty);
	}

	protected startCreate() {
		this.editing.set(null);
		this.removeImage.set(false);
		this.form.reset();
		this.imageFile.set(null);
		this.notice.set(null);
		this.formOpen.set(true);
	}

	protected startEdit(collection: ModelCollection) {
		this.editing.set(collection);
		this.removeImage.set(false);
		this.form.reset({ title: collection.title, description: collection.description, vroom: !!collection.vroom });
		this.imageFile.set(null);
		this.notice.set(null);
		this.formOpen.set(true);
	}

	protected cancel() {
		this.formOpen.set(false);
		this.editing.set(null);
	}

	protected pickImage(event: Event) {
		this.imageFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
	}

	protected modelCount(collection: ModelCollection): number {
		return this._userModels.models().filter((model) => model.collectionId === collection.id).length;
	}

	protected async submit(imageInput: HTMLInputElement) {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		this.sending.set(true);
		this.notice.set(null);

		const editing = this.editing();
		const values = this.form.getRawValue();
		const result = editing
			? await this.collections.update(editing, { ...values, image: this.imageFile() ?? (this.removeImage() ? 'remove' : null) })
			: await this.collections.create({ ...values, image: this.imageFile() });

		this.sending.set(false);

		if (result !== 'ok') {
			this.notice.set({ tone: 'error', text: ERRORS[result] });
			return;
		}

		this.notice.set({
			tone: 'ok',
			text: editing ? 'Зміни збережено.' : 'Колекцію створено. Додавайте до неї моделі в розділі «Мої моделі».',
		});
		this.editing.set(null);
		this.removeImage.set(false);
		this.form.reset();
		this.imageFile.set(null);
		imageInput.value = '';
		this.formOpen.set(false);
	}

	protected async remove(collection: ModelCollection) {
		if (!confirm(`Видалити колекцію «${collection.title}»? Моделі залишаться у вашому профілі, але вже без колекції.`)) {
			return;
		}

		this.removing.set(collection.id);
		await this._userModels.clearCollection(collection.id);
		const removed = await this.collections.remove(collection);
		this.removing.set('');

		if (!removed) {
			this.notice.set({ tone: 'error', text: 'Не вдалося видалити колекцію. Спробуйте ще раз.' });
		}
	}
}
