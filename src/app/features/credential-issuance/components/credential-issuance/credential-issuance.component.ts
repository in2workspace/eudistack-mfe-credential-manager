
import { MatButton } from '@angular/material/button';
import { MatLabel } from '@angular/material/form-field';
import { Component, inject, WritableSignal, HostListener, Signal } from '@angular/core';
import { MatFormField, MatOption, MatSelect } from '@angular/material/select';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { DynamicFieldComponent } from '../dynamic-field/dynamic-field.component';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TitleCasePipe, KeyValuePipe, CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, CanDeactivate, RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { CanComponentDeactivate, CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';
import { CredentialIssuanceService } from '../../services/credential-issuance.service';
import { CredentialFormatOption, CredentialIssuanceViewModelSchemaWithId, IssuanceCredentialType, IssuanceStaticViewModel } from 'src/app/core/models/entity/lear-credential-issuance';

/**
 * CredentialIssuanceComponent
 * - Renders a credential type selector. When a type is selected, a form corresponding to this type is built and rendered
 * - If the form has been touched, an alert is shown if the user tries to change the selected type or leave the page
 */
@Component({
    selector: 'app-credential-issuance',
    providers: [CredentialIssuanceService],
    imports: [CommonModule, KeyValuePipe, ReactiveFormsModule, DynamicFieldComponent, MatButton, MatCard, MatCardContent, MatFormField, MatLabel, MatOption, MatRadioButton, MatRadioGroup, MatSelect, RouterLink, TitleCasePipe, TranslatePipe],
    templateUrl: './credential-issuance.component.html',
    styleUrl: './credential-issuance.component.scss'
})
export class CredentialIssuanceComponent implements CanDeactivate<CanComponentDeactivate>{

  //CREDENTIAL TYPE SELECTOR
  public readonly credentialTypesArr: Readonly<IssuanceCredentialType[]>;
  public selectedCredentialType$: WritableSignal<IssuanceCredentialType | undefined>;

  // FORMAT SELECTOR
  public availableFormats$: Signal<CredentialFormatOption[]>;
  public effectiveFormatOption$: Signal<CredentialFormatOption | null>;

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
    this.credentialTypesArr = this.issuanceService.credentialTypesArr;
    this.selectedCredentialType$ = this.issuanceService.selectedCredentialType$;
    this.availableFormats$ = this.issuanceService.availableFormats$;
    this.effectiveFormatOption$ = this.issuanceService.effectiveFormatOption$;
    this.formSchema$ = this.issuanceService.credentialFormSchema$;
    this.staticData$ = this.issuanceService.staticData$;
    this.form$ = this.issuanceService.form$;
    this.formValue$ = this.issuanceService.formValue$;
    this.isFormValid$ = this.issuanceService.isFormValid$;
    this.bottomAlertMessages$ = this.issuanceService.bottomAlertMessages$;
  }

  @HostListener('window:beforeunload', ['$event'])
  private unloadAlert($event: BeforeUnloadEvent): void{
    if(!this.canLeave()){
      const confirm = this.issuanceService.openLeaveConfirm();
      if(!confirm) $event.preventDefault();
    }
  }

  public onTypeSelectionChange(selectedCredentialType: IssuanceCredentialType, select: MatSelect): void {
    this.issuanceService.updateSelectedType(selectedCredentialType, select);
  }

  public onFormatSelectionChange(option: CredentialFormatOption): void {
    this.issuanceService.updateSelectedFormat(option);
  }

  public canLeave(): boolean{
    return this.issuanceService.canLeave();
  }

  public canDeactivate(): CanDeactivateType {
    return this.issuanceService.canDeactivate();
  }

  public onSubmit(): void {
    const isFormValid = this.isFormValid$();
    const formValue = this.formValue$();
    if (!isFormValid) {
      console.error('Invalid form: ');
      console.error(formValue);
      return;
    }

    if(this.selectedCredentialType$() === 'learcredential.machine'){
      this.issuanceService.openLEARCredentialMachineSubmitDialog();
    }else{
      this.issuanceService.openSubmitDialog();
    }
  }


}
