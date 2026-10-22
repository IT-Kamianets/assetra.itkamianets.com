import { Service } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Sends visitor messages to the shared backend, which forwards them to the company's Telegram.
 * Contract: POST {apiUrl}/api/telegram/contact with `{ slug: companyId, message }`.
 */
@Service()
export class ContactService {
	async send(message: string): Promise<void> {
		const response = await fetch(`${environment.apiUrl}/api/telegram/contact`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slug: environment.companyId, message }),
		});

		if (!response.ok) {
			throw new Error(`Contact request failed with status ${response.status}`);
		}
	}
}
