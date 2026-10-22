import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
	categories,
	countByCategory,
	FORMAT_OPTIONS,
	formatModelCount,
	getProduct,
	imageUrl,
	products,
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

	protected readonly productCount = products.length;
	protected readonly categoryCount = categories.length;
	protected readonly freeCount = products.filter((product) => product.price === 0).length;

	protected readonly categories = categories.map((category) => ({
		...category,
		cover: imageUrl(category.image, 500),
		count: countByCategory(category.slug),
	}));
	protected readonly purposes = (Object.keys(PURPOSE_LABELS) as ProductPurpose[]).map((purpose) => ({
		value: purpose,
		label: PURPOSE_LABELS[purpose],
		icon: PURPOSE_ICONS[purpose],
		count: formatModelCount(products.filter((product) => product.purpose.includes(purpose)).length),
	}));
	protected readonly popular = products.filter((product) => product.isHit).slice(0, 4);
	protected readonly fresh = products.filter((product) => product.isNew).slice(0, 4);

	protected readonly formats = FORMAT_OPTIONS;
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
