import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, effect, inject, Injector, PLATFORM_ID, Service, untracked } from '@angular/core';
import { LanguageService } from '@wawjs/ngx-translate';

type Dictionary = Record<string, string>;
interface Pattern {
	regex: RegExp;
	english: string;
}

const ATTRIBUTES = ['placeholder', 'aria-label', 'alt', 'title'];
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE']);
const MONTHS: Record<string, string> = {
	січня: 'January',
	лютого: 'February',
	березня: 'March',
	квітня: 'April',
	травня: 'May',
	червня: 'June',
	липня: 'July',
	серпня: 'August',
	вересня: 'September',
	жовтня: 'October',
	листопада: 'November',
	грудня: 'December',
};
const LONG_DATE = new RegExp(`^(\\d{1,2}) (${Object.keys(MONTHS).join('|')}) (\\d{4})(?: р\\.)?$`);

/**
 * Shows the whole site in English. The pages are written in Ukrainian, so while English is the active
 * language this service replaces every Ukrainian text node and text attribute with the English one from
 * `src/data/i18n/en.json` and keeps doing it as Angular renders new content. Switching back to Ukrainian
 * restores the original text. The dictionary is loaded only when English is first chosen.
 *
 * A dictionary key may contain `{0}`, `{1}`… placeholders for values rendered inside the sentence.
 */
@Service()
export class DomTranslatorService {
	private readonly _document = inject(DOCUMENT);
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly _languages = inject(LanguageService);
	private readonly _appRef = inject(ApplicationRef);
	private readonly _injector = inject(Injector);

