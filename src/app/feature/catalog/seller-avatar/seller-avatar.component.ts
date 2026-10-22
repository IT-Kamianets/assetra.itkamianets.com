import { Component, computed, input } from '@angular/core';
import { sellerInitials } from '../catalog.data';
import { Seller } from '../catalog.interface';

/** Round initials badge in the seller's brand colour. */
@Component({
	selector: 'app-seller-avatar',
	template: `{{ initials() }}`,
	host: {
		class:
			'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-[#f7f5ef] select-none',
		'[style.background-color]': 'seller().color',
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
