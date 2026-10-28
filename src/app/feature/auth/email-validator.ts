import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

/**
 * Email check that ignores surrounding spaces. Phone keyboards often append a space after an
 * autocompleted address, which the stock Validators.email rejects although AuthService trims it.
 */
export function trimmedEmail(control: AbstractControl<string>): ValidationErrors | null {
	return Validators.email({ value: String(control.value ?? '').trim() } as AbstractControl);
}
