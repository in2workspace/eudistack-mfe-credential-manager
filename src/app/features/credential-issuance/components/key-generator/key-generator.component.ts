import { Component, inject, OnDestroy, OnInit, Signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';
import { KeyGeneratorService } from '../../services/key-generator.service';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { DisplayedKeyState, KeyForm, KeyState } from 'src/app/core/models/entity/lear-credential-issuance';
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
  // EUD-168 AC-19 / NFR-S-EUD168-04: the private key must not linger in the clipboard past this
  // window. Chosen, not normative -- see acceptance-criteria.md §4.
  private static readonly CLIPBOARD_CLEAR_TIMEOUT_MS = 60_000;

  public keyState$: Signal<KeyState | undefined>;
  public displayedKeys$: Signal<DisplayedKeyState | undefined>;
  public copiedKey = "";
  private readonly alertMessages = ["error.form.no_key"];
  private clipboardClearTimer?: ReturnType<typeof setTimeout>;

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
    // EUD-168 AC-19: the private key must not outlive the form it was generated for.
    this.keyService.clearState();
    this.clearClipboardTimer();
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
    this.scheduleClipboardClear();
  }

  private resetCopiedKey(): void{
    this.copiedKey = "";
  }

  /**
   * Independent from the 2s copy-feedback timer above: that one resets the button's visual state,
   * this one overwrites the clipboard itself (AC-19, NFR-S-EUD168-04). Restarted, not stacked, on
   * every copy -- without a `clipboard-read` permission the component cannot check whether the
   * clipboard still holds the key it wrote, so a later copy always wins over an earlier pending clear.
   */
  private scheduleClipboardClear(): void {
    this.clearClipboardTimer();
    this.clipboardClearTimer = setTimeout(
      () => navigator.clipboard.writeText(''),
      KeyGeneratorComponent.CLIPBOARD_CLEAR_TIMEOUT_MS
    );
  }

  private clearClipboardTimer(): void {
    if (this.clipboardClearTimer !== undefined) {
      clearTimeout(this.clipboardClearTimer);
      this.clipboardClearTimer = undefined;
    }
  }

  private cleanUpAlertMessages(): void{
    if(!this.keyState$()){
      this.updateAlertMessages(this.alertMessages);
    }
  }
}
