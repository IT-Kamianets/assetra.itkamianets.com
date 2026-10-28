import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../cart/cart.service';
import { FavoritesService } from '../../favorites/favorites.service';
import { formatModelSummary, formatPrice, getCategory, getSeller, imageUrl } from '../catalog.data';
import { Product } from '../catalog.interface';

@Component({
	selector: 'app-product-card',
	imports: [RouterLink],
	template: `
		<a
			class="theme-focus group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--c-border)] bg-[var(--c-bg-secondary)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[var(--c-primary-hover)] hover:shadow-[var(--shadow-md)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
			[routerLink]="['/product', product().slug]"
		>
			<div class="relative aspect-square overflow-hidden bg-[var(--c-bg-tertiary)]">
				<img
					class="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
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
						class="absolute inset-0 h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-500 group-hover:scale-[1.04] group-hover:opacity-100 motion-reduce:transition-none"
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
						<span class="rounded-full bg-[var(--c-premium)] px-2.5 py-1 text-xs font-semibold text-[var(--c-on-premium)]">Нове</span>
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
				<h3 class="text-base font-semibold leading-snug text-[var(--c-text-strong)] group-hover:text-[var(--c-link)]">
					{{ product().title }}
				</h3>
				<p class="truncate text-xs text-[var(--c-text-muted)]">від {{ sellerName() }}</p>
				<p class="text-sm text-[var(--c-text-muted)]">{{ summary() }}</p>
				<div class="mt-auto flex items-end justify-between gap-3 pt-2">
					<span class="text-xl font-bold text-[var(--c-text-strong)]">{{ price() }}</span>
					<span class="text-right text-xs text-[var(--c-text-muted)]">{{ software() }}</span>
				</div>
			</div>
		</a>

		<button
			class="theme-interactive theme-focus absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-[var(--shadow-sm)]"
			[class]="inCart() ? 'bg-[var(--c-primary)] text-[var(--c-on-primary)]' : 'bg-[var(--c-bg-secondary)]/90 text-[var(--c-text-strong)] hover:bg-[var(--c-bg-secondary)]'"
			type="button"
			[attr.aria-pressed]="inCart()"
			[attr.aria-label]="(inCart() ? 'Прибрати з кошика: ' : 'Додати в кошик: ') + product().title"
			(click)="cart.toggle(product().slug)"
		>
			<span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ inCart() ? 'check' : 'add_shopping_cart' }}</span>
		</button>

		<button
			class="theme-interactive theme-focus absolute right-3 top-14 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--c-bg-secondary)]/90 shadow-[var(--shadow-sm)] hover:bg-[var(--c-bg-secondary)]"
			[class]="isFavorite() ? 'text-[var(--c-danger)]' : 'text-[var(--c-text-strong)]'"
			type="button"
			[attr.aria-pressed]="isFavorite()"
			[attr.aria-label]="(isFavorite() ? 'Прибрати з обраного: ' : 'Додати в обране: ') + product().title"
			(click)="favorites.toggle(product().slug)"
		>
			<span class="material-symbols-outlined text-[20px]" [class.icon-filled]="isFavorite()" aria-hidden="true">favorite</span>
		</button>
	`,
	host: { class: 'relative block h-full' },
})
export class ProductCardComponent {
	readonly product = input.required<Product>();

	protected readonly cart = inject(CartService);
	protected readonly inCart = computed(() => this.cart.has(this.product().slug));
	protected readonly favorites = inject(FavoritesService);
	protected readonly isFavorite = computed(() => this.favorites.has(this.product().slug));

	protected readonly mainImage = computed(() => imageUrl(this.product().images[0]!, 600));
	protected readonly hoverImage = computed(() => {
		const second = this.product().images[1];

		return second ? imageUrl(second, 600) : '';
	});
	protected readonly categoryTitle = computed(() => getCategory(this.product().category)?.title ?? '');
	protected readonly sellerName = computed(() => getSeller(this.product().seller)?.name ?? '');
	protected readonly summary = computed(() => formatModelSummary(this.product()));
	protected readonly price = computed(() => formatPrice(this.product().price));
	protected readonly software = computed(() => this.product().formats.join(' · '));
}
