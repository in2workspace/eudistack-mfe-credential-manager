import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatIcon } from '@angular/material/icon';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, UntypedFormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatButton, MatMiniFabButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { KeyValuePipe } from '@angular/common';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { EMPTY, Observable } from 'rxjs';
import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { AuthService } from 'src/app/core/services/auth.service';
import { IssuanceFormPowerSchema } from 'src/app/core/models/entity/lear-credential-issuance';
import { BaseIssuanceCustomFormChild } from 'src/app/features/credential-details/components/base-issuance-custom-form-child';
import { ThemeService } from 'src/app/core/services/theme.service';
import { toMandatorOrganizationId } from '../../helpers/issuance-error.helpers';

export interface TempIssuanceFormPowerSchema extends IssuanceFormPowerSchema{
  isDisabled: boolean;
}

export interface NormalizedTempIssuanceFormSchemaPower extends TempIssuanceFormPowerSchema{
  normalizedActions: NormalizedAction[];
}

export type NormalizedAction = { action: string; value: boolean };

/**
 * I-03: why a power the schema offers would be rejected by the Issuer's LEAR issuance policy
 * (`RequireLearCredentialIssuanceRule`) for the data currently in the form. SysAdmin bypasses
 * that policy, so nothing is ever unavailable for them.
 * - `requires_multi_org`: Onboarding/Execute can only be delegated in a multi_org tenant.
 * - `same_org`: Onboarding/Execute can only be delegated on-behalf of ANOTHER organization --
 *   the target (mandator) organization is the operator's own.
 */
export type PowerUnavailableReason = 'requires_multi_org' | 'same_org';

const ONBOARDING = 'Onboarding';

@Component({
    selector: 'app-issuance-power',
    templateUrl: './issuance-power.component.html',
    styleUrls: ['./issuance-power.component.scss'],
    imports: [KeyValuePipe, ReactiveFormsModule, MatFormField, MatSelect, MatSelectTrigger, MatOption, MatButton, MatSlideToggle, FormsModule, MatMiniFabButton, MatIcon, MatLabel, MatSelect, TranslatePipe]
})
export class IssuancePowerComponent extends BaseIssuanceCustomFormChild<UntypedFormGroup> implements OnInit{

  public organizationIdentifierIsAdmin: boolean;
  public _powersInput: IssuanceFormPowerSchema[] = [];
  public selectorPowers: TempIssuanceFormPowerSchema[] = [];
  public selectedPower: TempIssuanceFormPowerSchema | undefined;
  private readonly themeService = inject(ThemeService);
  public readonly sysTenant: string = this.themeService.tenantDomain;

