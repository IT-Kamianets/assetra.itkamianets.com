import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

let _db: Promise<Firestore> | undefined;

/** Firestore of the site's Firebase project, loaded on first use. Browser only. */
export function getDb(): Promise<Firestore> {
	_db ??= Promise.all([import('firebase/app'), import('firebase/firestore')]).then(
		([{ getApps, initializeApp }, { getFirestore }]) => getFirestore(getApps()[0] ?? initializeApp(environment.firebase)),
	);

	return _db;
}

/** Firebase ID token of the signed-in user: the API server rejects uploads and deletes without it (401 "missing token"). */
async function _authHeader(): Promise<Record<string, string>> {
	const [{ getApps }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
	const app = getApps()[0];
	const token = app ? await getAuth(app).currentUser?.getIdToken() : '';

	return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Sent through the API server: the R2 bucket does not accept uploads straight from the browser. */
export async function uploadFile(file: File, mime: string, name: string): Promise<{ id: string; publicUrl: string }> {
	const response = await fetch(`${environment.apiUrl}/api/cloudflare/upload-base64`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(await _authHeader()) },
		body: JSON.stringify({ container: environment.uploadContainer, name, mime, base64: await _toBase64(file) }),
	});
	const body = (await response.json().catch(() => null)) as { ok?: boolean; id: string; publicUrl: string } | null;

	if (!response.ok || !body?.ok || !body.publicUrl) {
		throw new Error(`Upload failed: HTTP ${response.status}`);
	}

	return { id: body.id, publicUrl: body.publicUrl };
}

/** Best effort: the API only remembers uploads until it restarts. */
export async function deleteFile(id: string) {
	return fetch(`${environment.apiUrl}/api/cloudflare/${encodeURIComponent(id)}`, { method: 'DELETE', headers: await _authHeader() }).catch(() => undefined);
}

function _toBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
