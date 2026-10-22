import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';

/** Window scroll position and direction as signals. Stays at the top during prerender. */
@Service()
export class ScrollService {
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	readonly y = signal(0);
	readonly direction = signal<'up' | 'down'>('up');
	/** Viewport height; 0 during prerender. */
	readonly viewportHeight = signal(0);

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		let last = window.scrollY;
		this.y.set(last);
		this.viewportHeight.set(window.innerHeight);
		window.addEventListener('resize', () => this.viewportHeight.set(window.innerHeight), {
			passive: true,
		});

		window.addEventListener(
			'scroll',
			() => {
				const y = window.scrollY;

				// Ignore sub-pixel jitter and iOS bounce so the topbar does not flicker.
				if (Math.abs(y - last) < 6) {
					return;
				}

				this.direction.set(y > last ? 'down' : 'up');
				this.y.set(y);
				last = y;
			},
			{ passive: true },
		);
	}

	toTop() {
		if (!this._isBrowser) {
			return;
		}

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
	}
}
