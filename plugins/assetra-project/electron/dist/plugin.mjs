// Electron side of the AssetraProject plugin (see src/app/feature/projects/assetra-project.plugin.ts).
// Runs in the main process. The page can only reach the two methods listed in
// __capacitorElectronPlugin, and only for folders the user picked in the dialog below. Picked
// folders are remembered between runs (userData/project-folders.json) so a project can be used again
// without picking it every time; nothing outside them is ever read or written.
import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = 'assetra.json';
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_MODEL_BYTES = 7 * 1024 * 1024; // what the Assetra upload accepts
const FOLDERS_FILE = 'project-folders.json';
// Where Assetra keeps the models people upload. The CDN does not allow the app's own origin
// (capacitor-electron://localhost) in CORS, so the main process downloads them for the page.
const CDN_PREFIX = 'https://cdn-it.webart.work/assetka/';
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MODELS = 200;
const MAX_DEPTH = 8;
const SKIP_DIRS = new Set(['Library', 'Temp', 'Logs', 'obj', 'Builds', 'UserSettings', 'node_modules']);

const exists = (target) =>
	fs.access(target).then(
		() => true,
		() => false,
	);

// Every .glb under Assets (posix paths relative to the project), skipping caches and hidden folders.
async function findModels(root) {
	const found = [];

	async function walk(dir, depth) {
		if (found.length >= MAX_MODELS || depth > MAX_DEPTH) return;

		for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
			if (found.length >= MAX_MODELS) return;

			const full = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				if (!entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name)) await walk(full, depth + 1);
			} else if (entry.name.toLowerCase().endsWith('.glb')) {
				found.push(path.relative(root, full).split(path.sep).join('/'));
			}
		}
	}

	await walk(path.join(root, 'Assets'), 0);

	return found.sort();
}

async function inspect(dir) {
	const checks = [
		['Assets', path.join(dir, 'Assets')],
		['ProjectSettings/ProjectVersion.txt', path.join(dir, 'ProjectSettings', 'ProjectVersion.txt')],
		['Packages/manifest.json', path.join(dir, 'Packages', 'manifest.json')],
	];
	const missing = [];

	for (const [label, target] of checks) {
		if (!(await exists(target))) missing.push(label);
	}

	const info = {
		path: dir,
		folderName: path.basename(dir),
		isUnity: missing.length === 0,
		missing,
		unityVersion: '',
		productName: '',
		assetraText: null,
		models: [],
	};

	if (!info.isUnity) return info;

	const version = await fs.readFile(checks[1][1], 'utf8').catch(() => '');

	info.unityVersion = /m_EditorVersion:\s*(\S+)/.exec(version)?.[1] ?? '';

	const settings = await fs.readFile(path.join(dir, 'ProjectSettings', 'ProjectSettings.asset'), 'utf8').catch(() => '');

	info.productName = /^\s*productName:\s*(.+?)\s*$/m.exec(settings)?.[1] ?? '';

	const file = path.join(dir, FILE);

	if (await exists(file)) {
		const stat = await fs.stat(file);

		if (stat.size > MAX_FILE_BYTES) throw new Error(`${FILE} is larger than 2 MB.`);

		info.assetraText = await fs.readFile(file, 'utf8');
	} else {
		info.models = await findModels(dir);
	}

	return info;
}

class AssetraProjectImpl {
	// Folders the user ever picked (loaded from userData on first use): the only ones read or written.
	folders = null;

	async pickProject() {
		const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
		const result = await dialog.showOpenDialog(window, {
			title: 'Оберіть папку Unity-проєкту',
			properties: ['openDirectory'],
		});

		if (result.canceled || !result.filePaths[0]) return { canceled: true };

		const dir = path.resolve(result.filePaths[0]);

		await this._remember(dir);

		return { canceled: false, ...(await inspect(dir)) };
	}

	// One .glb of a picked Unity project (uri is relative to the project, as in assetra.json), as base64.
	async readModel(options) {
		const dir = path.resolve(String(options?.path ?? ''));

		if (!(await this._isKnown(dir))) throw new Error('Folder was not picked.');

		const uri = String(options?.uri ?? '');
		const file = path.resolve(dir, uri);

		if (!file.startsWith(dir + path.sep) || !file.toLowerCase().endsWith('.glb')) throw new Error('Not a model of this project.');

		const stat = await fs.stat(file);

		if (!stat.isFile()) throw new Error('Not a model of this project.');
		if (stat.size > MAX_MODEL_BYTES) throw new Error(`${path.basename(file)} is larger than 7 MB.`);

		return { name: path.basename(file), size: stat.size, base64: (await fs.readFile(file)).toString('base64') };
	}

	// A model file of the Assetra CDN (and only that) as base64, for previews inside the app.
	async fetchModel(options) {
		const url = String(options?.url ?? '');

		if (!url.startsWith(CDN_PREFIX) || url.includes('..')) throw new Error('Not an Assetra model address.');

		const response = await fetch(url);

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const declared = Number(response.headers.get('content-length') ?? 0);

		if (declared > MAX_DOWNLOAD_BYTES) throw new Error('Model is too large to preview.');

		const bytes = Buffer.from(await response.arrayBuffer());

		if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error('Model is too large to preview.');

		return { size: bytes.length, base64: bytes.toString('base64') };
	}

	async _folders() {
		if (!this.folders) {
			const text = await fs.readFile(path.join(app.getPath('userData'), FOLDERS_FILE), 'utf8').catch(() => '[]');
			let list = [];

			try {
				list = JSON.parse(text);
			} catch {
				// A broken file just means no remembered folders.
			}

			this.folders = new Set(Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []);
		}

		return this.folders;
	}

	async _isKnown(dir) {
		return (await this._folders()).has(dir);
	}

	async _remember(dir) {
		const folders = await this._folders();

		if (!folders.has(dir)) {
			folders.add(dir);
			await fs.writeFile(path.join(app.getPath('userData'), FOLDERS_FILE), JSON.stringify([...folders]), 'utf8');
		}
	}

	// Creates assetra.json in a picked Unity project. Never replaces an existing file.
	async writeAssetra(options) {
		const dir = path.resolve(String(options?.path ?? ''));

		if (!(await this._isKnown(dir))) throw new Error('Folder was not picked.');

		const content = String(options?.content ?? '');

		if (content.length > MAX_FILE_BYTES) throw new Error(`${FILE} is too large.`);

		JSON.parse(content);

		if (!(await inspect(dir)).isUnity) throw new Error('Not a Unity project.');

		await fs.writeFile(path.join(dir, FILE), content, { encoding: 'utf8', flag: 'wx' });
	}
}

AssetraProjectImpl.__capacitorElectronPlugin = {
	name: 'AssetraProject',
	methods: ['fetchModel', 'pickProject', 'readModel', 'writeAssetra'],
};

export { AssetraProjectImpl as AssetraProject };
