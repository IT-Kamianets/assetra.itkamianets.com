import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../feature/auth/auth.service';
import { AssetraProject } from '../../feature/projects/assetra-project.plugin';
import { rememberProjectFolder } from '../../feature/projects/project-folders';
import { PickedProject, Project } from '../../feature/projects/projects.interface';
import { ProjectsError, ProjectsService, pickedFromInspection } from '../../feature/projects/projects.service';

/** Desktop app only: the games that keep their model list in an assetra.json, and a way to add one from this PC. */
@Component({
	selector: 'app-projects',
	imports: [RouterLink],
	templateUrl: './projects.component.html',
})
export class ProjectsComponent {
	protected readonly auth = inject(AuthService);
	protected readonly projectsService = inject(ProjectsService);
	private readonly _router = inject(Router);

	protected readonly loading = signal(true);
	protected readonly error = signal('');
	protected readonly picked = signal<PickedProject | null>(null);
	protected readonly picking = signal(false);
	protected readonly adding = signal(false);
	protected readonly addError = signal('');
	protected readonly isNew = computed(() => {
		const picked = this.picked();

		return !!picked && !this.projectsService.projects().some((project) => project.slug === picked.slug);
	});

	constructor() {
		void this._load();
	}

	protected filled(project: Project): number {
		return project.placeholders?.filter((item) => item.status === 'filled').length ?? 0;
	}

	protected total(project: Project): number {
		return project.placeholders?.length ?? 0;
	}

	protected percent(project: Project): number {
		const total = this.total(project);

		return total ? Math.round((this.filled(project) / total) * 100) : 0;
	}

	/**
	 * Opens the folder dialog of the desktop app and checks the choice. It has to be a Unity project; a
	 * missing assetra.json is prepared, not an error. Nothing is written or sent until the developer confirms.
	 */
	protected async pickFolder() {
		if (this.picking()) {
			return;
		}

		this.picking.set(true);
		this.addError.set('');

		try {
			const result = await AssetraProject.pickProject();

			if (result.canceled) {
				return;
			}

			if (!result.isUnity) {
				this.picked.set(null);
				this.addError.set(`Це не Unity-проєкт: у папці немає ${result.missing.join(', ')}. Оберіть корінь проєкту, де лежить папка Assets.`);
				return;
			}

			this.picked.set(pickedFromInspection(result));
		} catch (error) {
			this.picked.set(null);
			this.addError.set(error instanceof Error ? error.message : 'Не вдалося відкрити папку.');
		} finally {
			this.picking.set(false);
		}
	}

	protected async confirmAdd() {
		const picked = this.picked();

		if (!picked || this.adding()) {
			return;
		}

		this.adding.set(true);
		this.addError.set('');

		try {
			if (picked.create) {
				await AssetraProject.writeAssetra({ path: picked.folder, content: picked.content });
			}

			await this.projectsService.addFromFile(picked);
			rememberProjectFolder(picked.slug, picked.folder);
			this.picked.set(null);
			await this._router.navigate(['/project', picked.slug]);
		} catch (error) {
			this.addError.set(error instanceof Error ? error.message : 'Не вдалося додати проєкт.');
		} finally {
			this.adding.set(false);
		}
	}

	protected cancelAdd() {
		this.picked.set(null);
		this.addError.set('');
	}

	private async _load() {
		await this.auth.ready;

		if (!this.auth.isLoggedIn()) {
			this.loading.set(false);
			return;
		}

		try {
			await this.projectsService.loadProjects();
		} catch (error) {
			this.error.set(error instanceof ProjectsError ? error.message : 'Не вдалося завантажити проєкти.');
		} finally {
			this.loading.set(false);
		}
	}
}
