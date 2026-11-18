import { afterNextRender, Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, input, signal, viewChild } from '@angular/core';
import { TextureVariant } from '../catalog.interface';

/** The slice of the <model-viewer> element used to swap textures and colours. */
interface ViewerTexture {
	texture: unknown;
	setTexture(texture: unknown): void;
}
interface ViewerMaterial {
	pbrMetallicRoughness: {
		baseColorFactor: number[];
		baseColorTexture: ViewerTexture;
		setBaseColorFactor(color: number[] | string): void;
	};
}
interface ViewerElement extends HTMLElement {
	loaded: boolean;
	model?: { materials: ViewerMaterial[] };
	createTexture(url: string): Promise<unknown>;
}

/** Interactive GLB preview. `<model-viewer>` is browser-only, so it is imported after the first render. */
@Component({
	selector: 'app-model-viewer',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		@if (ready()) {
			<model-viewer
				#viewer
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
	/** Texture choice to show on the model; null keeps the textures of the GLB file. */
	readonly variant = input<TextureVariant | null>(null);

	protected readonly ready = signal(false);
	private readonly _viewer = viewChild<ElementRef<ViewerElement>>('viewer');
	private readonly _originals = new Map<ViewerMaterial, { texture: unknown; color: number[] }>();

	constructor() {
		afterNextRender(() => {
			void import('@google/model-viewer').then(() => this.ready.set(true));
		});

		effect(() => {
			const element = this._viewer()?.nativeElement;
			const variant = this.variant();

			if (element) {
				void this._apply(element, variant);
			}
		});
	}

	private async _apply(element: ViewerElement, variant: TextureVariant | null) {
		if (!element.loaded) {
			await new Promise((resolve) => element.addEventListener('load', resolve, { once: true }));
		}

		const materials = element.model?.materials ?? [];
		const texture = variant?.texture ? await element.createTexture(variant.texture) : null;

		for (const material of materials) {
			const pbr = material.pbrMetallicRoughness;

			if (!this._originals.has(material)) {
				this._originals.set(material, { texture: pbr.baseColorTexture.texture, color: [...pbr.baseColorFactor] });
			}

			const original = this._originals.get(material)!;

			pbr.baseColorTexture.setTexture(texture ?? original.texture);
			pbr.setBaseColorFactor(variant?.color || original.color);
		}
	}
}
