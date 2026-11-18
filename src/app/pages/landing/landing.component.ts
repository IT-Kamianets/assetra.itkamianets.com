import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
	categories,
	countByCategory,
	formatModelCount,
	allProducts,
	getProduct,
	imageUrl,
	PURPOSE_LABELS,
} from '../../feature/catalog/catalog.data';
import { ProductPurpose } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';
import { ScrollService } from '../../services/scroll.service';
import { HeroModelComponent } from './hero-model/hero-model.component';

const PURPOSE_ICONS: Record<ProductPurpose, string> = {
	games: 'sports_esports',
	viz: 'photo_camera',
	arvr: 'view_in_ar',
	animation: 'animation',
};

@Component({
	imports: [RouterLink, ProductCardComponent, HeroModelComponent],
	templateUrl: './landing.component.html',
})
export class LandingComponent {
	private readonly _scrollService = inject(ScrollService);

	/** Hero photo blurs (up to 16px) and darkens over the first ~60% of a screen of scrolling. */
	private readonly _heroProgress = computed(() => Math.min(this._scrollService.y() / 520, 1));
	protected readonly heroBlur = computed(() => Math.round(this._heroProgress() * 16 * 10) / 10);
	protected readonly heroShade = computed(() => this._heroProgress() * 0.35);

	/** The static render is shown until the live model has loaded, then crossfades away. */
	protected readonly heroModel = getProduct('concept-car')!.model!;
	protected readonly heroModelLoaded = signal(false);

	// Everything below reads the live catalog, so models uploaded later show up without a rebuild.
	protected readonly productCount = computed(() => allProducts().length);
	protected readonly categoryCount = categories.length;
	protected readonly freeCount = computed(() => allProducts().filter((product) => product.price === 0).length);

	protected readonly categories = computed(() =>
		categories.map((category) => ({
			...category,
			cover: imageUrl(category.image, 500),
			count: countByCategory(category.slug),
		})),
	);
	protected readonly purposes = computed(() =>
		(Object.keys(PURPOSE_LABELS) as ProductPurpose[]).map((purpose) => ({
			value: purpose,
			label: PURPOSE_LABELS[purpose],
			icon: PURPOSE_ICONS[purpose],
			count: formatModelCount(allProducts().filter((product) => product.purpose.includes(purpose)).length),
		})),
	);
	protected readonly popular = computed(() => allProducts().filter((product) => product.isHit).slice(0, 4));
	/** The newest uploads first (admin assets and users' models); models marked "new" in the built-in catalog fill the rest. */
	protected readonly fresh = computed(() =>
		allProducts()
			.filter((product) => product.isNew || product.addedAt)
			.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
			.slice(0, 4),
	);

	protected readonly glbFeatures = ['Геометрія + текстури', 'PBR-матеріали', 'Ріг і анімації', 'Один файл', 'AR-ready'];
	protected readonly benefits = [
		{
			icon: 'view_in_ar',
			title: 'Перегляд у 3D',
			text: 'Кожну модель можна покрутити просто в браузері й роздивитися деталі ще до покупки.',
		},
		{
			icon: 'texture',
			title: 'Готові матеріали',
			text: 'PBR-текстури до 4K, які коректно виглядають у Blender, Unreal, Unity та рушіях рендеру.',
		},
		{
			icon: 'grid_on',
			title: 'Чиста топологія',
			text: 'Оптимізовані сітки: low-poly для ігор і мобільних, деталізовані моделі для крупних планів.',
		},
		{
			icon: 'verified',
			title: 'Перевірені автори',
			text: 'Студії та 3D-художники, чиї моделі ми перевіряємо перед публікацією.',
		},
	];

}
