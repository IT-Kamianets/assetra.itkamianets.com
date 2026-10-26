import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../../feature/admin/admin-auth.service';
import { AdminAssetsService } from '../../feature/admin/admin-assets.service';
import { AdminCollectionsService } from '../../feature/admin/admin-collections.service';

const NAV_LINKS = [
	{ path: '/admin/profile', icon: 'storefront', label: 'Профіль', nested: false },
	{ path: '/admin/assets', icon: 'deployed_code', label: 'Ассети', nested: false },
	// Collections group assets, so they sit under «Ассети» in the menu.
	{ path: '/admin/collections', icon: 'collections_bookmark', label: 'Колекції', nested: true },
	{ path: '/admin/settings', icon: 'settings', label: 'Налаштування', nested: false },
];

/** Shell for signed-in admin pages. The admin is browser-only, so the prerendered shell is not hydrated. */
@Component({
	selector: 'app-admin-layout',
	imports: [RouterOutlet, RouterLink, RouterLinkActive],
	host: { ngSkipHydration: 'true' },
	template: `
		<div class="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
			<aside
				class="flex items-center gap-2 border-b border-[var(--c-border)] bg-[var(--c-bg-secondary)] px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:border-r lg:border-b-0 lg:p-5"
			>
				<a class="theme-focus flex items-center gap-2.5 rounded" routerLink="/admin/assets">
					<img class="h-9 w-9 object-contain" src="logo.png" alt="" width="36" height="36" />
					<span class="hidden font-semibold text-[var(--c-text-strong)] sm:inline">
						Assetra <span class="font-normal text-[var(--c-text-muted)]">admin</span>
					</span>
				</a>

				<nav class="ml-auto lg:mt-8 lg:ml-0" aria-label="Адмін-навігація">
					<ul class="flex gap-1 lg:flex-col">
						@for (link of navLinks; track link.path) {
							<li>
								<a
									class="theme-interactive theme-focus flex min-h-10 items-center gap-2.5 rounded-[var(--radius-btn)] px-3 text-sm font-medium text-[var(--c-text-strong)] hover:bg-[var(--c-bg-tertiary)]"
									[class.lg:ml-6]="link.nested"
									routerLinkActive="bg-[var(--c-bg-tertiary)] text-[var(--c-primary)]"
									[routerLink]="link.path"
								>
									<span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ link.icon }}</span>
									<span class="sr-only sm:not-sr-only">{{ link.label }}</span>
									@if (link.path === '/admin/assets') {
										<span class="ml-auto hidden text-xs text-[var(--c-text-muted)] lg:inline">{{ assets.count() }}</span>
									} @else if (link.path === '/admin/collections') {
										<span class="ml-auto hidden text-xs text-[var(--c-text-muted)] lg:inline">{{ collections.count() }}</span>
									}
								</a>
							</li>
						}
					</ul>
				</nav>

				<div class="flex items-center gap-1 lg:mt-auto lg:flex-col lg:items-stretch lg:gap-2 lg:border-t lg:border-[var(--c-border)] lg:pt-4">
					<p class="hidden truncate px-3 text-xs text-[var(--c-text-muted)] lg:block" [title]="auth.email()">{{ auth.email() }}</p>
					<a
						class="theme-interactive theme-focus flex min-h-10 items-center gap-2.5 rounded-[var(--radius-btn)] px-3 text-sm font-medium hover:bg-[var(--c-bg-tertiary)]"
						routerLink="/"
						aria-label="Відкрити сайт"
					>
						<span class="material-symbols-outlined text-[20px]" aria-hidden="true">open_in_new</span>
						<span class="hidden lg:inline">Відкрити сайт</span>
					</a>
					<button
						class="theme-interactive theme-focus flex min-h-10 items-center gap-2.5 rounded-[var(--radius-btn)] px-3 text-sm font-medium hover:bg-[var(--c-bg-tertiary)] hover:text-[#a23b2a]"
						type="button"
						aria-label="Вийти"
						(click)="logout()"
					>
						<span class="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
						<span class="hidden lg:inline">Вийти</span>
					</button>
				</div>
			</aside>

			<div class="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
				@if (auth.isLoggedIn()) {
					<router-outlet />
				}
			</div>
		</div>
	`,
})
export class AdminLayoutComponent {
	private readonly _router = inject(Router);
	protected readonly auth = inject(AdminAuthService);
	protected readonly assets = inject(AdminAssetsService);
	protected readonly collections = inject(AdminCollectionsService);
	protected readonly navLinks = NAV_LINKS;

	protected async logout() {
		await this.auth.logout();
		await this._router.navigateByUrl('/admin/login');
	}
}
