import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../feature/auth/auth.service';
import { ModelViewerComponent } from '../../feature/catalog/model-viewer/model-viewer.component';
import { AssetraProject } from '../../feature/projects/assetra-project.plugin';
import { ModelSourceService } from '../../feature/projects/model-source.service';
import { ModelThumbnailService } from '../../feature/projects/model-thumbnail.service';
import { OnVisibleDirective } from '../../feature/projects/on-visible.directive';
import { projectFolder, rememberProjectFolder } from '../../feature/projects/project-folders';
import { ProjectUploadService } from '../../feature/projects/project-upload.service';
import { LibraryModel, Placeholder } from '../../feature/projects/projects.interface';
import { ProjectsError, ProjectsService, parseAssetraFile } from '../../feature/projects/projects.service';

interface PlaceholderGroup {
	name: string;
	items: Placeholder[];
}

/** Desktop app only: the models a game declares (placeholders) next to the Assetra library to fill them from. */
@Component({
	selector: 'app-project',
	imports: [RouterLink, ModelViewerComponent, OnVisibleDirective],
	templateUrl: './project.component.html',
})
export class ProjectComponent {
	protected readonly auth = inject(AuthService);
	protected readonly projectsService = inject(ProjectsService);
	private readonly _slug = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

	protected readonly loading = signal(true);
	protected readonly error = signal('');
	protected readonly notice = signal('');
	protected readonly selectedId = signal('');
	protected readonly collectionId = signal('');
	protected readonly search = signal('');
	protected readonly busy = signal('');

	/** Pictures drawn from the GLB for models that have no preview image. */
	protected readonly thumbs = inject(ModelThumbnailService);
	/** Id of the library model whose live 3D preview is showing (the pointer rests on its card). */
	protected readonly hovered = signal('');
	/** Address the hovered model's viewer loads from (see ModelSourceService); '' while it is being fetched. */
	protected readonly previewSrc = signal('');
	private readonly _source = inject(ModelSourceService);
	private _hoverTimer: ReturnType<typeof setTimeout> | undefined;

	protected readonly upload = inject(ProjectUploadService);
	/** Folder of this game on this PC, remembered from when it was added; '' until it is known. */
	protected readonly folder = signal(projectFolder(this._slug));
	protected readonly uploading = signal(false);

	protected readonly project = this.projectsService.project;
	protected readonly placeholders = computed(() => this.project()?.placeholders ?? []);
	protected readonly filledCount = computed(() => this.placeholders().filter((item) => item.status === 'filled').length);
	protected readonly selected = computed(() => this.placeholders().find((item) => item.id === this.selectedId()) ?? null);
	protected readonly groups = computed<PlaceholderGroup[]>(() => {
		const byName = new Map<string, Placeholder[]>();

		for (const item of this.placeholders()) {
			const name = item.id.includes('/') ? item.id.slice(0, item.id.indexOf('/')) : 'other';

			byName.set(name, [...(byName.get(name) ?? []), item]);
		}

		return [...byName].map(([name, items]) => ({ name, items }));
	});
	protected readonly models = computed(() => {
		const collection = this.collectionId();
		const query = this.search().trim().toLowerCase();

		return this.projectsService
			.models()
			.filter((model) => !collection || model.collectionId === collection)
			.filter((model) => !query || `${model.title} ${model.category ?? ''}`.toLowerCase().includes(query));
	});

	constructor() {
		void this._load();
	}

	/** Empty slots whose model file exists in the game project: what "upload" would send. */
	protected readonly pendingCount = computed(() => {
		const project = this.project();

		return project ? this.upload.pending(project).length : 0;
	});

	/** How many of those would replace a model that is already in a slot. */
	protected readonly outdatedCount = computed(() => this.placeholders().filter((item) => this.upload.isOutdated(item)).length);

	/** Asks for this game's folder again (it is not known on this PC) and checks it is the same project. */
	protected async pickFolder() {
		this.error.set('');

		try {
			const result = await AssetraProject.pickProject();

			if (result.canceled) {
				return;
			}

			if (!result.isUnity) {
				this.error.set(`Це не Unity-проєкт: у папці немає ${result.missing.join(', ')}.`);
				return;
			}

			const slug = result.assetraText === null ? '' : parseAssetraFile(result.assetraText).slug;

			if (slug !== this._slug) {
				this.error.set('У цій папці інший проєкт або немає assetra.json цієї гри. Оберіть папку гри ' + this._slug + '.');
				return;
			}

			rememberProjectFolder(this._slug, result.path);
			this.folder.set(result.path);
		} catch (error) {
			this.error.set(error instanceof Error ? error.message : 'Не вдалося відкрити папку.');
		}
	}

