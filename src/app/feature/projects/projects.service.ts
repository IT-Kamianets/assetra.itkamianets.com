import { inject, Service, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ProjectInspection } from './assetra-project.plugin';
import { AssetraFile, LibraryCollection, LibraryModel, PickedProject, Placeholder, Project } from './projects.interface';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;

export class ProjectsError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

/**
 * Reads the text of a game's assetra.json (a 3d-asset-schema library) and checks what Assetra needs.
 * The project id is `metadata.properties.assetra.project`, or `libraryId` when that is missing.
 */
export function parseAssetraFile(text: string): AssetraFile {
	let data: any;

	try {
		data = JSON.parse(text);
	} catch {
		throw new ProjectsError(0, 'Файл не є коректним JSON.');
	}

	if (!data || typeof data !== 'object' || !Array.isArray(data.assets)) {
		throw new ProjectsError(0, 'Це не assetra.json: немає списку assets.');
	}

	const info = data.metadata?.properties?.assetra ?? {};
	const slug = String(info.project || data.libraryId || '');

	if (!SLUG_RE.test(slug)) {
		throw new ProjectsError(0, 'Немає ідентифікатора проєкту: вкажіть metadata.properties.assetra.project (a-z, 0-9, дефіс).');
	}

	return {
		slug,
		title: String(info.name || slug),
		assets: data.assets,
		modelCount: data.assets.filter((asset: any) => asset?.kind === undefined || asset?.kind === 'model').length,
	};
}

const _kebab = (text: string): string =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);

/**
 * Turns what the desktop app found in a Unity folder into a PickedProject. With an assetra.json it is
 * read as it is; without one a starter file is built: the project name from Unity's product name, and
 * every .glb under Assets as a model that is already filled. A GLB at the ITKP 3D location
 * `Assets/Models/<group>/<name>.glb` gets the id `<group>/<name>`; any other GLB becomes `models/<name>`.
 */
export function pickedFromInspection(info: ProjectInspection): PickedProject {
	if (info.assetraText !== null) {
		return { ...parseAssetraFile(info.assetraText), folder: info.path, unityVersion: info.unityVersion, create: false, content: '' };
	}

	const name = info.productName || info.folderName;
	const slug = _kebab(name) || _kebab(info.folderName) || 'unity-project';
	const used = new Set<string>();
	const assets = info.models.map((uri) => {
		const file = uri.slice(uri.lastIndexOf('/') + 1).replace(/\.glb$/i, '');
		const standard = /^Assets\/Models\/([^/]+)\/([^/]+)\.glb$/i.exec(uri);
		const base = standard ? `${_kebab(standard[1]) || 'models'}/${_kebab(standard[2]) || 'model'}` : `models/${_kebab(file) || 'model'}`;
		let id = base;

		for (let n = 2; used.has(id); n++) {
			id = `${base}-${n}`;
		}

		used.add(id);

		return { id, name: file.replace(/[-_]+/g, ' ').trim(), kind: 'model', source: { uri, format: 'glb' } };
	});
	const content = JSON.stringify(
		{
			schemaVersion: '1.0.0',
			libraryId: slug,
			units: 'meters',
			metadata: { tags: ['assetra'], properties: { assetra: { format: 1, project: slug, name, modelsDir: 'Assets/Models' } } },
			assets,
		},
		null,
		2,
	);

	return {
		slug,
		title: name,
		assets,
		modelCount: assets.length,
		folder: info.path,
		unityVersion: info.unityVersion,
		create: true,
		content: `${content}\n`,
	};
}

/**
 * Projects of the signed-in user on the Assetra API (`/api/assetra/project`) plus the public model
 * library. Every call carries the Firebase ID token of the site sign-in.
 */
@Service()
export class ProjectsService {
	private readonly _auth = inject(AuthService);

	readonly projects = signal<Project[]>([]);
	readonly project = signal<Project | null>(null);
	readonly models = signal<LibraryModel[]>([]);
	readonly collections = signal<LibraryCollection[]>([]);

	async loadProjects() {
		const list = await this._request<Project[]>('GET', '/project');

		// The list has no placeholders; the page shows progress, so each project is read in full.
		this.projects.set(
			await Promise.all(list.map((item) => this._request<Project>('GET', `/project/${encodeURIComponent(item.slug)}`))),
		);
	}

	async loadProject(slug: string) {
		this.project.set(await this._request<Project>('GET', `/project/${encodeURIComponent(slug)}`));
	}

	async loadLibrary() {
		const [models, collections] = await Promise.all([
			this._request<LibraryModel[]>('GET', '/model'),
			this._request<LibraryCollection[]>('GET', '/collection'),
		]);

		this.models.set(models);
		this.collections.set(collections);
	}

	/** Sends the content of a game's assetra.json: creates the project and its placeholders, keeps filled ones. */
	async addFromFile(file: AssetraFile): Promise<{ added: number; written: number }> {
		const result = await this._request<Project & { added: number; written: number }>(
			'POST',
			`/project/${encodeURIComponent(file.slug)}/sync`,
			{ title: file.title, engine: 'unity', assets: file.assets },
		);

		await this.loadProjects();

		return { added: result.added, written: result.written };
	}

	async fill(slug: string, placeholderId: string, modelId: string): Promise<Placeholder> {
		const placeholder = await this._request<Placeholder>(
			'PATCH',
			`/project/${encodeURIComponent(slug)}/placeholder/${encodeURIComponent(placeholderId.replace(/\//g, '__'))}`,
			{ modelId },
		);

		this.project.update((project) =>
			project?.slug === slug
				? { ...project, placeholders: project.placeholders?.map((item) => (item.id === placeholder.id ? placeholder : item)) }
				: project,
		);

		return placeholder;
	}

	private async _request<T>(method: string, path: string, body?: unknown): Promise<T> {
		await this._auth.ready;

		const token = await this._auth.idToken();

		if (!token) {
			throw new ProjectsError(401, 'Увійдіть в акаунт, щоб бачити проєкти.');
		}

		let response: Response;

		try {
			response = await fetch(`${environment.apiUrl}/api/assetra${path}`, {
				method,
				headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
				body: body === undefined ? undefined : JSON.stringify(body),
			});
		} catch {
			throw new ProjectsError(0, 'Немає звʼязку з сервером Assetra.');
		}

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			throw new ProjectsError(response.status, data?.error || `Помилка сервера (${response.status}).`);
		}

		return data as T;
	}
}
