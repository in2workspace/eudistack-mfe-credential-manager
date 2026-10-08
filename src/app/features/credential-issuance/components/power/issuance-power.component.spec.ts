import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { IssuancePowerComponent } from './issuance-power.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IssuanceFormPowerSchema } from 'src/app/core/models/entity/lear-credential-issuance';
import { of } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { CredentialIssuanceService } from '../../services/credential-issuance.service';
import { ThemeService } from 'src/app/core/services/theme.service';

describe('IssuancePowerComponent', () => {
  let component: IssuancePowerComponent;
  let fixture: ComponentFixture<IssuancePowerComponent>;
  let authService: Partial<AuthService>;
  let dialog: Partial<DialogWrapperService>;
  const proto = IssuancePowerComponent.prototype as any;
  let mockIssuanceService: Partial<CredentialIssuanceService>;

  const attachForm = (cmp: IssuancePowerComponent): FormGroup => {
    const fg = new FormGroup({});
    (cmp as any).form = () => fg;
    return fg;
  };

  beforeEach(async () => {
    proto.updateMessages = () => () => {};
    proto.data = () => [];
    mockIssuanceService = {
      updateAlertMessages: jest.fn()
    };

    authService = {
      hasAdminOrganizationIdentifier: jest.fn(),
      isSysAdmin: jest.fn().mockReturnValue(false),
      tenantType: signal('multi_org'),
      organizationIdentifier: signal('VATES-A15456585'),
      extractRawMandator: jest.fn().mockReturnValue(null)
    } as unknown as Partial<AuthService>;
    dialog = { openDialogWithCallback: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [IssuancePowerComponent, ReactiveFormsModule, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: DialogWrapperService, useValue: dialog },
        { provide: CredentialIssuanceService, useValue: mockIssuanceService },
        { provide: ThemeService, useValue: { tenantDomain: 'TENANT' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IssuancePowerComponent);
    component = fixture.componentInstance;
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
  });

  it('should create the component', () => {
    attachForm(component);
    component.ngOnInit();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('organizationIdentifierIsAdmin is truthy if the service indicates so', () => {
    attachForm(component);
    component.organizationIdentifierIsAdmin = true;
    component.ngOnInit();
    fixture.detectChanges();
    expect(component.organizationIdentifierIsAdmin).toBeTruthy();

    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(false);
    const f2 = TestBed.createComponent(IssuancePowerComponent);
    const cmp2 = f2.componentInstance;
    attachForm(cmp2);
    cmp2.organizationIdentifierIsAdmin = false;
    cmp2.ngOnInit();
    f2.detectChanges();
    expect(cmp2.organizationIdentifierIsAdmin).toBeFalsy();
  });

  it('ngOnInit wires the tenant domain and no other scope', () => {
    const fg = attachForm(component);
    component.ngOnInit();

    expect(component.scopes).toEqual(['domain']);
    expect(fg.contains('domain')).toBeTruthy();
    expect(fg.contains('organization')).toBeFalsy();
  });

  it('addPower attaches the actions of the power under the tenant domain', () => {
    const fg = attachForm(component);
    (component as any).data = () => [{ function: 'power1', action: ['act1', 'act2'], isAdminRequired: false }];
    component.ngOnInit();
    component.addPower('domain', 'power1');

    const domain = fg.get('domain') as FormGroup;
    expect(domain.contains('power1')).toBeTruthy();

    const child = domain.get('power1') as FormGroup;
    expect(child.get('act1') as FormControl).toBeTruthy();
    expect(child.get('act2') as FormControl).toBeTruthy();
  });

  it('scopeCount and isPowerEnabled report the powers of the scope', () => {
    attachForm(component);
    (component as any).data = () => [{ function: 'pw', action: ['a'], isAdminRequired: false }];
    component.ngOnInit();

    expect(component.scopeCount('domain')).toBe(0);
    expect(component.isPowerEnabled('domain', 'pw')).toBeFalsy();

    component.addPower('domain', 'pw');

    expect(component.scopeCount('domain')).toBe(1);
    expect(component.isPowerEnabled('domain', 'pw')).toBeTruthy();
  });

  it('addPower with undefined actions logs an error and does not modify the form', () => {
    console.error = jest.fn();
    const fg = attachForm(component);
    (component as any).data = () => [{ function: 'p2', action: undefined as any, isAdminRequired: false }];
    component.ngOnInit();

    component.addPower('domain', 'p2');

    expect(console.error).toHaveBeenCalledWith('No actions for this power');
    expect((fg.get('domain') as FormGroup).contains('p2')).toBeFalsy();
  });

  it('removePower drops an untouched power without prompting', () => {
    const fg = attachForm(component);
    (component as any).data = () => [{ function: 'pw', action: ['a'], isAdminRequired: false }];
    component.ngOnInit();
    component.addPower('domain', 'pw');

    component.removePower('domain', 'pw');

    expect((fg.get('domain') as FormGroup).contains('pw')).toBeFalsy();
    expect(dialog.openDialogWithCallback).not.toHaveBeenCalled();
  });

  it('removePower confirms before discarding actions the operator already selected', fakeAsync(() => {
    const fg = attachForm(component);
    (component as any).data = () => [{ function: 'pw', action: ['a'], isAdminRequired: false }];
    component.ngOnInit();
    component.addPower('domain', 'pw');
    (fg.get('domain.pw.a') as FormControl).setValue(true);

    (dialog.openDialogWithCallback as jest.Mock).mockImplementation((_: any, data: DialogData, cb: any) => {
      expect(data.title).toBe('power.remove-dialog.title');
      expect(data.message).toBe('power.remove-dialog.message (power.pw)');
      return cb();
    });

    component.removePower('domain', 'pw');
    tick();

    expect((fg.get('domain') as FormGroup).contains('pw')).toBeFalsy();
  }));

  it('the form is invalid until every enabled power carries at least one action', () => {
    const fg = attachForm(component);
    (component as any).data = () => [{ function: 'pw', action: ['a'], isAdminRequired: false }];
    component.ngOnInit();

    expect(fg.hasError('noPower')).toBeTruthy();

    component.addPower('domain', 'pw');
    expect(fg.hasError('noPower')).toBeFalsy();
    expect(fg.hasError('noActionPerPower')).toBeTruthy();

    (fg.get('domain.pw.a') as FormControl).setValue(true);
    fg.updateValueAndValidity();
    expect(fg.hasError('noActionPerPower')).toBeFalsy();
  });


  it('builds no form group for a scope the tenant does not offer', () => {
    const fg = attachForm(component);
    component.ngOnInit();

    expect(Object.keys(fg.controls)).toEqual(['domain']);
  });


  describe('the switch drives add and remove', () => {
    const toggleEvent = (checked: boolean, source: any = {}) => ({ checked, source } as any);

    const withCatalogue = () => {
      const fg = attachForm(component);
      (component as any).data = () => [{ function: 'pw', action: ['a'], isAdminRequired: false }];
      component.ngOnInit();
      return fg;
    };

    it('adds the power when the switch goes on', () => {
      const fg = withCatalogue();

      component.onPowerToggle('domain', 'pw', toggleEvent(true));

      expect((fg.get('domain') as FormGroup).contains('pw')).toBe(true);
    });

    it('removes it when the switch goes off', () => {
      const fg = withCatalogue();
      component.onPowerToggle('domain', 'pw', toggleEvent(true));

      component.onPowerToggle('domain', 'pw', toggleEvent(false));

      expect((fg.get('domain') as FormGroup).contains('pw')).toBe(false);
    });

    it('does nothing when asked to remove a power that was never added', () => {
      const fg = withCatalogue();

      component.removePower('domain', 'pw');

      expect((fg.get('domain') as FormGroup).contains('pw')).toBe(false);
      expect(dialog.openDialogWithCallback).not.toHaveBeenCalled();
    });

    it('restores the switch before prompting, so a dismissed dialog cannot desync it', () => {
      const fg = withCatalogue();
      component.onPowerToggle('domain', 'pw', toggleEvent(true));
      (fg.get('domain.pw.a') as FormControl).setValue(true);
      const source = { checked: false } as any;

      // Dialog left unanswered: the callback is never invoked.
      (dialog.openDialogWithCallback as jest.Mock).mockImplementation(() => undefined);
      component.onPowerToggle('domain', 'pw', toggleEvent(false, source));

      expect(source.checked).toBe(true);
      expect((fg.get('domain') as FormGroup).contains('pw')).toBe(true);
    });
  });


  describe('degraded session and unknown scopes', () => {
    it('reports an absent scope as empty rather than throwing', () => {
      const fg = new FormGroup({});
      (component as any).form = () => fg;

      expect(component.scopeCount('domain')).toBe(0);
      expect(component.isPowerEnabled('domain', 'pw')).toBe(false);
    });
  });


  it('refuses to add a power the operator is not allowed to delegate, even off-template', () => {
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(false);
    const f = TestBed.createComponent(IssuancePowerComponent);
    const cmp = f.componentInstance;
    const fg = attachForm(cmp);
    (cmp as any).data = () => [{ function: 'Certification', action: ['Attest'], isAdminRequired: true }];
    cmp.ngOnInit();

    cmp.addPower('domain', 'Certification');

    expect(cmp.selectorPowers).toEqual([]);
    expect((fg.get('domain') as FormGroup).contains('Certification')).toBe(false);
  });


  it('offers the lone scope as a label, not as a clickable choice', () => {
    attachForm(component);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.scopes).toHaveLength(1);
    expect(component.isScopeSelectable).toBe(false);

    const tab: HTMLButtonElement = fixture.nativeElement.querySelector('.scope-tab');
    expect(tab.disabled).toBe(true);
    expect(tab.textContent).toContain('TENANT');
  });

  // I-03: Onboarding/Execute can only be delegated on-behalf of ANOTHER organization, and only in
  // a multi_org tenant -- the selector must not offer it (and must explain why) otherwise.
  describe('power availability (I-03)', () => {
    const onboarding: IssuanceFormPowerSchema = { function: 'Onboarding', action: ['Execute'], isAdminRequired: true } as any;
    const productOffering: IssuanceFormPowerSchema = { function: 'ProductOffering', action: ['Create'], isAdminRequired: false } as any;

    function setup(mandator: { country: string; organizationIdentifier: string } | null) {
      const powerGroup = new FormGroup<any>({});
      const root = new FormGroup<any>({ power: powerGroup });
      if (mandator) {
        root.addControl('mandator', new FormGroup({
          country: new FormControl(mandator.country),
          organizationIdentifier: new FormControl(mandator.organizationIdentifier)
        }));
      }
      (component as any).form = () => powerGroup;
      (component as any).data = () => [productOffering, onboarding];
      component.organizationIdentifierIsAdmin = true;
      component.ngOnInit();
      fixture.detectChanges();
      return { root, powerGroup };
    }

    const onboardingToggle = (): HTMLElement =>
      fixture.debugElement.queryAll(By.css('mat-slide-toggle'))
        .find(t => t.nativeElement.textContent.includes('power.onboarding'))!.nativeElement;

    it('disables Onboarding, with the reason, when the target organization is the operator own organization', () => {
      setup({ country: 'ES', organizationIdentifier: 'A15456585' });

      expect(component.getUnavailableReason('Onboarding')).toBe('same_org');
      expect(component.isToggleDisabled('domain', 'Onboarding')).toBe(true);
      expect((onboardingToggle().querySelector('button') as HTMLButtonElement).disabled).toBe(true);
      const hint: HTMLElement = fixture.nativeElement.querySelector('.unavailable-hint');
      expect(hint.textContent).toContain('power.unavailable.same_org');
    });

    it('compares the organizationIdentifier the request factory will send (already VAT-prefixed)', () => {
      setup({ country: 'ES', organizationIdentifier: 'VATES-A15456585' });

      expect(component.getUnavailableReason('Onboarding')).toBe('same_org');
    });

    it('keeps Onboarding available for another organization, and for an organization not typed yet', () => {
      const { root } = setup({ country: 'ES', organizationIdentifier: 'B12345678' });
      expect(component.getUnavailableReason('Onboarding')).toBeNull();
      expect(fixture.nativeElement.querySelector('.unavailable-hint')).toBeNull();

      root.get('mandator.organizationIdentifier')!.setValue('');
      expect(component.getUnavailableReason('Onboarding')).toBeNull();
    });

    it('does not add an unavailable power even if asked to', () => {
      const { powerGroup } = setup({ country: 'ES', organizationIdentifier: 'A15456585' });

      component.addPower('domain', 'Onboarding');

      expect((powerGroup.get('domain') as FormGroup).contains('Onboarding')).toBe(false);
    });

    it('invalidates an already added Onboarding power once the operator types their own organization, and lets it be removed', () => {
      const { root, powerGroup } = setup({ country: 'ES', organizationIdentifier: 'B12345678' });
      component.addPower('domain', 'Onboarding');
      powerGroup.get('domain.Onboarding.Execute')!.setValue(true);
      expect(powerGroup.hasError('unavailablePower')).toBe(false);

      root.get('mandator.organizationIdentifier')!.setValue('A15456585');
      fixture.detectChanges();

      expect(powerGroup.hasError('unavailablePower')).toBe(true);
      expect(root.valid).toBe(false);
      expect(component.isToggleDisabled('domain', 'Onboarding')).toBe(false);
      expect(fixture.nativeElement.querySelector('.bottom-alert').textContent).toContain('power.unavailable.remove');
    });

    it('treats a non on-behalf issuance (no mandator group) as the operator own organization', () => {
      setup(null);

      expect(component.getUnavailableReason('Onboarding')).toBe('same_org');
    });

    it('marks Onboarding unavailable outside a multi_org tenant', () => {
      (authService.tenantType as any).set('simple');
      setup({ country: 'ES', organizationIdentifier: 'B12345678' });

      expect(component.getUnavailableReason('Onboarding')).toBe('requires_multi_org');
      (authService.tenantType as any).set('multi_org');
    });

    it('never restricts a SysAdmin (the Issuer bypasses the LEAR policy for them)', () => {
      (authService.isSysAdmin as jest.Mock).mockReturnValue(true);
      setup({ country: 'ES', organizationIdentifier: 'A15456585' });

      expect(component.getUnavailableReason('Onboarding')).toBeNull();
      (authService.isSysAdmin as jest.Mock).mockReturnValue(false);
    });

    it('never restricts powers other than Onboarding', () => {
      setup({ country: 'ES', organizationIdentifier: 'A15456585' });

      expect(component.getUnavailableReason('ProductOffering')).toBeNull();
      expect(component.getUnavailableReason('Certification')).toBeNull();
    });
  });
});
