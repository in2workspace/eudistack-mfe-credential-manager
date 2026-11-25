import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { countCodePoints, truncateToCodePoints } from 'src/app/core/helpers/code-points';
import { toRevocationFailure } from '../../helpers/revocation-error';

/** What the dialog closes with when the attestation ends up revoked; a cancelled dialog closes with nothing. */
export type RevokeCredentialDialogResult = 'revoked' | 'alreadyRevoked';

export interface RevokeCredentialDialogData {
  /** Asks the API to revoke with the operator's reason; the dialog translates the error it fails with. */
  submit: (reason: string) => Observable<void>;
}

/** The longest reason the revocation API accepts, counted in code points like the Issuer does. */
export const MAX_REVOCATION_REASON_LENGTH = 280;

@Component({
  selector: 'app-revoke-credential-dialog',
  imports: [MatButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatProgressSpinner, TranslatePipe],
  templateUrl: './revoke-credential-dialog.component.html',
  styleUrl: './revoke-credential-dialog.component.scss',
})
export class RevokeCredentialDialogComponent {
  protected readonly maxLength = MAX_REVOCATION_REASON_LENGTH;

  private readonly data = inject<RevokeCredentialDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RevokeCredentialDialogComponent, RevokeCredentialDialogResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly reason = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly remaining = computed(() => this.maxLength - countCodePoints(this.reason()));
  protected readonly canConfirm = computed(() => !this.submitting() && this.reason().trim().length > 0);

  protected onReasonInput(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    // `maxlength` counts UTF-16 units, so a pasted text is cut here, by code points.
    const reason = truncateToCodePoints(field.value, this.maxLength);
    if (reason !== field.value) {
      field.value = reason;
    }
    this.reason.set(reason);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.submitting.set(true);
    this.errorKey.set(null);
    this.dialogRef.disableClose = true;

    this.data.submit(this.reason().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close('revoked'),
        error: (error: unknown) => this.handleFailure(error),
      });
  }

  private handleFailure(error: unknown): void {
    const failure = toRevocationFailure(error);
    if (failure.alreadyRevoked) {
      this.dialogRef.close('alreadyRevoked');
      return;
    }
    this.errorKey.set(failure.messageKey);
    this.submitting.set(false);
    this.dialogRef.disableClose = false;
  }
}
