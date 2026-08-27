import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';

export interface CredentialOfferDialogData {
  credentialOfferUri: string;
}

/**
 * Shown after a successful issuance whose only delivery mode is `ui`: nothing to do but scan.
 *
 * Selections with more than one mode — or any selection including `direct` — go to
 * `IssuanceResultDialogComponent` instead, which renders one box per mode.
 */
@Component({
    selector: 'app-credential-offer-dialog',
    imports: [
        MatButton,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        CredentialOfferQrComponent,
        TranslatePipe,
    ],
    templateUrl: './credential-offer-dialog.component.html',
    styleUrl: './credential-offer-dialog.component.scss'
})
export class CredentialOfferDialogComponent {
  public readonly data = inject<CredentialOfferDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CredentialOfferDialogComponent>);

  public close(): void {
    this.dialogRef.close();
  }
}
