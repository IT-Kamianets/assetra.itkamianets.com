import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDimensions, formatPrice, getCategory, imageUrl } from '../catalog.data';
import { Product } from '../catalog.interface';

@Component({
	selector: 'app-product-card',
	imports: [RouterLink],
	template: `
		<a
			class="theme-focus group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--c-border)] bg-[var(--c-bg-secondary)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]"
			[routerLink]="['/product', product().slug]"
		>
			<div class="relative aspect-square overflow-hidden bg-[var(--c-bg-tertiary)]">
				<img
					class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
					[class.group-hover:opacity-0]="hoverImage()"
					[src]="mainImage()"
					[alt]="product().title"
					width="600"
					height="600"
					loading="lazy"
					decoding="async"
				/>
				@if (hoverImage(); as hover) {
					<img
						class="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
						[src]="hover"
						alt=""
						width="600"
						height="600"
						loading="lazy"
						decoding="async"
					/>
				}

				<div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
					@if (product().isNew) {
						<span class="rounded-full bg-[var(--c-accent)] px-2.5 py-1 text-xs font-semibold text-[#2f3328]">Нове</span>
					}
					@if (product().isHit) {
						<span class="rounded-full bg-[var(--c-text-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--c-bg-secondary)]">Хіт</span>
					}
					@if (product().model) {
						<span class="rounded-full bg-[var(--c-bg-secondary)]/90 px-2.5 py-1 text-xs font-semibold text-[var(--c-text-strong)]">3D</span>
					}
				</div>
			</div>

			<div class="flex flex-1 flex-col gap-2 p-4">
				<p class="text-xs font-medium uppercase tracking-[0.14em] text-[var(--c-text-muted)]">
					{{ categoryTitle() }}
				</p>
				<h3 class="text-base font-semibold leading-snug text-[var(--c-text-strong)] group-hover:text-[var(--c-primary)]">
					{{ product().title }}
				</h3>
				<p class="text-sm text-[var(--c-text-muted)]">{{ dimensions() }}</p>
				<div class="mt-auto flex items-end justify-between gap-3 pt-2">
					<span class="text-lg font-semibold text-[var(--c-text-strong)]">{{ price() }}</span>
					<span class="text-right text-xs text-[var(--c-text-muted)]">{{ software() }}</span>
				</div>
			</div>
		</a>
	`,
	host: { class: 'block h-full' },
})
export class ProductCardComponent {
	readonly product = input.required<Product>();

	protected readonly mainImage = computed(() => imageUrl(this.product().images[0]!, 600));
	protected readonly hoverImage = computed(() => {
		const second = this.product().images[1];

		return second ? imageUrl(second, 600) : '';
	});
	protected readonly categoryTitle = computed(() => getCategory(this.product().category)?.title ?? '');
	protected readonly dimensions = computed(() => formatDimensions(this.product()));
	protected readonly price = computed(() => formatPrice(this.product().price));
	protected readonly software = computed(() => this.product().renderers.join(' · '));
}
