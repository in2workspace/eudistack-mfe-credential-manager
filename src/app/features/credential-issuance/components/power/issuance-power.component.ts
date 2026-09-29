import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
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

@Component({
    selector: 'app-issuance-power',
    templateUrl: './issuance-power.component.html',
    styleUrls: ['./issuance-power.component.scss'],
    imports: [ReactiveFormsModule, MatSlideToggle, MatCheckbox, TranslatePipe]
})
export class IssuancePowerComponent extends BaseIssuanceCustomFormChild<UntypedFormGroup> implements OnInit{

  public readonly scopes = POWER_SCOPES;

  /**
   * The scopes the Operator can actually pick from. `organization` is withheld pending a product
   * decision on whether a tenant may delegate organization-scoped powers at all; the scope itself
   * stays wired end to end (form group, validator, payload), so restoring the tab is a one-line
   * change here and nothing else.
   */
  public readonly visibleScopes: readonly PowerScope[] = POWER_SCOPES.filter(scope => scope !== 'organization');

  public readonly activeScope = signal<PowerScope>('domain');

  public organizationIdentifierIsAdmin: boolean;
  public _powersInput: IssuanceFormPowerSchema[] = [];
  public selectorPowers: IssuanceFormPowerSchema[] = [];
  private readonly themeService = inject(ThemeService);
  public readonly sysTenant: string = this.themeService.tenantDomain;
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly translate = inject(TranslateService);

  public constructor(){
    super();
    this.organizationIdentifierIsAdmin = this.authService.hasAdminOrganizationIdentifier();
  }

  @Input()
  public set powersInput(value: IssuanceFormPowerSchema[]) {
    this.resetForm();
    this._powersInput = value || [];
    this.selectorPowers = this.filterVisiblePowers(value) || [];
  }

  public organizationName(): string {
    return this.authService.extractRawMandator()?.organization ?? '';
  }

  public scopeLabel(scope: PowerScope): string {
    if (scope === 'domain') {
      return this.sysTenant;
    }
    return this.organizationName() || this.translate.instant('power.scope.organization');
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
    const selectorPowers = this.data();
    this._powersInput = selectorPowers || [];
    this.selectorPowers = this.filterVisiblePowers(selectorPowers) || [];
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

  private resetForm() {
    this.form().reset();
    for (const key of Object.keys(this.form().controls)) {
      this.form().removeControl(key);
    }
    this.ensureScopeGroups();
  }

  private readonly powerRulesValidator: ValidatorFn = (ctrl: AbstractControl): ValidationErrors | null => {
    const group = ctrl as FormGroup;
    const powerGroups = POWER_SCOPES
      .map(scope => group.get(scope) as FormGroup | null)
      .filter((g): g is FormGroup => !!g)
      .flatMap(g => Object.values(g.controls) as FormGroup[]);

    const hasOnePower = powerGroups.length > 0;
    const hasOneActionPerPower = powerGroups.every(c =>
      Object.values(c.value as Record<string, boolean>).some(Boolean)
    );

    const errors: ValidationErrors = {};
    if (!hasOnePower) errors['noPower'] = true;
    if (!hasOneActionPerPower) errors['noActionPerPower'] = true;

    return Object.keys(errors).length ? errors : null;
  };

}
