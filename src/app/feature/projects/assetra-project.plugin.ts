import { registerPlugin } from '@capacitor/core';

/** What the desktop app found in the folder the user picked. */
export interface ProjectInspection {
	path: string;
	folderName: string;
	/** Assets, ProjectSettings/ProjectVersion.txt and Packages/manifest.json all exist. */
	isUnity: boolean;
	/** The Unity project parts that are missing, when isUnity is false. */
	missing: string[];
	unityVersion: string;
	productName: string;
	/** Content of the project's assetra.json, or null when it has none. */
	assetraText: string | null;
	/** .glb files under Assets (relative paths); only listed when there is no assetra.json yet. */
	models: string[];
}

export type PickProjectResult = { canceled: true } | ({ canceled: false } & ProjectInspection);

/** Electron only: implemented in `plugins/assetra-project`. */
export interface AssetraProjectPlugin {
	/** Folder dialog, then the same checks as an inspection of the chosen folder. */
	pickProject(): Promise<PickProjectResult>;
	/** One .glb of a folder picked earlier (uri is relative to the project, as in assetra.json), up to 7 MB. */
	readModel(options: { path: string; uri: string }): Promise<{ name: string; size: number; base64: string }>;
	/** A model file of the Assetra CDN, downloaded by the app itself (the CDN refuses the app's origin in CORS). */
	fetchModel(options: { url: string }): Promise<{ size: number; base64: string }>;
	/** Creates assetra.json in a folder picked earlier; fails when the file already exists. */
	writeAssetra(options: { path: string; content: string }): Promise<void>;
}

export const AssetraProject = registerPlugin<AssetraProjectPlugin>('AssetraProject');
