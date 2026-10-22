import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Breadcrumb } from '../catalog.interface';

@Component({
	selector: 'app-breadcrumbs',
	imports: [RouterLink],
	template: `
		<nav aria-label="Хлібні крихти">
			<ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--c-text-muted)]">
				@for (item of items(); track item.label; let last = $last) {
					<li class="flex items-center gap-2">
						@if (item.path && !last) {
							<a class="theme-focus rounded hover:text-[var(--c-primary)]" [routerLink]="item.path">
								{{ item.label }}
							</a>
						} @else {
							<span class="text-[var(--c-text-strong)]" aria-current="page">{{ item.label }}</span>
						}
						@if (!last) {
							<span aria-hidden="true">/</span>
						}
					</li>
				}
			</ol>
		</nav>
	`,
})
export class BreadcrumbsComponent {
	readonly items = input.required<Breadcrumb[]>();
}
