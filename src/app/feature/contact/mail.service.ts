import { Service } from '@angular/core';

/** Mailbox that receives the letters written from the site. */
export const CONTACT_EMAIL = 'kn1b23.siruk@kpnu.edu.ua';

export interface MailMessage {
	name: string;
	email: string;
	message: string;
}

/**
 * Sends a letter to `CONTACT_EMAIL` through FormSubmit (formsubmit.co), which forwards form posts as
 * email, so the static site needs no mail server. The first letter makes FormSubmit email a
 * confirmation link to the mailbox; letters arrive once it is confirmed. The visitor's address is
 * set as Reply-To, so answering the letter replies to them.
 */
@Service()
export class MailService {
	async send(mail: MailMessage): Promise<void> {
		const response = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				name: mail.name,
				email: mail.email,
				message: mail.message,
				_subject: `Assetra: повідомлення від ${mail.name}`,
				_replyto: mail.email,
				_template: 'table',
				_captcha: 'false',
			}),
		});
		const body = (await response.json().catch(() => null)) as { success?: string | boolean } | null;

		if (!response.ok || !(body?.success === true || body?.success === 'true')) {
			throw new Error(`Mail request failed with status ${response.status}`);
		}
	}
}
