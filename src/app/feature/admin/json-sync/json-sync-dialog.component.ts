import { Component, ElementRef, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import type { EditorView } from '@codemirror/view';

/** What a check of the edited JSON found; `summary` explains what a sync would change. */
export interface JsonSyncCheck {
	error?: string;
	summary?: string;
}

/**
 * «Синхронізація»: the whole list as one JSON document in a code editor. Edit it or paste JSON
 * written by an AI chat, check it, then sync; entries missing from the JSON are deleted.
 * CodeMirror is loaded only when the dialog opens.
 */
@Component({
	selector: 'app-json-sync-dialog',
	template: `
		<dialog
			#dialog
			class="m-auto w-[min(72rem,calc(100vw-2rem))] max-w-none rounded-[calc(var(--radius-card)*2)] border border-[var(--c-border)] bg-[var(--c-bg-secondary)] p-0 text-[var(--c-text)] shadow-[var(--shadow-md)] backdrop:bg-[#1e201b]/60"
			aria-labelledby="json-sync-title"
			(close)="_onClosed()"
		>
			<div class="p-6 sm:p-8">
				<div class="flex items-start justify-between gap-4">
					<h2 id="json-sync-title" class="text-2xl font-semibold tracking-[-0.02em] text-[var(--c-text-strong)]">{{ heading() }}</h2>
					<button
						class="theme-interactive theme-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--c-text-muted)] hover:bg-[var(--c-bg-tertiary)] hover:text-[var(--c-text-strong)]"
						type="button"
						aria-label="Закрити"
						(click)="close()"
					>
						<span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
					</button>
				</div>
				<p class="mt-2 text-sm text-[var(--c-text-muted)]">{{ description() }}</p>

				<div
					#editorHost
					class="mt-5 h-[min(60vh,32rem)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--c-border)] bg-[#282c34] text-sm [&_.cm-editor]:h-full [&_.cm-editor.cm-focused]:outline-none [&_.cm-scroller]:font-mono"
					role="group"
					aria-label="JSON"
				>
					@if (!ready()) {
						<p class="p-4 text-[#abb2bf]" role="status">Завантаження редактора…</p>
					}
				</div>

				@if (check(); as result) {
					<p
						class="mt-4 rounded-[var(--radius-btn)] px-3 py-2.5 text-sm"
						[class]="result.error ? 'bg-[#a23b2a]/10 text-[#a23b2a]' : 'bg-[var(--c-bg-tertiary)] text-[var(--c-text-strong)]'"
						role="status"
					>
						{{ result.error ?? result.summary }}
					</p>
				}

				<div class="mt-6 flex flex-wrap justify-end gap-3">
					<button
						class="theme-interactive theme-focus inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-bg-primary)] px-5 font-semibold text-[var(--c-text-strong)] hover:border-[var(--c-primary)]"
						type="button"
						(click)="close()"
					>
						<span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
						Закрити
					</button>
					<button
						class="theme-interactive theme-focus inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-bg-primary)] px-5 font-semibold text-[var(--c-text-strong)] hover:border-[var(--c-primary)] disabled:opacity-60"
						type="button"
						[disabled]="!ready()"
						(click)="runCheck()"
					>
						<span class="material-symbols-outlined text-[20px]" aria-hidden="true">checklist</span>
						Перевірити
					</button>
					<button
						class="theme-interactive theme-focus inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--c-primary)] px-5 font-semibold text-[var(--c-on-primary)] hover:bg-[var(--c-primary-hover)] disabled:opacity-60"
						type="button"
						[disabled]="!ready()"
						(click)="sync()"
					>
						<span class="material-symbols-outlined text-[20px]" aria-hidden="true">sync</span>
						Синхронізувати
					</button>
				</div>
			</div>
		</dialog>
	`,
})
export class JsonSyncDialogComponent implements OnDestroy {
	readonly heading = input('Синхронізація');
	readonly description = input.required<string>();
	/** Builds the JSON shown when the dialog opens. */
	readonly source = input.required<() => unknown>();
	/** Parses and checks the text; must not change anything. */
	readonly validate = input.required<(text: string) => JsonSyncCheck>();
	/** Emits the checked text when the user confirms the sync. */
	readonly synced = output<string>();

	private readonly _dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
	private readonly _host = viewChild.required<ElementRef<HTMLElement>>('editorHost');
	protected readonly ready = signal(false);
	protected readonly check = signal<JsonSyncCheck | null>(null);
	private _view?: EditorView;

	async open() {
		this.check.set(null);
		this._dialog().nativeElement.showModal();

		const [{ EditorView, basicSetup }, { json }, { oneDark }] = await Promise.all([
			import('codemirror'),
			import('@codemirror/lang-json'),
			import('@codemirror/theme-one-dark'),
		]);

		this._view?.destroy();
		this._view = new EditorView({
			doc: `${JSON.stringify(this.source()(), null, 2)}\n`,
			extensions: [basicSetup, json(), oneDark, EditorView.lineWrapping],
			parent: this._host().nativeElement,
		});
		this.ready.set(true);
		this._view.focus();
	}

	close() {
		this._dialog().nativeElement.close();
	}

	protected runCheck() {
		this.check.set(this.validate()(this._text()));
	}

	protected sync() {
		const text = this._text();
		const result = this.validate()(text);

		this.check.set(result);

		if (result.error || !confirm(`${result.summary ?? ''}\n\nСинхронізувати?`)) {
			return;
		}

		this.synced.emit(text);
		this.close();
	}

	protected _onClosed() {
		this._view?.destroy();
		this._view = undefined;
		this.ready.set(false);
	}

	ngOnDestroy() {
		this._view?.destroy();
	}

	private _text(): string {
		return this._view?.state.doc.toString() ?? '';
	}
}
