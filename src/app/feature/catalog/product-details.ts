import { formatPolygons, PURPOSE_LABELS } from './catalog.data';
import { Product, ProductDetails } from './catalog.interface';

/** Option lists shared by the admin form and the product page, as on CGTrader / TurboSquid / Sketchfab. */
export const GEOMETRY_LABELS: Record<NonNullable<ProductDetails['geometry']>, string> = {
	quads: 'Квади',
	tris: 'Трикутники',
	mixed: 'Квади й трикутники',
	ngons: 'Є n-гони',
};

export const STYLE_LABELS: Record<NonNullable<ProductDetails['style']>, string> = {
	realistic: 'Реалістичний',
	stylized: 'Стилізований',
	'low-poly': 'Low-poly',
	cartoon: 'Мультяшний',
};

export const UV_LABELS: Record<NonNullable<ProductDetails['uv']>, string> = {
	'non-overlapping': 'Без накладань',
	overlapping: 'З накладаннями',
	none: 'Без розгортки',
};

export const PBR_LABELS: Record<NonNullable<ProductDetails['pbrWorkflow']>, string> = {
	'metal-rough': 'Metallic / Roughness',
	'spec-gloss': 'Specular / Glossiness',
	none: 'Без PBR',
};

export const LICENSE_LABELS: Record<NonNullable<ProductDetails['license']>, string> = {
	standard: 'Стандартна (royalty-free)',
	editorial: 'Редакційна (без комерції)',
	'cc-by': 'CC BY 4.0',
	cc0: 'CC0 (суспільне надбання)',
};

export const UNIT_LABELS: Record<NonNullable<ProductDetails['dimensions']>['unit'], string> = {
	mm: 'мм',
	cm: 'см',
	m: 'м',
	in: 'дюйми',
};

export const TEXTURE_RESOLUTIONS = ['512', '1K', '2K', '4K', '8K'] as const;

export const TEXTURE_MAPS = [
	'Base Color',
	'Normal',
	'Roughness',
	'Metallic',
	'Ambient Occlusion',
	'Height',
	'Emission',
	'Opacity',
	'Specular',
	'Glossiness',
] as const;

export const FILE_FORMATS = ['GLB', 'glTF', 'FBX', 'OBJ', 'USDZ', 'BLEND', 'STL', '3DS', 'MAX', 'MA', 'C4D'] as const;

export const FLAG_LABELS = {
	realWorldScale: 'Реальний масштаб',
	udim: 'UDIM',
	blendShapes: 'Blend shapes',
	gameReady: 'Game-ready',
	arReady: 'AR-ready',
	vrReady: 'VR-ready',
	printable: 'Для 3D-друку',
	watertight: 'Замкнена сітка',
} as const satisfies Partial<Record<keyof ProductDetails, string>>;

export type DetailFlag = keyof typeof FLAG_LABELS;

export interface DetailRow {
	label: string;
	value: string;
}

export interface DetailGroup {
	title: string;
	rows: DetailRow[];
}

const number = new Intl.NumberFormat('uk-UA');

/** Filled details only, grouped for the product page; empty groups are dropped. */
export function detailGroups(product: Product): DetailGroup[] {
	const details = product.details ?? {};
	const yes = (value: boolean | undefined) => (value === undefined ? '' : value ? 'Так' : 'Ні');
	const count = (value: number | undefined) => (value === undefined ? '' : number.format(value));
	const dimensions = details.dimensions;

	const groups: DetailGroup[] = [
		{
			title: 'Геометрія',
			rows: [
				{ label: 'Полігони', value: formatPolygons(product.polygons) },
				{ label: 'Вершини', value: count(details.vertices) },
				{ label: 'Тип сітки', value: details.geometry ? GEOMETRY_LABELS[details.geometry] : '' },
				{ label: "Об'єкти (меші)", value: count(details.meshes) },
				{ label: 'Рівні деталізації (LOD)', value: count(details.lods) },
				{ label: 'Стиль', value: details.style ? STYLE_LABELS[details.style] : '' },
				{
					label: 'Розміри (Ш × В × Г)',
					value: dimensions
						? `${[dimensions.width, dimensions.height, dimensions.depth].map((side) => number.format(side)).join(' × ')} ${UNIT_LABELS[dimensions.unit]}`
						: '',
				},
				{ label: 'Реальний масштаб', value: yes(details.realWorldScale) },
				{ label: 'Замкнена сітка (watertight)', value: yes(details.watertight) },
			],
		},
		{
			title: 'Матеріали й текстури',
			rows: [
				{ label: 'Текстури', value: product.textures },
				{ label: 'Роздільність текстур', value: details.textureResolution ?? '' },
				{ label: 'PBR-воркфлоу', value: details.pbrWorkflow ? PBR_LABELS[details.pbrWorkflow] : '' },
				{ label: 'Карти текстур', value: (details.textureMaps ?? []).join(', ') },
				{ label: 'Матеріали', value: count(details.materials) },
				{ label: 'Файли текстур', value: count(details.textureCount) },
				{ label: 'UV-розгортка', value: details.uv ? UV_LABELS[details.uv] : '' },
				{ label: 'UDIM', value: yes(details.udim) },
			],
		},
		{
			title: 'Ріг і анімація',
			rows: [
				{ label: 'Ріг', value: yes(product.rigged) },
				{ label: 'Кістки', value: count(details.bones) },
				{ label: 'Анімація', value: yes(product.animated) },
				{ label: 'Анімаційні кліпи', value: count(details.animations) },
				{ label: 'Blend shapes (морфи)', value: yes(details.blendShapes) },
			],
		},
		{
			title: 'Використання',
			rows: [
				{ label: 'Призначення', value: product.purpose.map((purpose) => PURPOSE_LABELS[purpose]).join(', ') },
				{ label: 'Game-ready', value: yes(details.gameReady) },
				{ label: 'AR-ready', value: yes(details.arReady) },
				{ label: 'VR-ready', value: yes(details.vrReady) },
				{ label: 'Для 3D-друку', value: yes(details.printable) },
				{ label: 'Ліцензія', value: details.license ? LICENSE_LABELS[details.license] : '' },
			],
		},
		{
			title: 'Файли',
			rows: [
				{ label: 'Формати', value: product.formats.join(', ') },
				{ label: 'Програми', value: product.software.join(', ') },
				{ label: 'Версія програми', value: details.softwareVersion ?? '' },
				{ label: 'Рушії рендеру', value: product.renderers.join(', ') },
				{ label: 'Потрібні плагіни', value: details.plugins ?? '' },
				{ label: 'Розмір архіву', value: product.archiveSize },
				{ label: 'Теги', value: product.tags.join(', ') },
				{ label: 'Опубліковано', value: details.published ? new Date(details.published).toLocaleDateString('uk-UA') : '' },
			],
		},
	];

	return groups
		.map((group) => ({ ...group, rows: group.rows.filter((row) => row.value) }))
		.filter((group) => group.rows.length);
}
