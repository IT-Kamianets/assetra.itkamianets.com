import { inject, Service, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { CollectionsService } from '../collections/collections.service';
import { UploadResult, UserModel, UserModelsService } from '../user-models/user-models.service';
import { AssetraProject } from './assetra-project.plugin';
import { Placeholder, Project } from './projects.interface';
import { ProjectsService } from './projects.service';

export interface UploadProgress {
	total: number;
	/** Models handled so far, sent or failed. */
	done: number;
	/** Name of the model being sent right now. */
	current: string;
	failed: { name: string; reason: string }[];
	finished: boolean;
}

const UPLOAD_ERRORS: Record<Exclude<UploadResult, 'ok'>, string> = {
	'too-large': 'файл більший за 7 МБ',
	'bad-file': 'це не .glb',
	storage: 'не вдалося завантажити файл у сховище',
	database: 'файл завантажено, але модель не збережено',
	'signed-out': 'потрібно увійти в акаунт',
};

const _basename = (uri: string): string => uri.slice(uri.lastIndexOf('/') + 1);

/** Assetra category of a model, from the first part of its asset id (props/bench, buildings/shop-red...). */
function _category(id: string): string {
	const group = id.split('/')[0];

	return group === 'characters' ? 'characters' : group === 'buildings' ? 'architecture' : 'props';
}

/**
 * Sends the models of a game to Assetra and connects them to its placeholders: finds or creates the
 * collection named like the project, uploads every empty placeholder's .glb from the project folder
 * (the Assetra upload that "Мої моделі" uses, under the signed-in account), and fills the slot.
 * Placeholders that already have a model are skipped, and a model that is already in the collection
 * under the same name is reused, so running it again after a failure does not create duplicates.
 */
@Service()
export class ProjectUploadService {
	private readonly _auth = inject(AuthService);
	private readonly _collections = inject(CollectionsService);
	private readonly _userModels = inject(UserModelsService);
	private readonly _projects = inject(ProjectsService);

	readonly progress = signal<UploadProgress | null>(null);

	/** Project folder of the run in progress; the files are read from it. */
	private _folder = '';

	/**
	 * Placeholders to send: the empty ones that have a model file in the game project, and the filled
	 * ones whose model came from another file than the project lists now (the game's model was swapped).
	 */
	pending(project: Project): Placeholder[] {
		return (project.placeholders ?? []).filter((item) => !!item.source?.uri && (item.status === 'placeholder' || this.isOutdated(item)));
	}

	/** Filled placeholder whose attached model was uploaded from a different file than `source`. */
	isOutdated(item: Placeholder): boolean {
		return !!item.model && !!item.source?.uri && !!item.model.fileName && item.model.fileName !== _basename(item.source.uri);
	}

	async run(project: Project, folder: string): Promise<void> {
		this._folder = folder;

		const targets = this.pending(project);
		const state: UploadProgress = { total: targets.length, done: 0, current: '', failed: [], finished: false };
		const publish = () => this.progress.set({ ...state, failed: [...state.failed] });

		publish();

		try {
			const collection = await this._collection(project.title);
			const existing = (await this._collections.loadCollection(collection)).models;

			for (const target of targets) {
				const name = target.name || target.id;

				state.current = name;
				publish();

				try {
					const file = _basename(target.source!.uri);
					const model = existing.find((item) => item.title === name && item.fileName === file) ?? (await this._upload(target, name, collection));

					await this._projects.fill(project.slug, target.id, model.id);

					// A swapped model leaves the old version behind: drop it from the collection when no other slot uses it.
					const old = target.modelId && target.modelId !== model.id ? existing.find((item) => item.id === target.modelId) : undefined;
					const stillUsed = (project.placeholders ?? []).some((item) => item.id !== target.id && item.modelId === target.modelId);

					if (old && !stillUsed) {
						await this._userModels.remove(old);
					}
				} catch (error) {
					state.failed.push({ name, reason: error instanceof Error ? error.message : 'невідома помилка' });
				}

				state.done++;
				publish();
			}
		} catch (error) {
			state.failed.push({ name: project.title, reason: error instanceof Error ? error.message : 'невідома помилка' });
		}

		state.current = '';
		state.finished = true;
		publish();
	}

	/** Id of the signed-in user's collection called `title`; created when there is none. */
	private async _collection(title: string): Promise<string> {
		const uid = this._auth.uid();
		const find = async () => (await this._collections.loadAll()).find((item) => item.uid === uid && item.title === title);
		const found = await find();

		if (found) {
			return found.id;
		}

		const result = await this._collections.create({ title, description: `Моделі гри ${title}.`, vroom: false, image: null });
		const created = result === 'ok' ? await find() : undefined;

		if (!created) {
			throw new Error('не вдалося створити колекцію');
		}

		return created.id;
	}

	private async _upload(target: Placeholder, name: string, collectionId: string): Promise<UserModel> {
		const read = await AssetraProject.readModel({ path: this._folder, uri: target.source!.uri });
		const bytes = Uint8Array.from(atob(read.base64), (char) => char.charCodeAt(0));
		const result = await this._userModels.addAndGet({
			title: name,
			description: '',
			category: _category(target.id),
			collectionId,
			model: new File([bytes], read.name, { type: 'model/gltf-binary' }),
			lowModel: null,
			image: null,
		});

		if (typeof result === 'string') {
			throw new Error(UPLOAD_ERRORS[result as Exclude<UploadResult, 'ok'>]);
		}

		return result;
	}
}
