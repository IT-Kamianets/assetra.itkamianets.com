import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { categories } from '../../../feature/catalog/catalog.data';
import {
	MAX_IMAGE_MB,
	MAX_MODEL_MB,
	UploadResult,
	UserModel,
	UserModelsService,
} from '../../../feature/user-models/user-models.service';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const ERRORS: Record<Exclude<UploadResult, 'ok'>, string> = {
	'too-large': `Файл завеликий: модель до ${MAX_MODEL_MB} МБ, прев'ю до ${MAX_IMAGE_MB} МБ.`,
	'bad-file': "Оберіть модель у форматі .glb і прев'ю-зображення (JPG, PNG або WebP).",
	storage: 'Не вдалося завантажити файл у сховище. Спробуйте ще раз трохи пізніше.',
	database: 'Файл завантажено, але не вдалося зберегти модель у профілі. Спробуйте ще раз.',
	'signed-out': 'Увійдіть в акаунт, щоб додавати моделі.',
};

/** "My models" in the profile: upload form plus the list of the user's own models. */
@Component({
	selector: 'app-my-models',
	imports: [ReactiveFormsModule],
	templateUrl: './my-models.component.html',
})
export class MyModelsComponent {
	protected readonly userModels = inject(UserModelsService);
	private readonly _fb = inject(NonNullableFormBuilder);

	protected readonly categories = categories;
	protected readonly maxModelMb = MAX_MODEL_MB;
	protected readonly maxImageMb = MAX_IMAGE_MB;
	protected readonly form = this._fb.group({
		title: this._fb.control('', [Validators.required, Validators.maxLength(120)]),
		category: this._fb.control(categories[0]?.slug ?? '', Validators.required),
		description: this._fb.control('', Validators.maxLength(2000)),
	});
	protected readonly modelFile = signal<File | null>(null);
	protected readonly imageFile = signal<File | null>(null);
	protected readonly fileTouched = signal(false);
	protected readonly formOpen = signal(false);
	protected readonly sending = signal(false);
	protected readonly removing = signal('');
	protected readonly notice = signal<Notice>(null);

	protected showError(control: 'title'): boolean {
		const field = this.form.controls[control];

		return field.invalid && (field.touched || field.dirty);
	}

	protected pickFile(event: Event, kind: 'model' | 'image') {
		const file = (event.target as HTMLInputElement).files?.[0] ?? null;

		(kind === 'model' ? this.modelFile : this.imageFile).set(file);
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

		const result = await this.userModels.add({ ...this.form.getRawValue(), model, image: this.imageFile() });

		this.sending.set(false);

		if (result !== 'ok') {
			this.notice.set({ tone: 'error', text: ERRORS[result] });
			return;
		}

		this.notice.set({ tone: 'ok', text: 'Модель додано до вашого профілю.' });
		this.form.reset();
		this.modelFile.set(null);
		this.imageFile.set(null);
		this.fileTouched.set(false);
		fileInputs.forEach((input) => (input.value = ''));
		this.formOpen.set(false);
	}

	protected async remove(model: UserModel) {
		if (!confirm(`Видалити модель «${model.title}»?`)) {
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
