import { Component, computed, inject } from '@angular/core';
import { ScrollService } from '../../services/scroll.service';

@Component({
	selector: 'app-scroll-top',
	template: `
		<button
			class="theme-focus fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-bg-secondary)] text-[var(--c-text-strong)] shadow-[var(--shadow-md)] backdrop-blur-md transition-[opacity,transform] duration-300 hover:-translate-y-0.5 sm:bottom-8 sm:right-8"
			[class.opacity-0]="!visible()"
			[class.pointer-events-none]="!visible()"
			[class.translate-y-4]="!visible()"
			[attr.aria-hidden]="!visible()"
			[attr.tabindex]="visible() ? 0 : -1"
			type="button"
			aria-label="Повернутися нагору"
			(click)="scrollService.toTop()"
		>
			<span class="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_upward</span>
		</button>
	`,
})
export class ScrollTopComponent {
	protected readonly scrollService = inject(ScrollService);

	protected readonly visible = computed(() => this.scrollService.y() > 600);
}
