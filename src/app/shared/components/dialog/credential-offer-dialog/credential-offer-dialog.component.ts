import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';

export interface CredentialOfferDialogData {
  credentialOfferUri: string;
}

@Component({
    selector: 'app-credential-offer-dialog',
    imports: [
        MatButton,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatIcon,
        QRCodeComponent,
        TranslatePipe,
    ],
    templateUrl: './credential-offer-dialog.component.html',
    styleUrl: './credential-offer-dialog.component.scss'
})
export class CredentialOfferDialogComponent {
  public readonly data = inject<CredentialOfferDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CredentialOfferDialogComponent>);

  public copied = false;
  public readonly qrColor = '#000000';

  public copyOfferUri(): void {
    navigator.clipboard.writeText(this.data.credentialOfferUri);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  public close(): void {
    this.dialogRef.close();
  }
}