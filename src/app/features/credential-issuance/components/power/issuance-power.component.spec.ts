import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { IssuancePowerComponent, TempIssuanceFormPowerSchema } from './issuance-power.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IssuanceFormPowerSchema } from 'src/app/core/models/entity/lear-credential-issuance';
import { of } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CredentialIssuanceService } from '../../services/credential-issuance.service';
import { ThemeService } from 'src/app/core/services/theme.service';

describe('IssuancePowerComponent', () => {
  let component: IssuancePowerComponent;
  let fixture: ComponentFixture<IssuancePowerComponent>;
  let authService: Partial<AuthService>;
  let dialog: Partial<DialogWrapperService>;
  let translate: Partial<TranslateService>;
  const proto = IssuancePowerComponent.prototype as any;
  let mockIssuanceService: Partial<CredentialIssuanceService>;

  beforeEach(async () => {
    proto.updateMessages = () => () => {};
    proto.data = () => [];
    proto.resetForm = () => {};
    proto.mapToTempPowerSchema = function(powers: IssuanceFormPowerSchema[]) {
      return (powers || [])
        .map(p => ({ ...p, isDisabled: false }))
        .filter(p => this.organizationIdentifierIsAdmin || !p.isAdminRequired);
    };
    Object.defineProperty(proto, 'powersInput', {
      configurable: true,
      set(this: IssuancePowerComponent, value: IssuanceFormPowerSchema[]) {
        if (value !== undefined) {
          (this as any).resetForm();
          this['_powersInput'] = value || [];
          this.selectorPowers = (this as any).mapToTempPowerSchema(value);
        }
      }
    });
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
    translate = { instant: jest.fn((key: string) => `t:${key}`), get: jest.fn().mockReturnValue(of(undefined)) };

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
  });

  it('should create the component', () => {
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
    Object.defineProperty(component, 'form', {
      value: () => new FormGroup({}),
      configurable: true
    });
    component.powersInput = [];
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('organizationIdentifierIsAdmin is truthy if the service indicates so', () => {
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
    Object.defineProperty(component, 'form', {
      value: () => new FormGroup({}),
      configurable: true
    });
    component.organizationIdentifierIsAdmin = true;
    component.powersInput = [];
    fixture.detectChanges();
    expect(component.organizationIdentifierIsAdmin).toBeTruthy();

    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(false);
    const f2 = TestBed.createComponent(IssuancePowerComponent);
    const cmp2 = f2.componentInstance;
    Object.defineProperty(cmp2, 'form', {
      value: () => new FormGroup({}),
      configurable: true
    });
    cmp2.organizationIdentifierIsAdmin = false;
    cmp2.powersInput = [];
    f2.detectChanges();
    expect(cmp2.organizationIdentifierIsAdmin).toBeFalsy();
  });

  it('keepOrder always returns 0', () => {
    expect(component.keepOrder('x', 'y')).toBe(0);
  });

  it('addPower adds a control and disables the selector', () => {
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
    const schema: TempIssuanceFormPowerSchema = {
      function: 'power1',
      action: ['act1','act2'],
      isAdminRequired: false,
      isDisabled: false
    };
    component.powersInput = [schema];
    component.selectedPower = schema;
    const fg = new FormGroup({});
    (component as any).form = () => fg;

    component.addPower('power1');

    expect(fg.contains('power1')).toBeTruthy();
    const child = fg.get('power1') as any;
    expect((child.get('act1') as FormControl)).toBeTruthy();
    expect((child.get('act2') as FormControl)).toBeTruthy();

    const p = component.selectorPowers.find(pw => pw.function==='power1')!;
    expect(p.isDisabled).toBeTruthy();
    expect(component.selectedPower).toBeUndefined();
  });

  it('addPower with undefined actions logs an error and does not modify the form', () => {
    console.error = jest.fn();
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
    const schema: IssuanceFormPowerSchema = {
      function: 'p2',
      action: undefined as any,
      isAdminRequired: false
    };
    component.powersInput = [schema];
    const fg = new FormGroup({});
    (component as any).form = () => fg;

    component.addPower('p2');
    expect(console.error).toHaveBeenCalledWith('No actions for this power');
    expect(fg.contains('p2')).toBeFalsy();
  });

  it('removePower opens the dialog then removes the control and enables the selector', fakeAsync(() => {
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
    const schema: IssuanceFormPowerSchema = {
      function: 'pw',
      action: ['a'],
      isAdminRequired: false
    };
    component.powersInput = [schema];
    const fg = new FormGroup({});
    (component as any).form = () => fg;
    component.addPower('pw');

    (dialog.openDialogWithCallback as jest.Mock).mockImplementation((_, data: DialogData, cb: any) => {
      expect(data.title).toBe('power.remove-dialog.title');
      expect(data.message).toBe('power.remove-dialog.message (power.pw)');
      return cb();
    });

    component.removePower('pw');
    tick();

    expect(fg.contains('pw')).toBeFalsy();
    const p = component.selectorPowers.find(x => x.function==='pw')!;
    expect(p.isDisabled).toBeFalsy();
  }));

  it('ngOnInit initializes data() and subscribes to valueChanges', fakeAsync(() => {
    (authService.hasAdminOrganizationIdentifier as jest.Mock).mockReturnValue(true);
    const initial: IssuanceFormPowerSchema[] = [
      { function: 'f', action: ['x'], isAdminRequired: false }
    ];
    (component as any).data = () => initial;
    const fg = new FormGroup({});
    (component as any).form = () => fg;

    component.ngOnInit();
    expect(component['_powersInput']).toEqual(initial);
    expect(component.selectorPowers.length).toBe(1);

    fg.addControl('f', new FormGroup({ x: new FormControl(false) }));
    fg.patchValue({ f: { x: true } });
    tick();

  }));

  it('getPowerByFunction returns the correct element', () => {
    component.selectorPowers = [
      { function: 'a', action: [], isAdminRequired: false, isDisabled: false }
    ];
    expect(component.getPowerByFunction('a')).toEqual(component.selectorPowers[0]);
    expect(component.getPowerByFunction('nope')).toBeUndefined();
  });

  it('getFormGroup performs the correct cast', () => {
    const fg = new FormGroup({});
    expect(component.getFormGroup(fg)).toBe(fg);
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
      Object.defineProperty(component, 'form', { value: () => powerGroup, configurable: true });
      component.organizationIdentifierIsAdmin = true;
      fixture.detectChanges();
      component.powersInput = [productOffering, onboarding];
      fixture.detectChanges();
      return { root, powerGroup };
    }

    it('marks Onboarding unavailable when the target organization is the operator own organization', () => {
      setup({ country: 'ES', organizationIdentifier: 'A15456585' });

      expect(component.getUnavailableReason('Onboarding')).toBe('same_org');
      expect(component.isSelectable(component.getPowerByFunction('Onboarding')!)).toBe(false);
      expect(component.getUnavailablePowers()).toEqual([{ function: 'Onboarding', reason: 'same_org' }]);
      expect(fixture.nativeElement.querySelector('.unavailable-hint')).not.toBeNull();
    });

    it('keeps Onboarding available for another organization, and for an organization not typed yet', () => {
      const { root } = setup({ country: 'ES', organizationIdentifier: 'B12345678' });
      expect(component.getUnavailableReason('Onboarding')).toBeNull();

      root.get('mandator.organizationIdentifier')!.setValue('');
      expect(component.getUnavailableReason('Onboarding')).toBeNull();
    });

    it('invalidates an already added Onboarding power once the operator types their own organization', () => {
      const { root, powerGroup } = setup({ country: 'ES', organizationIdentifier: 'B12345678' });
      component.addPower('Onboarding');
      (powerGroup.get('Onboarding') as FormGroup).get('Execute')!.setValue(true);
      expect(powerGroup.hasError('unavailablePower')).toBe(false);

      root.get('mandator.organizationIdentifier')!.setValue('A15456585');

      expect(powerGroup.hasError('unavailablePower')).toBe(true);
      expect(root.valid).toBe(false);
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
