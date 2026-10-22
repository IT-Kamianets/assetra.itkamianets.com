import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
	categories,
	countByCategory,
	imageUrl,
	orderHref,
	products,
	ROOM_LABELS,
	STYLE_LABELS,
} from '../../feature/catalog/catalog.data';
import { ProductRoom, ProductStyle } from '../../feature/catalog/catalog.interface';
import { ProductCardComponent } from '../../feature/catalog/product-card/product-card.component';
import { ScrollService } from '../../services/scroll.service';

const ROOM_ICONS: Record<ProductRoom, string> = {
	living: 'weekend',
	bedroom: 'bed',
	kitchen: 'restaurant',
	office: 'desk',
	horeca: 'local_cafe',
};

@Component({
	imports: [RouterLink, ProductCardComponent],
	templateUrl: './landing.component.html',
})
export class LandingComponent {
	private readonly _scrollService = inject(ScrollService);

	/** Hero photo blurs (up to 16px) and darkens over the first ~60% of a screen of scrolling. */
	private readonly _heroProgress = computed(() => Math.min(this._scrollService.y() / 520, 1));
	protected readonly heroBlur = computed(() => Math.round(this._heroProgress() * 16 * 10) / 10);
	protected readonly heroShade = computed(() => this._heroProgress() * 0.35);

	protected readonly productCount = products.length;
	protected readonly categoryCount = categories.length;
	protected readonly freeCount = products.filter((product) => product.price === 0).length;

	protected readonly categories = categories.map((category) => ({
		...category,
		cover: imageUrl(category.image, 500),
		count: countByCategory(category.slug),
	}));
	protected readonly rooms = (Object.keys(ROOM_LABELS) as ProductRoom[]).map((room) => ({
		value: room,
		label: ROOM_LABELS[room],
		icon: ROOM_ICONS[room],
	}));
	protected readonly styles = (Object.keys(STYLE_LABELS) as ProductStyle[]).map((style) => ({
		value: style,
		label: STYLE_LABELS[style],
	}));
	protected readonly popular = products.filter((product) => product.isHit).slice(0, 4);
	protected readonly fresh = products.filter((product) => product.isNew).slice(0, 4);

	protected readonly formats = ['3ds Max', 'Corona', 'V-Ray', 'SketchUp', 'Blender', 'FBX', 'OBJ', 'GLB'];
	protected readonly benefits = [
		{
			icon: 'straighten',
			title: 'Реальні габарити',
			text: 'Розміри моделей відповідають справжнім меблям, тож вони одразу стають у план без масштабування.',
		},
		{
			icon: 'texture',
			title: 'Готові матеріали',
			text: 'PBR-текстури до 4K і налаштовані матеріали для Corona та V-Ray, без ручного переналаштування.',
		},
		{
			icon: 'grid_on',
			title: 'Чиста топологія',
			text: 'Квадова сітка без зайвих полігонів, тому сцена з десятками моделей не гальмує.',
		},
		{
			icon: 'view_in_ar',
			title: 'Перегляд у 3D',
			text: 'Покрутіть модель у браузері й роздивіться деталі ще до замовлення.',
		},
	];

	protected readonly customOrderHref = orderHref('Модель на замовлення');
}
