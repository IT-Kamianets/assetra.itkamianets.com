const KEY = 'assetra.projectFolders';

function _read(): Record<string, string> {
	try {
		const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');

		return value && typeof value === 'object' ? value : {};
	} catch {
		return {};
	}
}

/** The folder a project was added from on this PC, or '' when it is not known here. */
export function projectFolder(slug: string): string {
	const folder = _read()[slug];

	return typeof folder === 'string' ? folder : '';
}

export function rememberProjectFolder(slug: string, folder: string): void {
	try {
		localStorage.setItem(KEY, JSON.stringify({ ..._read(), [slug]: folder }));
	} catch {
		// Without storage the folder is just asked for again.
	}
}
