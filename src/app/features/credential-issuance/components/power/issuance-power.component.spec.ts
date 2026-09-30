import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { IssuancePowerComponent } from './issuance-power.component';
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
      extractRawMandator: jest.fn().mockReturnValue({ organization: 'Acme Ltd' } as any)
    };
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

  it('ngOnInit creates one FormGroup per power scope', () => {
    const fg = attachForm(component);
    component.ngOnInit();

    expect(fg.contains('domain')).toBeTruthy();
    expect(fg.contains('organization')).toBeTruthy();
  });

  it('scopeLabel resolves the tenant for domain and the mandator organization for organization', () => {
    attachForm(component);
    component.ngOnInit();

    expect(component.scopeLabel('domain')).toBe('TENANT');
    expect(component.scopeLabel('organization')).toBe('Acme Ltd');
  });

  it('addPower attaches the actions under the requested scope only', () => {
    const fg = attachForm(component);
    (component as any).data = () => [{ function: 'power1', action: ['act1', 'act2'], isAdminRequired: false }];
    component.ngOnInit();
    component.addPower('organization', 'power1');

    const organization = fg.get('organization') as FormGroup;
    const domain = fg.get('domain') as FormGroup;
    expect(organization.contains('power1')).toBeTruthy();
    expect(domain.contains('power1')).toBeFalsy();

    const child = organization.get('power1') as FormGroup;
    expect(child.get('act1') as FormControl).toBeTruthy();
    expect(child.get('act2') as FormControl).toBeTruthy();
  });

  it('scopeCount and isPowerEnabled report per scope', () => {
    attachForm(component);
    (component as any).data = () => [{ function: 'pw', action: ['a'], isAdminRequired: false }];
    component.ngOnInit();

    expect(component.scopeCount('domain')).toBe(0);
    expect(component.isPowerEnabled('domain', 'pw')).toBeFalsy();

    component.addPower('domain', 'pw');

    expect(component.scopeCount('domain')).toBe(1);
    expect(component.scopeCount('organization')).toBe(0);
    expect(component.isPowerEnabled('domain', 'pw')).toBeTruthy();
    expect(component.isPowerEnabled('organization', 'pw')).toBeFalsy();
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

    component.addPower('organization', 'pw');
    expect(fg.hasError('noPower')).toBeFalsy();
    expect(fg.hasError('noActionPerPower')).toBeTruthy();

    (fg.get('organization.pw.a') as FormControl).setValue(true);
    fg.updateValueAndValidity();
    expect(fg.hasError('noActionPerPower')).toBeFalsy();
  });


  it('withholds the organization tab while the product decision is open, without unwiring the scope', () => {
    const fg = attachForm(component);
    component.ngOnInit();

    expect(component.visibleScopes).toEqual(['domain']);
    expect(fg.contains('organization')).toBe(true);
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
    it('falls back to a generic label when the session carries no organization', () => {
      (authService.extractRawMandator as jest.Mock).mockReturnValue(null);
      attachForm(component);
      component.ngOnInit();

      expect(component.organizationName()).toBe('');
      expect(component.scopeLabel('organization')).toBe('power.scope.organization');
    });

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

    expect(component.visibleScopes.length).toBe(1);
    expect(component.isScopeSelectable).toBe(false);

    const tab: HTMLButtonElement = fixture.nativeElement.querySelector('.scope-tab');
    expect(tab.disabled).toBe(true);
  });

});
