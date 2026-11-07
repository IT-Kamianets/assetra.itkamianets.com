export interface Vector3 {
	x: number;
	y: number;
	z: number;
}

/** A model of the Assetra library (`/api/assetra/model`). */
export interface LibraryModel {
	id: string;
	title: string;
	description?: string;
	category?: string;
	collectionId?: string;
	modelUrl: string;
	lowModelUrl?: string;
	imageUrl?: string;
	fileName?: string;
	size?: number;
	createdAt?: number;
}

/** A collection of the Assetra library (`/api/assetra/collection`). */
export interface LibraryCollection {
	id: string;
	title: string;
	description?: string;
	imageUrl?: string;
}

/** The model that fills a placeholder, as the API resolves it. */
export type FilledModel = Pick<LibraryModel, 'id' | 'title' | 'modelUrl' | 'lowModelUrl' | 'imageUrl' | 'fileName' | 'size'>;

/** One model a game declares in its assetra.json (3d-asset-schema Asset, kind "model"). */
export interface Placeholder {
	id: string;
	name?: string;
	bounds?: { min: Vector3; max: Vector3 };
	placeholder?: { shape: 'box' | 'sphere' | 'capsule'; color?: { r: number; g: number; b: number } };
	/** File of the model inside the game project (informative). */
	source?: { uri: string; format: string };
	metadata?: { tags?: string[]; properties?: Record<string, unknown> };
	/** Library model attached in Assetra, '' while empty. */
	modelId: string;
	model: FilledModel | null;
	status: 'filled' | 'placeholder';
}

export interface Project {
	slug: string;
	title: string;
	description: string;
	engine: string;
	uid: string;
	createdAt: number;
	updatedAt: number;
	placeholders?: Placeholder[];
}

/** What is read from a game's assetra.json before it is sent to Assetra. */
export interface AssetraFile {
	slug: string;
	title: string;
	assets: unknown[];
	modelCount: number;
}

/** A Unity project chosen on this PC, ready to be added to Assetra. */
export interface PickedProject extends AssetraFile {
	/** Folder the user picked. */
	folder: string;
	unityVersion: string;
	/** True when the folder has no assetra.json yet and one will be created from `content`. */
	create: boolean;
	/** The assetra.json to write when `create` is true. */
	content: string;
}
