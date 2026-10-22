import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
	formatPrice,
	getCategory,
	imageUrl,
	matchesSearch,
	products,
} from '../../../feature/catalog/catalog.data';

const SUGGESTION_LIMIT = 5;

/** Product search in the topbar: live suggestions, Enter opens the full catalog results. */
@Component({
	selector: 'app-topbar-search',
	imports: [RouterLink],
	templateUrl: './topbar-search.component.html',
	host: {
		class: 'block md:relative',
		'(focusout)': 'onFocusOut($event)',
		'(keydown.escape)': 'close()',
	},
})
export class TopbarSearchComponent {
	private readonly _router = inject(Router);
	private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly _input = viewChild<ElementRef<HTMLInputElement>>('input');

	protected readonly query = signal('');
	protected readonly focused = signal(false);
	/** Below `md` the field lives in a dropdown panel opened by the search icon. */
	protected readonly mobileOpen = signal(false);

	protected readonly matches = computed(() => {
		const query = this.query().trim();

		return query.length < 2 ? [] : products.filter((product) => matchesSearch(product, query));
	});
	protected readonly suggestions = computed(() =>
		this.matches()
			.slice(0, SUGGESTION_LIMIT)
			.map((product) => ({
				slug: product.slug,
				title: product.title,
				category: getCategory(product.category)?.title ?? '',
				price: formatPrice(product.price),
				thumb: imageUrl(product.images[0]!, 120),
			})),
	);
	protected readonly showResults = computed(() => this.focused() && this.query().trim().length >= 2);

	protected openMobile() {
		this.mobileOpen.set(true);
		setTimeout(() => this._input()?.nativeElement.focus());
	}

	protected submit(event: Event) {
		event.preventDefault();
		const q = this.query().trim();

		void this._router.navigate(['/catalog'], { queryParams: q ? { q } : {} });
		this._reset();
	}

	protected pick() {
		this._reset();
	}

	protected close() {
		this.focused.set(false);
		this.mobileOpen.set(false);
	}

	protected onFocusOut(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;

		if (!next || !this._host.nativeElement.contains(next)) {
			this.close();
		}
	}

	private _reset() {
		this.query.set('');
		this.close();
		this._input()?.nativeElement.blur();
	}
}
