import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { categories } from '../../../feature/catalog/catalog.data';
import { TextureVariant } from '../../../feature/catalog/catalog.interface';
import { ColorVariantsComponent } from '../../../feature/catalog/color-variants/color-variants.component';
import {
	MAX_IMAGE_MB,
	MAX_MODEL_MB,
	UploadResult,
	UserModel,
	UserModelsService,
} from '../../../feature/user-models/user-models.service';
import { CollectionsService } from '../../../feature/collections/collections.service';
import { DomTranslatorService } from '../../../feature/i18n/dom-translator.service';
import { ModelThumbnailService } from '../../../feature/projects/model-thumbnail.service';
import { OnVisibleDirective } from '../../../feature/projects/on-visible.directive';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const ERRORS: Record<Exclude<UploadResult, 'ok'>, string> = {
	'too-large': `Файл завеликий: модель до ${MAX_MODEL_MB} МБ, прев'ю до ${MAX_IMAGE_MB} МБ.`,
	'bad-file': "Оберіть модель (і low-poly версію) у форматі .glb та прев'ю-зображення (JPG, PNG або WebP).",
	storage: 'Не вдалося завантажити файл у сховище. Спробуйте ще раз трохи пізніше.',
	database: 'Файл завантажено, але не вдалося зберегти модель у профілі. Спробуйте ще раз.',
	'signed-out': 'Увійдіть в акаунт, щоб додавати моделі.',
};

/** "My models" in the profile: upload form plus the list of the user's own models. */
@Component({
	selector: 'app-my-models',
	imports: [ReactiveFormsModule, OnVisibleDirective, ColorVariantsComponent],
	templateUrl: './my-models.component.html',
})
export class MyModelsComponent {
	protected readonly userModels = inject(UserModelsService);
	protected readonly collections = inject(CollectionsService);
	protected readonly thumbs = inject(ModelThumbnailService);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _translator = inject(DomTranslatorService);

	protected readonly categories = categories;
	protected readonly maxModelMb = MAX_MODEL_MB;
	protected readonly maxImageMb = MAX_IMAGE_MB;
	protected readonly form = this._fb.group({
		title: this._fb.control('', [Validators.required, Validators.maxLength(120)]),
		category: this._fb.control(categories[0]?.slug ?? '', Validators.required),
		description: this._fb.control('', Validators.maxLength(2000)),
		collectionId: this._fb.control(''),
	});
	protected readonly modelFile = signal<File | null>(null);
	protected readonly lowModelFile = signal<File | null>(null);
	protected readonly imageFile = signal<File | null>(null);
	protected readonly fileTouched = signal(false);
	/** Colour choices of the model being uploaded. */
	protected readonly newVariants = signal<TextureVariant[]>([]);
	/** Card whose colours are being edited, with the edited list. */
	protected readonly colorEditId = signal('');
	protected readonly editVariants = signal<TextureVariant[]>([]);
	protected readonly savingColors = signal(false);
	protected readonly formOpen = signal(false);
	protected readonly sending = signal(false);
	protected readonly removing = signal('');
	protected readonly moving = signal('');
	protected readonly imaging = signal('');
	protected readonly notice = signal<Notice>(null);

	protected showError(control: 'title'): boolean {
		const field = this.form.controls[control];

		return field.invalid && (field.touched || field.dirty);
	}

	protected pickFile(event: Event, kind: 'model' | 'lowModel' | 'image') {
		const file = (event.target as HTMLInputElement).files?.[0] ?? null;

		(kind === 'model' ? this.modelFile : kind === 'lowModel' ? this.lowModelFile : this.imageFile).set(file);
	}

	protected categoryTitle(slug: string): string {
		return categories.find((category) => category.slug === slug)?.title ?? '';
	}

	protected formatSize(bytes: number): string {
		return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
	}

	protected async submit(fileInputs: HTMLInputElement[]) {
		this.fileTouched.set(true);

		const model = this.modelFile();

		if (this.form.invalid || !model) {
			this.form.markAllAsTouched();
			return;
		}

		this.sending.set(true);
		this.notice.set(null);

		const result = await this.userModels.add({ ...this.form.getRawValue(), model, lowModel: this.lowModelFile(), image: this.imageFile(), textureVariants: this.newVariants() });

		this.sending.set(false);

		if (result !== 'ok') {
			this.notice.set({ tone: 'error', text: ERRORS[result] });
			return;
		}

		this.notice.set({ tone: 'ok', text: 'Модель додано до вашого профілю.' });
		this.form.reset();
		this.modelFile.set(null);
		this.lowModelFile.set(null);
		this.imageFile.set(null);
		this.newVariants.set([]);
		this.fileTouched.set(false);
		fileInputs.forEach((input) => (input.value = ''));
		this.formOpen.set(false);
	}

	protected async moveToCollection(model: UserModel, collection: string) {
		this.moving.set(model.id);
		const moved = await this.userModels.setCollection(model, collection);
		this.moving.set('');

		if (!moved) {
			this.notice.set({ tone: 'error', text: 'Не вдалося змінити колекцію моделі. Спробуйте ще раз.' });
		}
	}

	protected editColors(model: UserModel) {
		this.editVariants.set(structuredClone(model.textureVariants ?? []));
		this.colorEditId.set(model.id);
	}

	protected async saveColors(model: UserModel) {
		this.savingColors.set(true);
		const saved = await this.userModels.setTextureVariants(model, this.editVariants());
		this.savingColors.set(false);

		if (saved) {
			this.colorEditId.set('');
		} else {
			this.notice.set({ tone: 'error', text: 'Не вдалося зберегти кольори. Спробуйте ще раз; якщо помилка повторюється, правила бази даних ще не оновлені.' });
		}
	}

	protected async changeImage(model: UserModel, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}

		this.imaging.set(model.id);
		const result = await this.userModels.setImage(model, file);
		this.imaging.set('');
		input.value = '';

		if (result !== 'ok') {
			this.notice.set({ tone: 'error', text: ERRORS[result] });
		}
	}

	protected async remove(model: UserModel) {
		if (!confirm(this._translator.translate(`Видалити модель «${model.title}»?`))) {
			return;
		}

		this.removing.set(model.id);
		const removed = await this.userModels.remove(model);
		this.removing.set('');

		if (!removed) {
			this.notice.set({ tone: 'error', text: 'Не вдалося видалити модель. Спробуйте ще раз.' });
		}
	}
}