  private readonly authService = inject(AuthService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public constructor(){
    super();
    this.organizationIdentifierIsAdmin = this.authService.hasAdminOrganizationIdentifier();
  }
  
  
  @Input()
  public set powersInput(value: IssuanceFormPowerSchema[]) {
    this.resetForm();
    this._powersInput = value || [];
    this.selectorPowers = this.mapToTempPowerSchema(value) || [];
  }

  //this makes keyvaluePipe respect the order
  public keepOrder = (_: any, _2: any) => 0;

  public addPower(funcName: string) {
    const power = this._powersInput.find(p => p.function === funcName);
    const actions = power?.action;
    if(!actions){
      console.error('No actions for this power');
      return;
    }
    const toggleGroup: Record<string, FormControl> = {};
    for (const action of actions) {
      toggleGroup[action] = new FormControl(false);
    }
    this.form().addControl(funcName, new FormGroup(toggleGroup));
    this.selectorPowers = [...this.selectorPowers.map(p => {
      if(p.function === funcName){
        p = { ...p, isDisabled: true}
      }
      return p;
    })];
    this.selectedPower = undefined;
  }

  public removePower(funcName: string): void {
    const translatedPowerName = this.translate.instant(`power.${funcName.toLocaleLowerCase()}`);
    const dialogData: DialogData = {
        title: this.translate.instant("power.remove-dialog.title"),
      message: `${this.translate.instant("power.remove-dialog.message")} (${translatedPowerName})`,
        confirmationType: 'sync',
        status: `default`
    }
    const removeAfterClose =  (): Observable<any> => {
    if (this.form().contains(funcName)) {
          this.form().removeControl(funcName);
        }

    this.selectorPowers = this.selectorPowers.map(p => {
      if (p.function === funcName) {
        return { ...p, isDisabled: false };
      }
      return p;
    });
      return EMPTY;
    };
    this.dialog.openDialogWithCallback(DialogComponent, dialogData, removeAfterClose);
    
  }

  public ngOnInit(){
    this.form().addValidators(this.powerRulesValidator);
    this.form().updateValueAndValidity({ emitEvent: false });
    // The target organization lives in the sibling `mandator` group (on-behalf only): an
    // Onboarding power that was valid a moment ago becomes unavailable as soon as the Operator
    // types their own organization there, so the power group has to be re-validated then.
    this.mandatorGroup()?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form().updateValueAndValidity());
    const selectorPowers = this.data();
    this._powersInput = selectorPowers || [];
    this.selectorPowers = this.mapToTempPowerSchema(selectorPowers) || [];
  }

/**
 * The reason `functionName` would be rejected by the Issuer for the current form data, or null
 * when it is viable. Only Onboarding depends on the form (tenant type and target organization);
 * the rest of the LEAR policy is already enforced by which powers the schema offers at all.
 */
public getUnavailableReason(functionName: string): PowerUnavailableReason | null {
  if (functionName !== ONBOARDING || this.authService.isSysAdmin()) return null;
  if (this.authService.tenantType() !== 'multi_org') return 'requires_multi_org';
  return this.isTargetOperatorOrganization() ? 'same_org' : null;
}

public isSelectable(power: TempIssuanceFormPowerSchema): boolean {
  return !power.isDisabled && this.getUnavailableReason(power.function) === null;
}

/** Offered powers the Operator cannot use right now, so the template can explain each one. */
public getUnavailablePowers(): Array<{ function: string; reason: PowerUnavailableReason }> {
  return this.selectorPowers
    .map(p => ({ function: p.function, reason: this.getUnavailableReason(p.function) }))
    .filter((p): p is { function: string; reason: PowerUnavailableReason } => p.reason !== null);
}

private mandatorGroup(): AbstractControl | null {
  return this.form().parent?.get('mandator') ?? null;
}

/**
 * Whether the credential would be issued to the operator's own organization. Without a
 * `mandator` group in the form (not on-behalf) the mandator IS the operator. On-behalf, an
 * organization not fully typed yet is not treated as a match -- nothing to warn about yet.
 */
private isTargetOperatorOrganization(): boolean {
  const operatorOrgId = this.authService.organizationIdentifier()
    || this.authService.extractRawMandator()?.organizationIdentifier
    || null;
  if (!operatorOrgId) return false;
  const mandator = this.mandatorGroup();
  if (!mandator) return true;
  const value = mandator.value as Record<string, string | null | undefined>;
  const targetOrgId = toMandatorOrganizationId(value['country'], value['organizationIdentifier']);
  return targetOrgId !== null && targetOrgId.toUpperCase() === operatorOrgId.toUpperCase();
}

public getPowerByFunction(functionName: string): TempIssuanceFormPowerSchema | undefined {
  return this.selectorPowers.find(p => p.function === functionName);
}

public getFormGroup(control: any): FormGroup {
  return control as FormGroup;
}

private mapToTempPowerSchema(powers: IssuanceFormPowerSchema[]): TempIssuanceFormPowerSchema[]{
  return powers
    .map(p => ({...p, isDisabled: false}))
    .filter(p => this.organizationIdentifierIsAdmin || !p.isAdminRequired);
}

private resetForm() {
  this.form().reset();            
  for (const key of Object.keys(this.form().controls)) {
    this.form().removeControl(key);
  }
}

private readonly powerRulesValidator: ValidatorFn = (ctrl: AbstractControl): ValidationErrors | null => {
  const group = ctrl as FormGroup;
  const controls = Object.values(group.controls) as FormGroup[];

  const hasOnePower = controls.length > 0;
  const hasOneActionPerPower = controls.every(c =>
    Object.values(c.value as Record<string, boolean>).some(Boolean)
  );

  const errors: ValidationErrors = {};
  if (!hasOnePower) errors['noPower'] = true;
  if (!hasOneActionPerPower) errors['noActionPerPower'] = true;
  // I-03: an added power the Issuer would reject blocks the submit up front, with the reason
  // shown next to it, instead of a failed request after the Operator confirms.
  if (Object.keys(group.controls).some(fn => this.getUnavailableReason(fn) !== null)) {
    errors['unavailablePower'] = true;
  }

  return Object.keys(errors).length ? errors : null;
};
  

}
