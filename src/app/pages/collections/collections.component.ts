import { isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../feature/auth/auth.service';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	categories,
	collections,
	formatModelCount,
	getCollection,
	productsInCollection,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';
import { UserModel } from '../../feature/user-models/user-models.service';
import { ModelCollection, CollectionsService } from '../../feature/collections/collections.service';

type State = 'loading' | 'ready' | 'error';

/**
 * Collections at /collections, one at /collections?collection=<slug or id>. Catalog collections come
 * from collections.json; authors' collections live in Firestore and are filled in in the browser.
 */
@Component({
	imports: [RouterLink, BreadcrumbsComponent, ProductCardComponent],
	host: { ngSkipHydration: 'true' },
	templateUrl: './collections.component.html',
})
export class CollectionsComponent {
	private readonly _collections = inject(CollectionsService);
	private readonly _router = inject(Router);
	protected readonly auth = inject(AuthService);

	protected readonly collectionId = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('collection') ?? '')), {
		initialValue: '',
	});
	protected readonly state = signal<State>('loading');
	protected readonly all = signal<ModelCollection[]>([]);
	protected readonly collection = signal<ModelCollection | null>(null);
	protected readonly models = signal<UserModel[]>([]);
	protected readonly breadcrumbs = signal<Breadcrumb[]>([{ label: 'Головна', path: '/' }, { label: 'Колекції' }]);
	protected readonly catalogCollections = collections;
	protected readonly catalogCollection = computed(() => getCollection(this.collectionId()));
	protected readonly catalogProducts = computed(() => productsInCollection(this.collectionId()));

	constructor() {
		if (!isPlatformBrowser(inject(PLATFORM_ID))) {
			return;
		}

		effect(() => void this._load(this.collectionId()));
	}

	protected categoryTitle(slug: string): string {
		return categories.find((category) => category.slug === slug)?.title ?? '';
	}

	protected catalogCount(slug: string): number {
		return productsInCollection(slug).length;
	}

	protected modelCount(count: number): string {
		return formatModelCount(count);
	}

	/** Same rule as catalog models: downloading needs an account. */
	protected signInToDownload() {
		void this._router.navigate(['/account'], { queryParams: { next: this._router.url } });
	}

	private async _load(id: string) {
		const catalog = getCollection(id);

		if (catalog) {
			this.breadcrumbs.set([
				{ label: 'Головна', path: '/' },
				{ label: 'Колекції', path: '/collections' },
				{ label: catalog.title },
			]);
			return;
		}

		this.state.set('loading');

		try {
			if (id) {
				const { collection, models } = await this._collections.loadCollection(id);

				this.collection.set(collection);
				this.models.set(models);
				this.breadcrumbs.set([
					{ label: 'Головна', path: '/' },
					{ label: 'Колекції', path: '/collections' },
					{ label: collection?.title ?? 'Колекцію не знайдено' },
				]);
			} else {
				this.all.set(await this._collections.loadAll());
				this.breadcrumbs.set([{ label: 'Головна', path: '/' }, { label: 'Колекції' }]);
			}

			this.state.set('ready');
		} catch (error) {
			console.error(error);
			this.state.set('error');
		}
	}
}
