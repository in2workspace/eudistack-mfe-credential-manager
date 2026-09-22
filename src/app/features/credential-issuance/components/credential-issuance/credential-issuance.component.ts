
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatLabel } from '@angular/material/form-field';
import { Component, inject, WritableSignal, Signal } from '@angular/core';
import { MatFormField, MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { DynamicFieldComponent } from '../dynamic-field/dynamic-field.component';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TitleCasePipe, KeyValuePipe, CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, CanDeactivate, RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { CanComponentDeactivate, CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';
import { guardUnloadWhileUnsaved } from 'src/app/shared/services/unsaved-changes.service';
import { AlertBannerComponent } from 'src/app/shared/components/alert-banner/alert-banner.component';
import { CredentialIssuanceService } from '../../services/credential-issuance.service';
import { KeyGeneratorService } from '../../services/key-generator.service';
import { IssuanceHolderKeyService } from '../../services/issuance-holder-key.service';
import { CredentialFormatOption, CredentialIssuanceViewModelSchemaWithId, DeliveryModeOption, DeliveryModeToken, GrantTypeOption, IssuanceCredentialType, IssuanceStaticViewModel } from 'src/app/core/models/entity/lear-credential-issuance';

/**
 * CredentialIssuanceComponent
 * - Renders a credential type selector. When a type is selected, a form corresponding to this type is built and rendered
 * - If the form has been touched, an alert is shown if the user tries to change the selected type or leave the page
 */
@Component({
    selector: 'app-credential-issuance',
    // EUD-233 AD-6: KeyGeneratorService and IssuanceHolderKeyService live at this level, never
    // root -- the narrowest injector shared by the form and its application service, so the
    // private key material they handle cannot outlive the form. Inherited from the deleted
    // KeyGeneratorComponent, which used to be the (wrong, component-local) home for the first one.
    providers: [CredentialIssuanceService, KeyGeneratorService, IssuanceHolderKeyService],
    imports: [AlertBannerComponent, CommonModule, KeyValuePipe, ReactiveFormsModule, DynamicFieldComponent, MatButton, MatCard, MatCardContent, MatCheckbox, MatFormField, MatLabel, MatOption, MatProgressSpinner, MatRadioButton, MatRadioGroup, MatSelect, RouterLink, TitleCasePipe, TranslatePipe],
    templateUrl: './credential-issuance.component.html',
    styleUrl: './credential-issuance.component.scss'
})
export class CredentialIssuanceComponent implements CanDeactivate<CanComponentDeactivate>{

  //CREDENTIAL TYPE SELECTOR
  public readonly credentialTypesArr$: Signal<IssuanceCredentialType[]>;
  public readonly isCatalogUnavailable$: Signal<boolean>;
  public readonly isLoadingCatalog$: Signal<boolean>;
  public selectedCredentialType$: WritableSignal<IssuanceCredentialType | undefined>;

  // FORMAT SELECTOR
  public availableFormats$: Signal<CredentialFormatOption[]>;
  public effectiveFormatOption$: Signal<CredentialFormatOption | null>;

  // GRANT TYPE SELECTOR
  public readonly grantTypeOptions: Readonly<GrantTypeOption[]>;
  public selectedGrantType$: WritableSignal<GrantTypeOption>;

  // DELIVERY SELECTOR (EUD-233 AD-4/AD-13: three independent checkboxes, not a radio group)
  public readonly offerableModes$: Signal<readonly DeliveryModeOption[]>;
  public selectedDeliveryModes$: WritableSignal<ReadonlySet<DeliveryModeToken>>;
  public readonly hasDeliveryCatalogReadFailed$: Signal<boolean>;

  // FORM STATE
  public formSchema$: Signal<CredentialIssuanceViewModelSchemaWithId | null>;

  public staticData$: Signal<IssuanceStaticViewModel | null>;
  public form$: Signal <FormGroup<Record<string, FormGroup>>>;
  public formValue$: Signal<Record<string, any>>;
  public isFormValid$: Signal<boolean>;

  public onBehalf$: WritableSignal<boolean>;
  public hasSubmitted$: WritableSignal<boolean>;

  public bottomAlertMessages$: WritableSignal<string[]>;


  private readonly issuanceService = inject(CredentialIssuanceService);
  private readonly route = inject(ActivatedRoute);

  public constructor(){
    const onBehalf = this.route.snapshot.pathFromRoot
        .flatMap(r => r.url)
        .map(seg => seg.path)
        .includes('create-on-behalf');
    this.issuanceService.onBehalf$.set(onBehalf);
    this.onBehalf$ = this.issuanceService.onBehalf$;
    this.hasSubmitted$ = this.issuanceService.hasSubmitted$;
    this.credentialTypesArr$ = this.issuanceService.credentialTypesArr$;
    this.isCatalogUnavailable$ = this.issuanceService.isCatalogUnavailable$;
    this.isLoadingCatalog$ = this.issuanceService.isLoadingCatalog$;
    this.selectedCredentialType$ = this.issuanceService.selectedCredentialType$;
    this.availableFormats$ = this.issuanceService.availableFormats$;
    this.effectiveFormatOption$ = this.issuanceService.effectiveFormatOption$;
    this.grantTypeOptions = this.issuanceService.grantTypeOptions;
    this.selectedGrantType$ = this.issuanceService.selectedGrantType$;
    this.offerableModes$ = this.issuanceService.offerableModes$;
    this.selectedDeliveryModes$ = this.issuanceService.selectedDeliveryModes$;
    this.hasDeliveryCatalogReadFailed$ = this.issuanceService.hasDeliveryCatalogReadFailed$;
    this.formSchema$ = this.issuanceService.credentialFormSchema$;
    this.staticData$ = this.issuanceService.staticData$;
    this.form$ = this.issuanceService.form$;
    this.formValue$ = this.issuanceService.formValue$;
    this.isFormValid$ = this.issuanceService.isFormValid$;
    this.bottomAlertMessages$ = this.issuanceService.bottomAlertMessages$;

    guardUnloadWhileUnsaved(() => !this.canLeave());
  }

  public onTypeSelectionChange(selectedCredentialType: IssuanceCredentialType, select: MatSelect): void {
    this.issuanceService.updateSelectedType(selectedCredentialType, select);
  }

  public onFormatSelectionChange(option: CredentialFormatOption): void {
    this.issuanceService.updateSelectedFormat(option);
  }

  public onGrantTypeSelectionChange(option: GrantTypeOption): void {
    this.issuanceService.updateSelectedGrantType(option);
  }

  public onDeliveryModeToggle(token: DeliveryModeToken, checked: boolean, checkbox: MatCheckbox): void {
    const selectedModes = this.selectedDeliveryModes$();

    // Prevent removing the last selected delivery mode. MatCheckbox already flips its own
    // internal state on click before this handler runs; since the bound [checked] expression
    // re-evaluates to the same value (true) when we don't touch the model, Angular's dirty
    // check skips re-applying it, leaving the checkbox visually unchecked. Revert it explicitly.
    if (!checked && selectedModes.size === 1 && selectedModes.has(token)) {
      checkbox.checked = true;
      return;
    }

    this.issuanceService.toggleDeliveryMode(token, checked);
  }

  public canLeave(): boolean{
    return this.issuanceService.canLeave();
  }

  public canDeactivate(): CanDeactivateType {
    return this.issuanceService.canDeactivate();
  }

  /** ES-01: an empty delivery selection must never reach submit, and never auto-marks a mode. */
  public isSubmitDisabled(): boolean {
    return !this.isFormValid$() || this.selectedDeliveryModes$().size === 0;
  }

  public onSubmit(): void {
    const isFormValid = this.isFormValid$();
    if (!isFormValid || this.selectedDeliveryModes$().size === 0) {
      // Do not dump formValue$(): it's the holder's data (PII) — must never end up in the console.
      console.error('Invalid form or no delivery mode selected: ');
      return;
    }

    this.issuanceService.openSubmitDialog();
  }


}
