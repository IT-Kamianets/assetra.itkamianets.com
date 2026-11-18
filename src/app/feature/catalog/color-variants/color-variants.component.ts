import { Component, model } from '@angular/core';
import { TextureVariant } from '../catalog.interface';
import { MAX_TEXTURE_VARIANTS } from '../texture-variants';

/** Optional colour choices of a model: rows of a name and a colour, shown to buyers as swatches. */
@Component({
	selector: 'app-color-variants',
	template: `
		<fieldset class="grid gap-3">
			<legend class="mb-1 block text-sm font-semibold text-[var(--c-text-strong)]">
				Варіанти кольору <span class="font-normal text-[var(--c-text-muted)]">(необов'язково)</span>
			</legend>
			<p class="text-sm text-[var(--c-text-muted)]">
				Додайте кольори, між якими покупець зможе перемикати модель. Якщо не потрібно, залиште порожнім.
			</p>

			@for (item of variants(); track $index; let index = $index) {
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
	readonly variants = model<TextureVariant[]>([]);

	protected readonly max = MAX_TEXTURE_VARIANTS;

	protected add() {
		this.variants.update((list) => [...list, { name: '', color: '#c0392b' }]);
	}

	protected remove(index: number) {
		this.variants.update((list) => list.filter((_, i) => i !== index));
	}

	protected update(index: number, patch: Partial<TextureVariant>) {
		this.variants.update((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
	}
}
