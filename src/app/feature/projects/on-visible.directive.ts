import { Directive, ElementRef, inject, OnDestroy, OnInit, output } from '@angular/core';

/** Emits once, the first time the element scrolls into view (or at once without IntersectionObserver). */
@Directive({ selector: '[appOnVisible]' })
export class OnVisibleDirective implements OnInit, OnDestroy {
	readonly appOnVisible = output<void>();

	private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
	private _observer?: IntersectionObserver;

	ngOnInit() {
		if (typeof IntersectionObserver === 'undefined') {
			this.appOnVisible.emit();
			return;
		}

		this._observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				this.appOnVisible.emit();
				this._observer?.disconnect();
			}
		});
		this._observer.observe(this._host.nativeElement);
	}

	ngOnDestroy() {
		this._observer?.disconnect();
	}
}
