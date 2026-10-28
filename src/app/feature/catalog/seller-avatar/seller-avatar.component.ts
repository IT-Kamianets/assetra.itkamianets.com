import { Component, computed, input } from '@angular/core';
import { sellerInitials } from '../catalog.data';
import { Seller } from '../catalog.interface';

/** Round initials badge in the seller's brand colour. */
@Component({
	selector: 'app-seller-avatar',
	template: `{{ initials() }}`,
	host: {
		class:
			'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-[#f3f0e7] select-none',
		// Brand colour deepened with graphite so the ivory initials always keep enough contrast.
		'[style.background-color]': "'color-mix(in srgb, ' + seller().color + ' 60%, #141612)'",
		'[style.width.px]': 'size()',
		'[style.height.px]': 'size()',
		'[style.font-size.px]': 'size() * 0.36',
		'aria-hidden': 'true',
	},
})
export class SellerAvatarComponent {
	readonly seller = input.required<Seller>();
	readonly size = input(40);

	protected readonly initials = computed(() => sellerInitials(this.seller()));
}

