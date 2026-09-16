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
      isLoadingCatalog$: signal(false) as WritableSignal<boolean>,
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
      offerableModes$: signal([
        { value: 'direct', labelKey: 'credentialIssuance.delivery.direct' },
        { value: 'ui', labelKey: 'credentialIssuance.delivery.qrCode' },
        { value: 'email', labelKey: 'credentialIssuance.delivery.email' },
      ]) as WritableSignal<any>,
      selectedDeliveryModes$: signal(new Set()) as WritableSignal<any>,
      hasDeliveryCatalogReadFailed$: signal(false) as Signal<boolean>,
      // Methods
      updateSelectedType: jest.fn(),
      updateSelectedGrantType: jest.fn(),
      toggleDeliveryMode: jest.fn(),
      canLeave: jest.fn().mockReturnValue(true),
      canDeactivate: jest.fn().mockReturnValue('canDeactivateReturn'),
      openLeaveConfirm: jest.fn().mockReturnValue(true),
      updateSelectedFormat: jest.fn(),
      openSubmitDialog: jest.fn(),
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
    // The loading branch uses <output>, whose implicit role is already "status", so the live
    // region is matched by the element itself rather than by an explicit role attribute.
    const liveRegion = () => fixture.nativeElement.querySelector('[role="status"], output');

    it('should render the selector when there are issuable types', () => {
      expect(fixture.nativeElement.querySelector('mat-select')).toBeTruthy();
      expect(liveRegion()).toBeNull();
    });

    it('should hide the selector and announce the empty state when no type is enabled (EC-01)', () => {
      (mockService.credentialTypesArr$ as WritableSignal<any>).set([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();
      expect(fixture.nativeElement.querySelector('mat-option')).toBeNull();

      const message = liveRegion();
      expect(message).toBeTruthy();
      expect(message.getAttribute('aria-live')).toBe('polite');
      expect(message.textContent).toContain('credentialIssuance.emptySelector.noTypes');
    });

    it('should announce that the catalogue is unavailable when the metadata could not be loaded (EC-04)', () => {
      (mockService.credentialTypesArr$ as WritableSignal<any>).set([]);
      (mockService.isCatalogUnavailable$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      const message = liveRegion();
      expect(message.textContent).toContain('credentialIssuance.emptySelector.catalogUnavailable');
      // fail-closed: no fallback option is offered
      expect(fixture.nativeElement.querySelector('mat-option')).toBeNull();
    });

    // While the loads are in flight the type list is empty and no failure flag is raised, so
    // without this branch the screen showed — and announced — EC-01: "contact your tenant
    // administrator" about a catalogue that simply had not arrived yet.
    it('should show the loading state instead of the empty state while the catalogue loads', () => {
      (mockService.credentialTypesArr$ as WritableSignal<any>).set([]);
      (mockService.isLoadingCatalog$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();

      const message = liveRegion();
      expect(message.getAttribute('aria-live')).toBe('polite');
      expect(message.textContent).toContain('credentialIssuance.loadingCatalog');
      expect(message.textContent).not.toContain('credentialIssuance.emptySelector');
    });

    // The metadata service keeps its configurations for the whole session: a second visit
    // re-runs the load with a catalogue already in hand, and must not blink back to a spinner.
    it('should keep the selector while reloading when the catalogue is already known', () => {
      (mockService.isLoadingCatalog$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-select')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
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
      // A delivery mode must be marked for the submit gate in isolation from ES-01's own gate --
      // this suite is about the required-field validator, not the delivery selector.
      (mockService.selectedDeliveryModes$ as WritableSignal<any>).set(new Set(['email']));
      fixture.detectChanges();
    });

    it('should keep the submit control disabled while a required field is empty', () => {
      expect(submitButton().disabled).toBe(true);
    });

    it('should not trigger the issuance when the form is invalid', () => {
      component.onSubmit();

      expect(mockService.openSubmitDialog).not.toHaveBeenCalled();
    });

    it('should enable the submit control once every required field is filled in', () => {
      const form = mockService.form$!() as FormGroup;
      form.get('mandatee.firstName')!.setValue('Alice');
      (mockService.isFormValid$ as WritableSignal<boolean>).set(form.valid);
      fixture.detectChanges();

      expect(submitButton().disabled).toBe(false);
    });
  });

  // EUD-233 AD-4/AD-13: replaces the retired mat-radio-group delivery selector.
  describe('delivery selector (AC-02.x, AC-06, PO override 2026-09-16 superseding EC-05, ES-01)', () => {
    const checkboxInputs = (): HTMLInputElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('mat-checkbox input[type="checkbox"]'));
    const submitButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('button[type="submit"]');

    beforeEach(() => {
      // A submittable form + type, isolated from the required-field suite above -- this suite is
      // about the delivery gate, not the schema's own validators.
      const form = new FormGroup({});
      (mockService.form$ as WritableSignal<any>).set(form);
      (mockService.credentialFormSchema$ as WritableSignal<any>).set([]);
      (mockService.selectedCredentialType$ as WritableSignal<any>).set('learcredential.employee');
      (mockService.isFormValid$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();
    });

    it('renders one checkbox per offerable mode, from offerableModes$ (AC-02.1, AC-02.2, AC-02.4)', () => {
      expect(checkboxInputs().length).toBe(3);
    });

    it('renders no checkbox for a mode absent from offerableModes$ (AC-02.5 narrowing)', () => {
      (mockService.offerableModes$ as WritableSignal<any>).set([
        { value: 'email', labelKey: 'credentialIssuance.delivery.email' },
      ]);
      fixture.detectChanges();

      expect(checkboxInputs().length).toBe(1);
    });

    it("renders the service's default selection as checked (PO override 2026-09-16, supersedes EC-05)", () => {
      // The component only renders whatever selectedDeliveryModes$ reports; the defaulting rule
      // itself lives in, and is unit-tested against, CredentialIssuanceService. offerableModes$ is
      // mocked in order [direct, ui, email], so index 0 is the 'direct' checkbox.
      (mockService.selectedDeliveryModes$ as WritableSignal<any>).set(new Set(['direct']));
      fixture.detectChanges();

      const inputs = checkboxInputs();
      expect(inputs[0].checked).toBe(true);
      expect(inputs.slice(1).every(input => !input.checked)).toBe(true);
    });

    it('toggling a checkbox calls service.toggleDeliveryMode with the mode and checked state', () => {
      checkboxInputs()[0].click();
      fixture.detectChanges();

      expect(mockService.toggleDeliveryMode).toHaveBeenCalledWith('direct', true);
    });

    it('disables submit while no delivery mode is marked, even with a valid form (ES-01)', () => {
      expect(submitButton().disabled).toBe(true);
    });

    it('enables submit once a delivery mode is marked and the form is valid', () => {
      (mockService.selectedDeliveryModes$ as WritableSignal<any>).set(new Set(['email']));
      fixture.detectChanges();

      expect(submitButton().disabled).toBe(false);
    });

    it('refuses to submit and logs, rather than auto-marking a mode, when triggered with none marked (ES-01)', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      component.onSubmit();

      expect(mockService.openSubmitDialog).not.toHaveBeenCalled();
      expect(mockService.toggleDeliveryMode).not.toHaveBeenCalled();
    });
  });

  // EUD-233 AD-12: state 4 only, never blocking the form beneath it.
  describe('delivery catalogue unavailable banner (ES-08)', () => {
    it('renders nothing when the read has not failed', () => {
      expect(fixture.nativeElement.querySelector('app-alert-banner')).toBeNull();
    });

    it('renders the banner when hasDeliveryCatalogReadFailed$ is true', () => {
      (mockService.hasDeliveryCatalogReadFailed$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-alert-banner')).toBeTruthy();
    });

    it('does not prevent the type selector from rendering (non-blocking)', () => {
      (mockService.hasDeliveryCatalogReadFailed$ as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-select')).toBeTruthy();
    });
  });

  // EUD-233 AC-12.1/AC-12.2: the retired KeyGeneratorComponent leaves no trace. Regression only --
  // the mocked schema below never included a `keys` group (real schemas do not either, post-Task 17).
  describe('machine credential type has no key-generation surface (AC-12.1, AC-12.2)', () => {
    it('renders no key-related control for the machine type', () => {
      (mockService.selectedCredentialType$ as WritableSignal<any>).set('learcredential.machine');
      (mockService.credentialFormSchema$ as WritableSignal<any>).set([
        {
          id: 1,
          key: 'mandatee',
          type: 'group',
          display: 'main',
          groupFields: [{ key: 'domain', type: 'control', controlType: 'text', validators: [] }]
        }
      ]);
      (mockService.form$ as WritableSignal<any>).set(new FormGroup({}));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-key-generator')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('keys.title');
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

      expect(console.error).toHaveBeenCalledWith('Invalid form or no delivery mode selected: ');
      expect(mockService.openSubmitDialog).not.toHaveBeenCalled();
    });

    it('EUD-73 §12 Threat 3: does not dump the form values (PII) to the console when blocking', () => {
      (console.error as jest.Mock).mockClear();
      (component as any).isFormValid$ = () => false;
      (component as any).formValue$ = () => ({ foo: 'bar' });

      component.onSubmit();

      expect(console.error).not.toHaveBeenCalledWith({ foo: 'bar' });
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    // EUD-233 PO fix 2026-09-16: the machine-only checkbox confirmation dialog is gone -- the
    // private key is never shown before emission anymore (AC-12), so every credential type opens
    // the same submit confirmation.
    it('opens the same submit dialog for LEARCredentialMachine as for any other type', () => {
      (component as any).isFormValid$ = () => true;
      (component as any).formValue$ = () => ({ foo: 'bar' });
      (component as any).selectedCredentialType$ = () => 'learcredential.machine' as any;
      (component as any).selectedDeliveryModes$ = () => new Set(['email']);

      component.onSubmit();

      expect(mockService.openSubmitDialog).toHaveBeenCalled();
    });

    it('opens the default submit dialog for other credential types', () => {
      (component as any).isFormValid$ = () => true;
      (component as any).formValue$ = () => ({ foo: 'bar' });
      (component as any).selectedCredentialType$ = () => 'type1' as any;
      (component as any).selectedDeliveryModes$ = () => new Set(['email']);

      component.onSubmit();

      expect(mockService.openSubmitDialog).toHaveBeenCalled();
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