	private _exact = new Map<string, string>();
	private _patterns: Pattern[] = [];
	private _observer?: MutationObserver;
	private _active = false;
	/** Ukrainian text of a node, and what we wrote into it, so our own writes are not translated twice. */
	private readonly _originalText = new WeakMap<Node, string>();
	private readonly _writtenText = new WeakMap<Node, string>();
	private readonly _originalAttrs = new WeakMap<Element, Map<string, string>>();
	private readonly _writtenAttrs = new WeakMap<Element, Map<string, string>>();
	private _dictionary?: Promise<void>;

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		// Wait for hydration so the page is not changed underneath Angular while it attaches.
		void this._appRef.whenStable().then(() => {
			effect(
				() => {
					const language = this._languages.language();

					untracked(() => void this._apply(language === 'en'));
				},
				{ injector: this._injector },
			);
		});
	}


	/** English text for a Ukrainian one (used for browser dialogs and other text outside the page). */
	translate(text: string): string {
		return this._active ? this._lookup(text) : text;
	}

	private async _apply(english: boolean) {
		if (english) {
			this._dictionary ??= this._loadDictionary();
			await this._dictionary;

			if (this._languages.language() !== 'en') {
				return;
			}

			this._active = true;
			this._translateTree(this._document.documentElement);
			this._observe();
			return;
		}

		if (!this._active) {
			return;
		}

		this._active = false;
		this._observer?.disconnect();
		this._observer = undefined;
		this._restoreTree(this._document.documentElement);
	}

	private async _loadDictionary() {
		const dictionary = (await import('../../../data/i18n/en.json')).default as Dictionary;

		for (const [ukrainian, english] of Object.entries(dictionary)) {
			if (/\{\d+\}/.test(ukrainian)) {
				const source = ukrainian
					.split(/\{\d+\}/)
					.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
					.join('(.+?)');

				this._patterns.push({ regex: new RegExp(`^${source}$`, 's'), english });
			} else {
				this._exact.set(ukrainian, english);
			}
		}

		// Longer patterns first so the most specific sentence wins.
		this._patterns.sort((a, b) => b.regex.source.length - a.regex.source.length);
	}

	private _observe() {
		this._observer?.disconnect();
		this._observer = new MutationObserver((records) => {
			for (const record of records) {
				if (record.type === 'characterData') {
					this._translateText(record.target as Text);
				} else if (record.type === 'attributes') {
					this._translateAttribute(record.target as Element, record.attributeName ?? '');
				} else {
					record.addedNodes.forEach((node) => this._translateTree(node));
				}
			}
		});
		this._observer.observe(this._document.documentElement, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ATTRIBUTES,
		});
	}

	private _translateTree(root: Node) {
		if (root.nodeType === Node.TEXT_NODE) {
			this._translateText(root as Text);
			return;
		}

		if (root.nodeType !== Node.ELEMENT_NODE || SKIPPED_TAGS.has((root as Element).tagName)) {
			return;
		}

		this._translateElementAttributes(root as Element);

		const walker = this._document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);

		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (!SKIPPED_TAGS.has((node.parentElement as Element | null)?.tagName ?? '')) {
					this._translateText(node as Text);
				}
			} else {
				this._translateElementAttributes(node as Element);
			}
		}
	}

	private _translateText(node: Text) {
		const current = node.data;

		// Our own write: nothing to do. Anything else is new Ukrainian text from Angular.
		if (this._writtenText.get(node) === current) {
			return;
		}

		if (SKIPPED_TAGS.has(node.parentElement?.tagName ?? '')) {
			return;
		}

		const core = current.trim();

		if (!core || !/[\u0400-\u04FF]/.test(core)) {
			return;
		}

		const english = this._lookup(core);

		if (english === core) {
			return;
		}

		const start = current.slice(0, current.length - current.trimStart().length);
		const end = current.slice(current.trimEnd().length);
		const next = start + english + end;

		this._originalText.set(node, current);
		this._writtenText.set(node, next);
		node.data = next;
	}

	private _translateElementAttributes(element: Element) {
		for (const name of ATTRIBUTES) {
			if (element.hasAttribute(name)) {
				this._translateAttribute(element, name);
			}
		}
	}

	private _translateAttribute(element: Element, name: string) {
		const value = element.getAttribute(name);

		if (!value || !/[\u0400-\u04FF]/.test(value) || this._writtenAttrs.get(element)?.get(name) === value) {
			return;
		}

		const english = this._lookup(value.trim());

		if (english === value.trim()) {
			return;
		}

		this._store(this._originalAttrs, element, name, value);
		this._store(this._writtenAttrs, element, name, english);
		element.setAttribute(name, english);
	}

	private _store(map: WeakMap<Element, Map<string, string>>, element: Element, name: string, value: string) {
		const values = map.get(element) ?? new Map<string, string>();

		values.set(name, value);
		map.set(element, values);
	}

	private _restoreTree(root: Node) {
		const walker = this._document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);

		for (let node: Node | null = root; node; node = walker.nextNode()) {
			if (node.nodeType === Node.TEXT_NODE) {
				const original = this._originalText.get(node);

				if (original !== undefined && this._writtenText.get(node) === (node as Text).data) {
					(node as Text).data = original;
				}

				this._originalText.delete(node);
				this._writtenText.delete(node);
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const element = node as Element;

				this._originalAttrs.get(element)?.forEach((original, name) => {
					if (this._writtenAttrs.get(element)?.get(name) === element.getAttribute(name)) {
						element.setAttribute(name, original);
					}
				});
				this._originalAttrs.delete(element);
				this._writtenAttrs.delete(element);
			}
		}
	}

	/** Dictionary lookup: whole text, then sentences with placeholders, then the parts of joined texts. */
	private _lookup(text: string, depth = 0): string {
		const clean = text.replace(/\s+/g, ' ').trim();
		const exact = this._exact.get(clean);

		if (exact !== undefined) {
			return exact;
		}

		// "12 моделей" and similar: Ukrainian plural forms are built in code, so they are not dictionary keys.
		const plural = /^([\d\s\u00a0.,]+)\s(?:модель|моделі|моделей)$/.exec(clean);

		if (plural) {
			const count = plural[1].trim();

			return `${count} ${count === '1' ? 'model' : 'models'}`;
		}

		// Long Ukrainian dates ("26 жовтня 2026 р.") from Intl.DateTimeFormat('uk-UA').
		const date = LONG_DATE.exec(clean);

		if (date) {
			return `${MONTHS[date[2]]} ${date[1]}, ${date[3]}`;
		}

		// Numbered headings are rendered as "1. Text".
		const numbered = /^(\d+\.\s)(.+)$/.exec(clean);

		if (numbered) {
			const rest = this._lookup(numbered[2], depth + 1);

			if (rest !== numbered[2]) {
				return numbered[1] + rest;
			}
		}

		for (const { regex, english } of this._patterns) {
			const match = regex.exec(clean);

			if (match) {
				return english.replace(/\{(\d+)\}/g, (_, index) => {
					const value = match[+index + 1] ?? '';

					return depth < 2 ? this._lookup(value, depth + 1) : value;
				});
			}
		}

		// "Page | Site" titles and "61 000 полігонів · Rigged" spec lines are joined from separate texts.
		for (const separator of [' | ', ' · ', ', ']) {
			if (clean.includes(separator)) {
				return clean
					.split(separator)
					.map((part) => this._lookup(part, depth + 1))
					.join(separator);
			}
		}

		// Counts inside longer texts: "Київ · 24 моделі".
		const counted = clean.replace(/(\d[\d\s\u00a0]*) (?:модель|моделі|моделей)/g, (_, count: string) =>
			`${count} ${count.trim() === '1' ? 'model' : 'models'}`,
		);

		return counted === clean ? text : counted;
	}
}