	/** Creates the collection, uploads the game's models into it and fills the slots (see ProjectUploadService). */
	protected async uploadAll() {
		const project = this.project();

		if (!project || !this.folder() || this.uploading()) {
			return;
		}

		this.uploading.set(true);
		this.error.set('');
		this.notice.set('');

		try {
			await this.upload.run(project, this.folder());
			await this.projectsService.loadLibrary();
		} finally {
			this.uploading.set(false);
		}
	}

	/** Starts the 3D preview after a short rest, so moving across cards does not open a viewer on each. */
	protected hoverIn(model: LibraryModel) {
		clearTimeout(this._hoverTimer);
		this._hoverTimer = setTimeout(() => {
			this.previewSrc.set('');
			this.hovered.set(model.id);
			this._source
				.resolve(model.modelUrl)
				.then((src) => this.hovered() === model.id && this.previewSrc.set(src))
				.catch(() => undefined);
		}, 250);
	}

	protected hoverOut() {
		clearTimeout(this._hoverTimer);
		this.hovered.set('');
		this.previewSrc.set('');
	}

	protected select(placeholder: Placeholder) {
		this.selectedId.set(placeholder.id === this.selectedId() ? '' : placeholder.id);
		this.notice.set('');
	}

	protected async use(model: LibraryModel) {
		const target = this.selected();

		if (!target || this.busy()) {
			return;
		}

		await this._set(target, model.id, `«${target.name || target.id}»: ${model.title}`);

		// Move on to the next empty slot so several can be filled in a row.
		const next = this.placeholders().find((item) => item.status === 'placeholder' && item.id !== target.id);

		this.selectedId.set(next?.id ?? '');
	}

	protected async clear(placeholder: Placeholder, event: Event) {
		event.stopPropagation();
		await this._set(placeholder, '', `«${placeholder.name || placeholder.id}» знову порожня`);
	}

	/** "1.2 × 4 × 1.2 м" from the placeholder bounds, or '' when it has none. */
	protected size(placeholder: Placeholder): string {
		const bounds = placeholder.bounds;

		if (!bounds) {
			return '';
		}

		const round = (value: number) => Math.round(value * 100) / 100;

		return `${round(bounds.max.x - bounds.min.x)} × ${round(bounds.max.y - bounds.min.y)} × ${round(bounds.max.z - bounds.min.z)} м`;
	}

	protected budget(placeholder: Placeholder): number {
		const value = placeholder.metadata?.properties?.['maxTriangles'];

		return typeof value === 'number' ? value : 0;
	}

	protected isStarter(placeholder: Placeholder): boolean {
		return placeholder.status === 'placeholder' && !!placeholder.source;
	}

	protected collectionTitle(id: string): string {
		return this.projectsService.collections().find((collection) => collection.id === id)?.title ?? '';
	}

	private async _set(placeholder: Placeholder, modelId: string, done: string) {
		this.busy.set(placeholder.id);
		this.notice.set('');
		this.error.set('');

		try {
			await this.projectsService.fill(this._slug, placeholder.id, modelId);
			this.notice.set(done);
		} catch (error) {
			this.error.set(error instanceof ProjectsError ? error.message : 'Не вдалося зберегти.');
		} finally {
			this.busy.set('');
		}
	}

	private async _load() {
		await this.auth.ready;

		if (!this.auth.isLoggedIn()) {
			this.loading.set(false);
			return;
		}

		try {
			this.projectsService.project.set(null);
			await Promise.all([this.projectsService.loadProject(this._slug), this.projectsService.loadLibrary()]);
			this.selectedId.set(this.placeholders().find((item) => item.status === 'placeholder')?.id ?? '');
		} catch (error) {
			this.error.set(
				error instanceof ProjectsError
					? error.status === 404
						? 'Проєкт не знайдено.'
						: error.message
					: 'Не вдалося завантажити проєкт.',
			);
		} finally {
			this.loading.set(false);
		}
	}
}
