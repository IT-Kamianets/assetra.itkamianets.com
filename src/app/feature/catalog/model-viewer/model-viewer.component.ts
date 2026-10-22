import { afterNextRender, Component, CUSTOM_ELEMENTS_SCHEMA, input, signal } from '@angular/core';

/** Interactive GLB preview. `<model-viewer>` is browser-only, so it is imported after the first render. */
@Component({
	selector: 'app-model-viewer',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		@if (ready()) {
			<model-viewer
				class="block h-full w-full"
				[attr.src]="src()"
				[attr.alt]="alt()"
				[attr.poster]="poster()"
				camera-controls
				auto-rotate
				touch-action="pan-y"
				shadow-intensity="1"
				exposure="1"
				environment-image="neutral"
			></model-viewer>
		} @else {
			<div class="flex h-full w-full items-center justify-center text-sm text-[var(--c-text-muted)]">
				Завантаження 3D-моделі…
			</div>
		}
	`,
	host: { class: 'block h-full w-full' },
})
export class ModelViewerComponent {
	readonly src = input.required<string>();
	readonly alt = input('');
	readonly poster = input('');

	protected readonly ready = signal(false);

	constructor() {
		afterNextRender(() => {
			void import('@google/model-viewer').then(() => this.ready.set(true));
		});
	}
}
