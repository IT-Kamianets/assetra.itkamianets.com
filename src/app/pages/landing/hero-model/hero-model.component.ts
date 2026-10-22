import { afterNextRender, Component, CUSTOM_ELEMENTS_SCHEMA, input, output, signal } from '@angular/core';

/**
 * Slowly turning 3D model for the home hero. Browser-only: `<model-viewer>` is imported after the
 * first render and only shown once the GLB has loaded, so the static render stays as the poster.
 */
@Component({
	selector: 'app-hero-model',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		@if (ready()) {
			<model-viewer
				class="block h-full w-full"
				[attr.src]="src()"
				[attr.alt]="alt()"
				[attr.auto-rotate]="reduceMotion ? null : ''"
				[attr.camera-orbit]="orbit()"
				auto-rotate-delay="0"
				rotation-per-second="10deg"
				camera-controls
				disable-zoom
				disable-pan
				interaction-prompt="none"
				touch-action="pan-y"
				environment-image="neutral"
				shadow-intensity="1.4"
				shadow-softness="0.7"
				exposure="1.15"
				field-of-view="22deg"
				(load)="loaded.emit()"
			></model-viewer>
		}
	`,
	host: { class: 'block' },
	styles: `
		model-viewer {
			--poster-color: transparent;
			background: transparent;
			cursor: grab;
		}

		model-viewer:active {
			cursor: grabbing;
		}
	`,
})
export class HeroModelComponent {
	readonly src = input.required<string>();
	readonly alt = input('');
	readonly orbit = input('325deg 80deg auto');
	readonly loaded = output();

	protected readonly ready = signal(false);
	protected reduceMotion = false;

	constructor() {
		afterNextRender(() => {
			this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			void import('@google/model-viewer').then(() => this.ready.set(true));
		});
	}
}
