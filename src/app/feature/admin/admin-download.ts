/** Saves data as a tab-indented JSON file, matching the files in `src/data/`. Browser only. */
export function downloadJson(fileName: string, data: unknown) {
	const blob = new Blob([`${JSON.stringify(data, null, '\t')}\n`], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}
