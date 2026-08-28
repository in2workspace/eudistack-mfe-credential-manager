import { Component, inject, OnDestroy, OnInit, Signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';
import { KeyGeneratorService } from '../../services/key-generator.service';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { KeyForm, KeyState } from 'src/app/core/models/entity/lear-credential-issuance';
import { IssuanceCustomFormChildWithAlert } from 'src/app/features/credential-details/components/issuance-custom-form-child';
import { FormGroup } from '@angular/forms';

@Component({
    selector: 'app-key-generator',
    imports: [KeyValuePipe, MatButton, MatIcon, MatTooltip, TranslatePipe],
    providers: [KeyGeneratorService],
    templateUrl: './key-generator.component.html',
    styleUrl: './key-generator.component.scss'
})
export class KeyGeneratorComponent extends IssuanceCustomFormChildWithAlert<FormGroup<KeyForm>> implements OnInit, OnDestroy{
  public keyState$: Signal<KeyState | undefined>;
  public displayedKeys$: Signal<Partial<KeyState> | undefined>;
  public copiedKey = "";
  private readonly alertMessages = ["error.form.no_key"];

  private readonly keyService = inject(KeyGeneratorService);
  private readonly holderKeyStore = inject(HolderKeyStoreService);

  public constructor(){
    super();
    this.keyState$ = this.keyService.getState();
    this.displayedKeys$ = this.keyService.displayedKeys$;
  }

  public ngOnInit(){
    this.updateAlertMessages(this.alertMessages);
  }

  public ngOnDestroy(){
    this.cleanUpAlertMessages();
  }

  public async generateKeys(): Promise<void>{
    const isFirstKeyUpdate = this.keyState$();
    await this.keyService.generateP256();
    this.form().patchValue({ didKey:this.keyState$()?.desmosDidKeyValue });
    // EUD-168 AD-8: hand the public half to the issuance request. Regenerating overwrites it, so
    // the key that travels is always the one whose private half the Operator is looking at.
    const publicJwk = this.keyState$()?.desmosPublicJwk;
    if (publicJwk) {
      this.holderKeyStore.set(publicJwk);
    }
    if(!isFirstKeyUpdate){
      this.updateAlertMessages(this.alertMessages)
    }
  }

  public copyToClipboard(text:string): void{
    navigator.clipboard.writeText(text);
    this.copiedKey = text;
    setTimeout(() => this.resetCopiedKey(), 2000);
  }

  private resetCopiedKey(): void{
    this.copiedKey = "";
  }

  private cleanUpAlertMessages(): void{
    if(!this.keyState$()){
      this.updateAlertMessages(this.alertMessages);
    }
  }
}
