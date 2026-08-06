import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal, Signal, WritableSignal, computed } from '@angular/core';
import { By } from '@angular/platform-browser';
import { CredentialIssuanceComponent } from './credential-issuance.component';
import { CredentialIssuanceService } from '../../services/credential-issuance.service';
import { ActivatedRoute } from '@angular/router';
import { MatSelect } from '@angular/material/select';
import { FormControl, FormGroup, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('CredentialIssuanceComponent', () => {
  let component: CredentialIssuanceComponent;
  let fixture: ComponentFixture<CredentialIssuanceComponent>;
  let mockService: Partial<CredentialIssuanceService>;
  let routeMock: Partial<ActivatedRoute>;

  beforeEach(async () => {
    // Prepare basic signals for all service properties used
    const emptyFormGroup = new FormGroup({});

    mockService = {
      // Signals
      onBehalf$: signal(false) as WritableSignal<boolean>,
      hasSubmitted$: signal(false) as WritableSignal<boolean>,
      credentialTypesArr$: signal(['type1', 'learcredential.machine']) as WritableSignal<any>,
      isCatalogUnavailable$: signal(false) as WritableSignal<boolean>,
      selectedCredentialType$: signal(undefined) as WritableSignal<any>,
      credentialFormSchema$: signal(null) as Signal<any>,
      staticData$: signal(null) as Signal<any>,
      form$: signal(emptyFormGroup) as Signal<FormGroup>,
      formValue$: signal({ foo: 'bar' }) as Signal<Record<string, any>>,
      isFormValid$: signal(false) as WritableSignal<boolean>,
      bottomAlertMessages$: signal([]) as WritableSignal<string[]>,
      availableFormats$: signal([]) as Signal<any>,
      effectiveFormatOption$: signal(null) as Signal<any>,
      grantTypeOptions: [],
      selectedGrantType$: signal({ value: 'authorization_code', labelKey: 'key' }) as WritableSignal<any>,
      deliveryOptions: [],
      selectedDelivery$: signal({ value: 'email', labelKey: 'key' }) as WritableSignal<any>,
      // Methods
      updateSelectedType: jest.fn(),
      updateSelectedGrantType: jest.fn(),
      updateSelectedDelivery: jest.fn(),
      canLeave: jest.fn().mockReturnValue(true),
      canDeactivate: jest.fn().mockReturnValue('canDeactivateReturn'),
      openLeaveConfirm: jest.fn().mockReturnValue(true),
      updateSelectedFormat: jest.fn(),
      openSubmitDialog: jest.fn(),
      openLEARCredentialMachineSubmitDialog: jest.fn(),
    };

    routeMock = {
      snapshot: { pathFromRoot: [{ url: [] }] } as any
    };

    await TestBed.configureTestingModule({
      imports: [CredentialIssuanceComponent, ReactiveFormsModule, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        { provide: CredentialIssuanceService, useValue: mockService },
        { provide: ActivatedRoute, useValue: routeMock },
      ]
    })
    // This is needed because the service is provided at component level
    .overrideComponent(CredentialIssuanceComponent, {
      remove: {
        providers: [CredentialIssuanceService]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CredentialIssuanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize onBehalf$ based on route', () => {
    expect(mockService.onBehalf$!()).toBeFalsy();
  });

  describe('credential type selector empty state (EC-01 / EC-04)', () => {
    const emptyState = () => fixture.nativeElement.querySelector('[role="status"]');

    it('should render the selector when there are issuable types', () => {
      expect(fixture.nativeElement.querySelector('mat-select')).toBeTruthy();
      expect(emptyState()).toBeNull();
    });

    it('should hide the selector and announce the empty state when no type is enabled (EC-01)', () => {
      (mockService.credentialTypesArr$ as WritableSignal<any>).set([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();
      expect(fixture.nativeElement.querySelector('mat-option')).toBeNull();

      const message = emptyState();
      expect(message).toBeTruthy();
      expect(message.getAttribute('aria-live')).toBe('polite');
      expect(message.textContent).toContain('credentialIssuance.emptySelector.noTypes');
    });

    it('should announce that the catalogue is unavailable when the metadata could not be loaded (EC-04)', () => {
      (mockService.credentialTypesArr$ as WritableSignal<any>).set([]);
      (mockService.isCatalogUnavailable$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      const message = emptyState();
      expect(message.textContent).toContain('credentialIssuance.emptySelector.catalogUnavailable');
      // fail-closed: no fallback option is offered
      expect(fixture.nativeElement.querySelector('mat-option')).toBeNull();
    });
  });

  describe('required field validation (AC-07)', () => {
    const submitButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('button[type="submit"]');

    beforeEach(() => {
      // Minimal schema with one required field, equivalent to the mandatee group derived in T8.
      const form = new FormGroup({
        mandatee: new FormGroup({
          firstName: new FormControl('', Validators.required)
        })
      });
      (mockService.form$ as WritableSignal<any>).set(form);
      (mockService.credentialFormSchema$ as WritableSignal<any>).set([
        {
          id: 1,
          key: 'mandatee',
          type: 'group',
          display: 'main',
          groupFields: [{ key: 'firstName', type: 'control', controlType: 'text', validators: [{ name: 'required' }] }]
        }
      ]);
      (mockService.selectedCredentialType$ as WritableSignal<any>).set('learcredential.employee');
      (mockService.isFormValid$ as WritableSignal<boolean>).set(form.valid);
      fixture.detectChanges();
    });

    it('should keep the submit control disabled while a required field is empty', () => {
      expect(submitButton().disabled).toBe(true);
    });

    it('should not trigger the issuance when the form is invalid', () => {
      component.onSubmit();

      expect(mockService.openSubmitDialog).not.toHaveBeenCalled();
      expect(mockService.openLEARCredentialMachineSubmitDialog).not.toHaveBeenCalled();
    });

    it('should enable the submit control once every required field is filled in', () => {
      const form = mockService.form$!() as FormGroup;
      form.get('mandatee.firstName')!.setValue('Alice');
      (mockService.isFormValid$ as WritableSignal<boolean>).set(form.valid);
      fixture.detectChanges();

      expect(submitButton().disabled).toBe(false);
    });
  });

  describe('onTypeSelectionChange', () => {
    it('should call updateSelectedType on the service', () => {
      const type = 'type1';
      const matSelect = {} as MatSelect;
      component.onTypeSelectionChange(type as any, matSelect);
      expect(mockService.updateSelectedType).toHaveBeenCalledWith(type, matSelect);
    });
  });

  describe('onFormatSelectionChange', () => {
    it('should call updateSelectedFormat on the service', () => {
      const option = { format: 'jwt_vc_json', label: 'JWT VC JSON' } as any;
      component.onFormatSelectionChange(option);
      expect(mockService.updateSelectedFormat).toHaveBeenCalledWith(option);
    });
  });

  describe('canLeave', () => {
    it('should delegate to service.canLeave()', () => {
      (mockService.canLeave as jest.Mock).mockReturnValue(false);
      expect(component.canLeave()).toBeFalsy();
      expect(mockService.canLeave).toHaveBeenCalled();
    });
  });

  describe('canDeactivate', () => {
    it('should delegate to service.canDeactivate()', () => {
      const result = component.canDeactivate();
      expect(mockService.canDeactivate).toHaveBeenCalled();
      expect(result).toBe('canDeactivateReturn');
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should not proceed when form is invalid', () => {
      // Override component signals
      (component as any).isFormValid$ = () => false;
      (component as any).formValue$ = () => ({ foo: 'bar' });

      component.onSubmit();

      expect(console.error).toHaveBeenCalledWith('Invalid form: ');
      expect(mockService.openSubmitDialog).not.toHaveBeenCalled();
      expect(mockService.openLEARCredentialMachineSubmitDialog).not.toHaveBeenCalled();
    });

    it('EUD-73 §12 Threat 3: does not dump the form values (PII) to the console when blocking', () => {
      (console.error as jest.Mock).mockClear();
      (component as any).isFormValid$ = () => false;
      (component as any).formValue$ = () => ({ foo: 'bar' });

      component.onSubmit();

      expect(console.error).not.toHaveBeenCalledWith({ foo: 'bar' });
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('should open LEARCredentialMachine dialog when selected type is LEARCredentialMachine', () => {
      (component as any).isFormValid$ = () => true;
      (component as any).formValue$ = () => ({ foo: 'bar' });
      (component as any).selectedCredentialType$ = () => 'learcredential.machine' as any;

      component.onSubmit();

      expect(mockService.openLEARCredentialMachineSubmitDialog).toHaveBeenCalled();
      expect(mockService.openSubmitDialog).not.toHaveBeenCalled();
    });

    it('should open default submit dialog for other credential types', () => {
      (component as any).isFormValid$ = () => true;
      (component as any).formValue$ = () => ({ foo: 'bar' });
      (component as any).selectedCredentialType$ = () => 'type1' as any;

      component.onSubmit();

      expect(mockService.openSubmitDialog).toHaveBeenCalled();
      expect(mockService.openLEARCredentialMachineSubmitDialog).not.toHaveBeenCalled();
    });
  });

  describe('EUD-73 — ES-02 fail-closed (no schema means the form does not render)', () => {
    it('does not render <form> nor the submit button when credentialFormSchema$ is null', () => {
      // mockService.credentialFormSchema$ is already signal(null) by default in the beforeEach
      expect(fixture.debugElement.query(By.css('form'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('button[type="submit"]'))).toBeFalsy();
    });
  });
});
