import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { trimmedEmail } from '../auth/email-validator';
import { MailService } from './mail.service';

type State = 'idle' | 'sending' | 'sent' | 'error';

/** "Write to us" window opened from the footer: a letter is sent to the site owner's mailbox. */
@Component({
	selector: 'app-contact-dialog',
	imports: [ReactiveFormsModule],
	templateUrl: './contact-dialog.component.html',
})
export class ContactDialogComponent {
	private readonly _mail = inject(MailService);
	private readonly _fb = inject(NonNullableFormBuilder);
	private readonly _dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

	protected readonly form = this._fb.group({
		name: this._fb.control('', [Validators.required, Validators.maxLength(80)]),
		email: this._fb.control('', [Validators.required, trimmedEmail]),
		message: this._fb.control('', [Validators.required, Validators.minLength(5), Validators.maxLength(3000)]),
	});
	protected readonly state = signal<State>('idle');
	protected readonly submitted = signal(false);

	open() {
		this.state.set('idle');
		this.submitted.set(false);

		if (!this._dialog().nativeElement.open) {
			this._dialog().nativeElement.showModal();
		}
	}

	protected close() {
		this._dialog().nativeElement.close();
	}

	protected onBackdrop(event: MouseEvent) {
		// A click on the <dialog> element itself (not its content) is a click on the backdrop.
		if (event.target === this._dialog().nativeElement) {
			this.close();
		}
	}

	protected showError(name: 'name' | 'email' | 'message'): boolean {
		const control = this.form.controls[name];

		return control.invalid && (control.touched || this.submitted());
	}

	protected async submit() {
		this.submitted.set(true);
		this.form.markAllAsTouched();

		if (this.form.invalid || this.state() === 'sending') {
			return;
		}

		this.state.set('sending');

		const { name, email, message } = this.form.getRawValue();

		try {
			await this._mail.send({ name: name.trim(), email: email.trim(), message: message.trim() });
			this.state.set('sent');
			this.form.reset();
			this.submitted.set(false);
		} catch (error) {
			console.error(error);
			this.state.set('error');
		}
	}
}
