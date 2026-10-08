import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, UntypedFormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { EMPTY, Observable } from 'rxjs';
import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { AuthService } from 'src/app/core/services/auth.service';
import { IssuanceFormPowerSchema, POWER_SCOPES, PowerScope } from 'src/app/core/models/entity/lear-credential-issuance';
import { BaseIssuanceCustomFormChild } from 'src/app/features/credential-details/components/base-issuance-custom-form-child';
import { ThemeService } from 'src/app/core/services/theme.service';
import { toMandatorOrganizationId } from '../../helpers/issuance-error.helpers';

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
    imports: [ReactiveFormsModule, MatSlideToggle, MatCheckbox, TranslatePipe]
})
export class IssuancePowerComponent extends BaseIssuanceCustomFormChild<UntypedFormGroup> implements OnInit{

  public readonly scopes = POWER_SCOPES;

  public readonly activeScope = signal<PowerScope>('domain');

  /**
   * With a single scope on offer the segment is a label, not a choice: it stays visible so the
   * Operator can see which scope the powers land in, but it must not invite a click that would
   * do nothing.
   */
  public readonly isScopeSelectable = this.scopes.length > 1;

  public organizationIdentifierIsAdmin: boolean;
  public selectorPowers: IssuanceFormPowerSchema[] = [];
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

  public scopeGroup(scope: PowerScope): FormGroup {
    return this.form().get(scope) as FormGroup;
  }

  public scopeCount(scope: PowerScope): number {
    return Object.keys(this.scopeGroup(scope)?.controls ?? {}).length;
  }

  public isPowerEnabled(scope: PowerScope, funcName: string): boolean {
    return this.scopeGroup(scope)?.contains(funcName) ?? false;
  }

  public onPowerToggle(scope: PowerScope, funcName: string, change: MatSlideToggleChange): void {
    if (change.checked) {
      this.addPower(scope, funcName);
      return;
    }
    this.removePower(scope, funcName, change.source);
  }

  public addPower(scope: PowerScope, funcName: string): void {
    // I-03: the switch of an unavailable power is disabled; this guards any other caller.
    if (this.getUnavailableReason(funcName) !== null) {
      return;
    }
    const power = this.selectorPowers.find(p => p.function === funcName);
    const actions = power?.action;
    if(!actions){
      console.error('No actions for this power');
      return;
    }
    const toggleGroup: Record<string, FormControl> = {};
    for (const action of actions) {
      toggleGroup[action] = new FormControl(false);
    }
    this.scopeGroup(scope).addControl(funcName, new FormGroup(toggleGroup));
    this.form().updateValueAndValidity();
  }

  public removePower(scope: PowerScope, funcName: string, toggle?: MatSlideToggle): void {
    const group = this.scopeGroup(scope);
    if (!group?.contains(funcName)) {
      return;
    }

    const selectedActions = group.get(funcName)!.value as Record<string, boolean>;
    const hasSelection = Object.values(selectedActions).some(Boolean);
    if (!hasSelection) {
      group.removeControl(funcName);
      this.form().updateValueAndValidity();
      return;
    }

    const translatedPowerName = this.translate.instant('power.' + funcName.toLocaleLowerCase());
    const dialogData: DialogData = {
      title: this.translate.instant("power.remove-dialog.title"),
      message: this.translate.instant("power.remove-dialog.message") + ' (' + translatedPowerName + ')',
      confirmationType: 'sync',
      status: 'default'
    };
    const removeAfterClose = (): Observable<any> => {
      group.removeControl(funcName);
      this.form().updateValueAndValidity();
      return EMPTY;
    };

    if (toggle) {
      toggle.checked = true;
    }
    this.dialog.openDialogWithCallback(DialogComponent, dialogData, removeAfterClose);
  }

  public ngOnInit(){
    this.ensureScopeGroups();
    this.form().addValidators(this.powerRulesValidator);
    this.form().updateValueAndValidity({ emitEvent: false });
    // The target organization lives in the sibling `mandator` group (on-behalf only): an
    // Onboarding power that was valid a moment ago becomes unavailable as soon as the Operator
    // types their own organization there, so the power group has to be re-validated then.
    this.mandatorGroup()?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form().updateValueAndValidity());
    this.selectorPowers = this.filterVisiblePowers(this.data() ?? []);
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

  /**
   * An unavailable power cannot be switched on; one switched on before it became unavailable
   * (the Operator typed their own organization afterwards) stays switchable so it can be removed.
   */
  public isToggleDisabled(scope: PowerScope, funcName: string): boolean {
    return !this.isPowerEnabled(scope, funcName) && this.getUnavailableReason(funcName) !== null;
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

  private ensureScopeGroups(): void {
    for (const scope of this.scopes) {
      if (!this.form().contains(scope)) {
        this.form().addControl(scope, new FormGroup({}));
      }
    }
  }

  private filterVisiblePowers(powers: IssuanceFormPowerSchema[]): IssuanceFormPowerSchema[]{
    return powers.filter(p => this.organizationIdentifierIsAdmin || !p.isAdminRequired);
  }

  private readonly powerRulesValidator: ValidatorFn = (ctrl: AbstractControl): ValidationErrors | null => {
    const group = ctrl as FormGroup;
    const scopeGroups = POWER_SCOPES
      .map(scope => group.get(scope) as FormGroup | null)
      .filter((g): g is FormGroup => !!g);
    const powerGroups = scopeGroups.flatMap(g => Object.values(g.controls) as FormGroup[]);

    const hasOnePower = powerGroups.length > 0;
    const hasOneActionPerPower = powerGroups.every(c =>
      Object.values(c.value as Record<string, boolean>).some(Boolean)
    );

    const errors: ValidationErrors = {};
    if (!hasOnePower) errors['noPower'] = true;
    if (!hasOneActionPerPower) errors['noActionPerPower'] = true;
    // I-03: an added power the Issuer would reject blocks the submit up front, with the reason
    // shown next to it, instead of a failed request after the Operator confirms.
    if (scopeGroups.some(g => Object.keys(g.controls).some(fn => this.getUnavailableReason(fn) !== null))) {
      errors['unavailablePower'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  };

}
