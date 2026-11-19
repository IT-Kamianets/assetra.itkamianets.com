import { Component, model } from '@angular/core';
import { MAX_MODEL_MB } from '../../user-models/user-models.service';
import { ColorVariantRow, MAX_TEXTURE_VARIANTS } from '../texture-variants';

/**
 * Optional colour choices of a model. Each colour is a name and a swatch colour, and can come with its
 * own GLB file (the same model in that colour): buyers then see that file when they pick the colour.
 */
@Component({
	selector: 'app-color-variants',
	template: `
		<fieldset class="grid gap-3">
			<legend class="mb-1 block text-sm font-semibold text-[var(--c-text-strong)]">
				Варіанти кольору <span class="font-normal text-[var(--c-text-muted)]">(необов'язково)</span>
			</legend>
			<p class="text-sm text-[var(--c-text-muted)]">
				Додайте кольори, між якими покупець зможе перемикати модель. Для кожного кольору можна завантажити свій файл GLB
				(та сама модель в іншому кольорі). Якщо не потрібно, залиште порожнім.
			</p>

			@for (item of variants(); track $index; let index = $index) {
				<div class="grid gap-2 rounded-[var(--radius-btn)] border border-[var(--c-border)] p-2.5">
					<div class="flex items-center gap-2">
						<input
							class="h-11 w-14 shrink-0 cursor-pointer rounded-[var(--radius-btn)] border border-[var(--c-border)] bg-[var(--c-bg-secondary)] p-1"
							type="color"
							[value]="item.color"
							[attr.aria-label]="'Колір ' + (index + 1)"
							(input)="update(index, { color: $any($event.target).value })"
						/>
						<input
							class="theme-focus h-11 min-w-0 flex-1 rounded-[var(--radius-btn)] border border-[var(--c-border)] bg-[var(--c-bg-secondary)] px-3 text-[var(--c-text-strong)]"
							type="text"
							maxlength="30"
							placeholder="Назва кольору"
							[value]="item.name"
							[attr.aria-label]="'Назва кольору ' + (index + 1)"
							(input)="update(index, { name: $any($event.target).value })"
						/>
						<button
							class="theme-interactive theme-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--c-text-muted)] hover:bg-[var(--c-bg-tertiary)] hover:text-[var(--c-danger)]"
							type="button"
							[attr.aria-label]="'Прибрати колір ' + (index + 1)"
							(click)="remove(index)"
						>
							<span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
						</button>
					</div>
					<label class="grid gap-1 text-xs font-semibold text-[var(--c-text-muted)]">
						Файл GLB цього кольору
						<input
							class="theme-focus block w-full rounded-[var(--radius-btn)] border border-[var(--c-border)] bg-[var(--c-bg-secondary)] p-1.5 text-sm font-normal text-[var(--c-text-strong)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--c-bg-tertiary)] file:px-3 file:py-1 file:font-semibold file:text-[var(--c-text-strong)]"
							type="file"
							accept=".glb,model/gltf-binary"
							[attr.aria-label]="'Файл GLB кольору ' + (index + 1)"
							(change)="pickFile(index, $event)"
						/>
						@if (item.file) {
							<span class="font-normal">Буде завантажено: {{ item.file.name }}</span>
						} @else if (item.model) {
							<span class="font-normal">Файл вже додано. Оберіть новий, щоб замінити.</span>
						} @else {
							<span class="font-normal">Необов'язково, до {{ maxMb }} МБ.</span>
						}
					</label>
				</div>
			}

			@if (variants().length < max) {
				<button
					class="theme-interactive theme-focus inline-flex min-h-11 items-center gap-2 justify-self-start rounded-[var(--radius-btn)] border border-[var(--c-border)] px-4 font-semibold text-[var(--c-text-strong)] hover:border-[var(--c-primary)]"
					type="button"
					(click)="add()"
				>
					<span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
					Додати колір
				</button>
			}
		</fieldset>
	`,
})
export class ColorVariantsComponent {
	readonly variants = model<ColorVariantRow[]>([]);

	protected readonly max = MAX_TEXTURE_VARIANTS;
	protected readonly maxMb = MAX_MODEL_MB;

	protected add() {
		this.variants.update((list) => [...list, { name: '', color: '#c0392b' }]);
	}

	protected remove(index: number) {
		this.variants.update((list) => list.filter((_, i) => i !== index));
	}

	protected update(index: number, patch: Partial<ColorVariantRow>) {
		this.variants.update((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
	}

	protected pickFile(index: number, event: Event) {
		const input = event.target as HTMLInputElement;

		this.update(index, { file: input.files?.[0] ?? null });
	}
}
