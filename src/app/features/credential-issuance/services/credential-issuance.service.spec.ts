import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CredentialIssuanceService } from './credential-issuance.service';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import { CountryService } from 'src/app/shared/services/country.service';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { CREDENTIAL_SCHEMA_PROVIDERS, IssuanceSchemaBuilder } from './issuance-schema-builders/issuance-schema-builder';
import { TranslateModule } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { IssuanceUiPolicyService } from 'src/app/core/services/issuance-ui-policy.service';
import { ThemeService } from 'src/app/core/services/theme.service';
import { MatDialog } from '@angular/material/dialog';

class MockDialogWrapperService {
  // The real DialogWrapperService internally subscribes to the observable returned by the
  // callback (confirm$.pipe(..., switchMap(() => callback())).subscribe(...)) — without
  // reproducing that subscription here, submitCredentialPayload()'s chain never actually
  // runs (RxJS observables are cold until someone subscribes).
  openDialogWithCallback = jest.fn((comp, data, cb) => cb().subscribe());
  openDialog = jest.fn(() => ({ afterClosed: () => of(true) }));
}

describe('CredentialIssuanceService', () => {
  let service: CredentialIssuanceService;
  let mockProcedureService: { createProcedure: jest.Mock };
  let mockSchemaBuilder: { formSchemasBuilder: jest.Mock, getIssuancePowerFormSchema: jest.Mock };
  let dialogService: MockDialogWrapperService;
  let mockMatDialog: { open: jest.Mock };
  let mockAuthService: {
    getMandateeEmail: jest.Mock
  };
  let issuableTypes: ReturnType<typeof signal<string[]>>;
  let metadataLoadFailed: ReturnType<typeof signal<boolean>>;
  let policyLoadFailed: ReturnType<typeof signal<boolean>>;
  // The policy load is held open by default: with an already-resolved promise the forkJoin
  // settles between beforeEach and the test body, leaving no "still loading" window to assert
  // on. Tests that need the loads finished call resolvePolicyLoad() themselves.
  let resolvePolicyLoad!: () => void;
  let policyLoadPromise: Promise<void>;
  let mockMetadataService: {
    loadMetadata: jest.Mock;
    findConfigurationsForType: jest.Mock;
    getConfigurationById: jest.Mock;
    getIssuableCredentialTypes: jest.Mock;
    hasMetadataLoadFailed: jest.Mock;
  };


  beforeEach(() => {
    dialogService = new MockDialogWrapperService();
    // openCredentialOfferDialog() uses the real MatDialog directly (not the DialogWrapperService
    // mock above), because CredentialOfferDialogComponent needs a wider dialog width than the
    // wrapper's default. Without this mock, .open() would try to instantiate the real component
    // (which injects TenantService) and throw, which the pipe's catchError would silently turn
    // into a failure-dialog false positive.
    mockMatDialog = { open: jest.fn(() => ({ afterClosed: () => of(true) })) };
    mockProcedureService = { createProcedure: jest.fn() }
    mockSchemaBuilder = { formSchemasBuilder: jest.fn(), getIssuancePowerFormSchema: jest.fn() };
    mockAuthService = { getMandateeEmail: jest.fn(() => 'mandatee@example.com')};
    // Backed by real signals: if these were fixed values, the service's computed
    // signals would memoize and we couldn't test the recompute after loadMetadata().
    issuableTypes = signal<string[]>(['learcredential.employee', 'learcredential.machine']);
    metadataLoadFailed = signal<boolean>(false);
    policyLoadFailed = signal<boolean>(false);
    policyLoadPromise = new Promise<void>(resolve => { resolvePolicyLoad = resolve; });
    mockMetadataService = {
      loadMetadata: jest.fn(() => of(undefined)),
      findConfigurationsForType: jest.fn(() => []),
      getConfigurationById: jest.fn(() => undefined),
      getIssuableCredentialTypes: jest.fn(() => issuableTypes()),
      hasMetadataLoadFailed: jest.fn(() => metadataLoadFailed())
    };

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        CredentialIssuanceService,
        { provide: DialogWrapperService, useValue: dialogService },
        { provide: MatDialog, useValue: mockMatDialog },
        // navigate() must return a Promise (Router's real contract): submitCredentialPayload()'s
        // chain wraps the navigation with from(...), which blows up synchronously if it
        // receives undefined instead of a thenable.
        { provide: Router, useValue: { navigate: jest.fn(() => Promise.resolve(true)) } },
        { provide: ActivatedRoute, useValue: { snapshot: { pathFromRoot: [] } } },
        { provide: IssuanceSchemaBuilder, useValue: mockSchemaBuilder },
        IssuanceRequestFactoryService,
        CountryService,
        { provide: CredentialProcedureService, useValue: mockProcedureService },
        { provide: CredentialIssuerMetadataService, useValue: mockMetadataService },
        // The published per-tenant policy is fail-closed: an unusable document is a second
        // reason the selector can be empty for a cause the Operator cannot act on.
        { provide: IssuanceUiPolicyService, useValue: { load: jest.fn(() => policyLoadPromise), loadFailed: () => policyLoadFailed() } },
        // Not related to AD-1 (that dependency was already removed from CredentialIssuanceService):
        // IssuanceRequestFactoryService, provided for real in this TestBed, injects ThemeService
        // on its own to resolve the payload's mandatee/mandator.
        { provide: ThemeService, useValue: { tenantDomain: 'TENANT' } }
      ]
    });
    service = TestBed.inject(CredentialIssuanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Replaces 'should expose only employee credential type for KPMG tenant'.
  // AD-1: there are no more per-tenant special cases in the frontend.
  describe('credentialTypesArr$ (AD-1)', () => {
    it('should expose the types derived from the issuer metadata', () => {
      expect(service.credentialTypesArr$()).toEqual(['learcredential.employee', 'learcredential.machine']);
      expect(service.isCatalogUnavailable$()).toBe(false);
    });

    it('should recompute when the metadata publishes a different catalogue', () => {
      issuableTypes.set(['learcredential.employee']);

      expect(service.credentialTypesArr$()).toEqual(['learcredential.employee']);
    });

    it('should expose an empty selector when the tenant has no enabled forms (EC-01)', () => {
      issuableTypes.set([]);

      expect(service.credentialTypesArr$()).toEqual([]);
      expect(service.isCatalogUnavailable$()).toBe(false);
    });

    it('should expose an empty selector and flag the catalogue as unavailable when metadata fails (EC-04)', () => {
      issuableTypes.set([]);
      metadataLoadFailed.set(true);

      expect(service.credentialTypesArr$()).toEqual([]);
      expect(service.isCatalogUnavailable$()).toBe(true);
    });

    // The per-tenant policy is fail-closed, so an unusable document means "no forms", not "no
    // restrictions" — and the Operator must be told, rather than shown a bare empty selector.
    it('should flag the catalogue as unavailable when the issuance UI policy fails (EC-04)', () => {
      issuableTypes.set([]);
      policyLoadFailed.set(true);

      expect(service.credentialTypesArr$()).toEqual([]);
      expect(service.isCatalogUnavailable$()).toBe(true);
    });

    it('should load the issuer metadata once on construction', () => {
      expect(mockMetadataService.loadMetadata).toHaveBeenCalledTimes(1);
    });
  });

  // The window between construction and both loads settling. An empty type list with neither
  // loadFailed() raised is not "this tenant has no forms", so the screen needs to be able to
  // tell the two apart instead of defaulting to the EC-01 message.
  describe('isLoadingCatalog$', () => {
    it('should be true while the policy and the metadata are still in flight', () => {
      expect(service.isLoadingCatalog$()).toBe(true);
    });

    // The policy load is a promise, so the forkJoin completes on the microtask queue: this
    // needs a real await, not fakeAsync/tick().
    it('should fall once both loads have settled', async () => {
      resolvePolicyLoad();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(service.isLoadingCatalog$()).toBe(false);
    });

    // The flag says "the answer is not in yet", not "the answer was good": a catalogue that
    // could not be loaded must reach its own EC-04 message rather than spin forever.
    it('should fall even when both loads resolve to a failure', async () => {
      metadataLoadFailed.set(true);
      policyLoadFailed.set(true);

      resolvePolicyLoad();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(service.isLoadingCatalog$()).toBe(false);
      expect(service.isCatalogUnavailable$()).toBe(true);
    });
  });

  // The version rule itself lives in CredentialIssuerMetadataService (one configuration per
  // type+format, newest version) — covered by its own spec. What matters here is that the
  // selector, the rendered form and the submitted payload all follow the configuration it picks.
  describe('availableFormats$ (newest version per format)', () => {
    it('should render one option per format, never one per version', () => {
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.w3c.2', format: 'jwt_vc_json' },
        { configId: 'learcredential.employee.sd.1', format: 'dc+sd-jwt' }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');

      const formats = service.availableFormats$();

      expect(formats.map(f => f.configId)).toEqual([
        'learcredential.employee.w3c.2',
        'learcredential.employee.sd.1'
      ]);
      // one radio button per format => no two options may share a label
      expect(new Set(formats.map(f => f.labelKey)).size).toBe(formats.length);
    });

    it('should collapse two lineages declaring the same format onto their newest version', () => {
      // Defensive: well-formed ids map one format family to one format, so this only happens
      // if the metadata ever declares otherwise — and two radio buttons carrying the identical
      // label would leave the Operator unable to tell which one they are submitting.
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.jwt.1', format: 'jwt_vc_json' },
        { configId: 'learcredential.employee.w3c.2', format: 'jwt_vc_json' }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');

      expect(service.availableFormats$().map(f => f.configId)).toEqual(['learcredential.employee.w3c.2']);
    });

    it('should only fabricate a default option for a type the selector cannot offer', () => {
      // Guards the fallback in availableFormats$ against the hardcoded issuance floor
      // (core/temporary/pinned-issuable-versions.ts): it fires when a type is selected while
      // the metadata has no configuration for it, which would put back a form for a type whose
      // every version was filtered out. Unreachable, because the selector and the format
      // options read the same version-filtered set — a type with no surviving configuration is
      // also absent from credentialTypesArr$, so it can never be selected.
      issuableTypes.set([]);
      mockMetadataService.findConfigurationsForType.mockReturnValue([]);
      service.selectedCredentialType$.set('learcredential.employee');

      expect(service.credentialTypesArr$()).toEqual([]);
      expect(service.availableFormats$()).toEqual([
        {
          configId: 'learcredential.employee',
          format: 'jwt_vc_json',
          labelKey: 'credentialIssuance.format.w3cVcDm'
        }
      ]);
    });

    it('should read the form claims off the selected configuration (AD-2)', () => {
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.w3c.2', format: 'jwt_vc_json' }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');

      service.selectedConfigClaims$();

      expect(mockMetadataService.getConfigurationById).toHaveBeenCalledWith('learcredential.employee.w3c.2');
    });
  });

  describe('deliveryOptions (EUD-168)', () => {

    const selectType = (configId: string) => {
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId, format: 'jwt_vc_json' }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');
    };

    it('derives the offered modes from the selected configuration, not from a fixed list', () => {
      selectType('learcredential.employee.w3c.4');
      mockMetadataService.getConfigurationById.mockReturnValue({
        format: 'jwt_vc_json',
        proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['ES256'] } },
      });

      service.deliveryOptions();

      expect(mockMetadataService.getConfigurationById)
        .toHaveBeenCalledWith('learcredential.employee.w3c.4');
    });

    it('offers the wallet modes for a holder-bound type', () => {
      // Today this narrows nothing -- the catalogue holds only wallet modes, which are always
      // eligible. The assertion pins the behaviour so adding the direct mode (EUD-233) cannot
      // silently start offering it for bound types.
      selectType('learcredential.employee.w3c.4');
      mockMetadataService.getConfigurationById.mockReturnValue({
        format: 'jwt_vc_json',
        proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['ES256'] } },
      });

      expect(service.deliveryOptions().map(o => o.value)).toEqual(['email', 'ui']);
    });

    it('offers the wallet modes for an unbound type too', () => {
      selectType('learcredential.machine.w3c.3');
      mockMetadataService.getConfigurationById.mockReturnValue({ format: 'jwt_vc_json' });

      expect(service.deliveryOptions().map(o => o.value)).toEqual(['email', 'ui']);
    });

    it('falls back to the full catalogue when no type is selected', () => {
      expect(service.deliveryOptions().map(o => o.value)).toEqual(['email', 'ui']);
    });
  });

  describe('submitCredentialPayload (Slice C)', () => {
    const successDialogData = expect.objectContaining({
      title: 'credentialIssuance.create-success-dialog.title',
      status: 'default'
    });
    const errorDialogData = expect.objectContaining({
      title: 'credentialIssuance.create-error-dialog.title',
      status: 'error'
    });

    const givenASubmittableForm = () => {
      // Set before the type is selected: availableFormats$ is a lazy computed keyed on the
      // selected type, so a later change to this mock would not be picked up.
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.w3c.2', format: 'jwt_vc_json' },
        { configId: 'learcredential.employee.sd.1', format: 'dc+sd-jwt' }
      ]);
      // IssuanceRequestFactoryService is NOT mocked in this file (it's the real one, to
      // test the actual request construction) — it needs 'mandatee.email' and a
      // 'power' (even if empty) in the form, and a full 'mandator' in staticData
      // (onBehalf=false reads the mandator from there, not from the form), or it blows up
      // with "Object.entries(undefined)" / "Could not get valid mandator on behalf".
      mockSchemaBuilder.formSchemasBuilder.mockReturnValue([
        [
          { id: 1, key: 'mandatee', type: 'group', display: 'main', groupFields: [
            { key: 'email', type: 'control', controlType: 'text', validators: [] }
          ] },
          { id: 2, key: 'power', type: 'group', display: 'main', groupFields: [] }
        ],
        {
          mandator: [
            { key: 'country', value: 'ES' },
            { key: 'organizationIdentifier', value: 'B12345678' },
            { key: 'organization', value: 'Acme Corp' },
            { key: 'email', value: 'mandator@acme.example' },
            { key: 'serialNumber', value: 'S-001' }
          ]
        }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');
      // form$/formValue$ are derived via toObservable(), which pushes changes through an
      // internal effect() scheduled as a microtask: without this, formValue$() would keep
      // returning the initial value (the empty FormGroup from construction) for the rest of the test.
      TestBed.flushEffects();
    };

    const originalLocation = window.location;

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation();
      // location.reload() used to live in the success chain (pre-existing, out of this Story's
      // scope, since removed on merge from main). jsdom exposes `reload` as non-configurable on
      // the real Location instance, so instead of redefining that property, window.location is
      // entirely replaced with an equivalent plain object with a jest.fn() stub — restored in afterEach.
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, reload: jest.fn() }
      });
      givenASubmittableForm();
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
      jest.restoreAllMocks();
    });

    it('should show the success dialog when the response carries no offer URI (AC-05, e.g. email delivery)', () => {
      mockProcedureService.createProcedure.mockReturnValue(of({}));

      service.openSubmitDialog();

      expect(dialogService.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), successDialogData);
      expect(mockMatDialog.open).not.toHaveBeenCalled();
      expect(service.hasSubmitted$()).toBe(true);
    });

    it('should show the scannable QR dialog when the response carries an offer URI (AC-05, "Código QR" delivery)', () => {
      mockProcedureService.createProcedure.mockReturnValue(of({ credential_offer_uri: 'openid-credential-offer://abc' }));

      service.openSubmitDialog();

      // The backend only sets credential_offer_uri for DeliveryMode.UI (returnsUri=true) --
      // never for EMAIL -- so this is already scoped to the "Código QR" delivery option.
      expect(mockMatDialog.open).toHaveBeenCalledTimes(1);
      expect(mockMatDialog.open.mock.calls[0][1].data).toEqual({ credentialOfferUri: 'openid-credential-offer://abc' });
      expect(dialogService.openDialog).not.toHaveBeenCalled();
      expect(service.hasSubmitted$()).toBe(true);
    });

    it('should submit the newest version of the selected format, not the bare type', () => {
      mockProcedureService.createProcedure.mockReturnValue(of({}));

      service.openSubmitDialog();

      const [request] = mockProcedureService.createProcedure.mock.calls[0] as any[];
      expect(request.credential_configuration_id).toBe('learcredential.employee.w3c.2');
    });

    it('should navigate to the credential list after a successful issuance (AC-03)', () => {
      const router = TestBed.inject(Router);
      mockProcedureService.createProcedure.mockReturnValue(of({}));

      service.openSubmitDialog();

      expect(router.navigate).toHaveBeenCalledWith(['/organization/credentials']);
    });

    it.each([
      ['400 invalid payload (ES-01)', { status: 400 }],
      ['403 configuration not allowed for the tenant (ES-02)', { status: 403 }],
      ['500 issuer failure (ES-04)', { status: 500 }]
    ])('should show an observable failure on %s', (_label, httpError) => {
      mockProcedureService.createProcedure.mockReturnValue(throwError(() => httpError));

      service.openSubmitDialog();

      expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), errorDialogData);
    });

    it('should keep the form data and let the operator retry after a failure (AC-06)', () => {
      const router = TestBed.inject(Router);
      mockProcedureService.createProcedure.mockReturnValue(throwError(() => ({ status: 500 })));

      service.openSubmitDialog();

      // no reset and no navigation: the entered data survives
      expect(service.hasSubmitted$()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(service.form$().pristine).toBe(true);
    });

    it('should not leak technical detail into the failure message (ES-02)', () => {
      mockProcedureService.createProcedure.mockReturnValue(
        throwError(() => ({ status: 403, error: { detail: 'credential_configuration_id not allowed for tenant acme' } }))
      );

      service.openSubmitDialog();

      const [, dialogData] = dialogService.openDialog.mock.calls[0] as any[];
      expect(JSON.stringify(dialogData)).not.toContain('acme');
      expect(JSON.stringify(dialogData)).not.toContain('403');
    });

    it('should release the loading state and report a failure when the issuer does not answer (ES-05)', () => {
      jest.useFakeTimers();
      mockProcedureService.createProcedure.mockReturnValue(NEVER);

      service.openSubmitDialog();
      jest.advanceTimersByTime(30_000);

      expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), errorDialogData);
      jest.useRealTimers();
    });

    it('should guard the double submit through hasSubmitted$ and the async dialog (ES-03)', () => {
      mockProcedureService.createProcedure.mockReturnValue(of({}));

      service.openSubmitDialog();

      // after success the screen navigates away and canLeave() stops blocking: the Operator
      // must never end up with two contradictory success confirmations on screen.
      expect(service.hasSubmitted$()).toBe(true);
      expect(service.canLeave()).toBe(true);
      expect(dialogService.openDialog).toHaveBeenCalledTimes(1);
    });
  });

  describe('openLeaveConfirm', () => {
    it('should return true when user confirms', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
      expect(service.openLeaveConfirm()).toBe(true);
      expect(globalThis.confirm).toHaveBeenCalled();
    });

    it('should return false when user cancels', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(false);
      expect(service.openLeaveConfirm()).toBe(false);
    });
  });

  describe('updateSelectedType', () => {
    it('should call globalThis.confirm when type changes and form is dirty', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
      jest.spyOn(service, 'canLeave').mockReturnValue(false);
      (service as any).selectedCredentialType$.set('learcredential.employee');
      const mockSelect = { value: 'learcredential.employee' } as any;
      service.updateSelectedType('learcredential.machine', mockSelect);
      expect(globalThis.confirm).toHaveBeenCalled();
      expect((service as any).selectedCredentialType$()).toBe('learcredential.machine');
    });

    it('should not change type when user cancels confirm', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(false);
      jest.spyOn(service, 'canLeave').mockReturnValue(false);
      (service as any).selectedCredentialType$.set('learcredential.employee');
      const mockSelect = { value: 'learcredential.employee' } as any;
      service.updateSelectedType('learcredential.machine', mockSelect);
      expect(mockSelect.value).toBe('learcredential.employee');
      expect((service as any).selectedCredentialType$()).toBe('learcredential.employee');
    });
  });

  describe('isFormValid$ / gate hardening (EUD-73 T11)', () => {
    const REQUIRED_FIELD_SCHEMA: any = [
      {
        id: 1,
        key: 'firstName',
        type: 'control',
        controlType: 'text',
        display: 'main',
        validators: [{ name: 'required' }],
      },
    ];

    function selectTypeWithSchema(schema: any) {
      mockSchemaBuilder.formSchemasBuilder.mockReturnValue([schema, {}]);
      service.updateSelectedType('learcredential.employee', {} as any);
    }

    it('ES-02: with no type selected, isFormValid$ is false (fail-closed) and the request is not sent', fakeAsync(() => {
      tick();
      TestBed.flushEffects();
      expect(service.isFormValid$()).toBe(false);

      service.openSubmitDialog();

      expect(mockProcedureService.createProcedure).not.toHaveBeenCalled();
    }));

    it('ES-02: a schema with 0 fields is also fail-closed (the resulting FormGroup would be VALID in Angular)', fakeAsync(() => {
      selectTypeWithSchema([]);
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(false);
    }));

    it('AC-02: an empty required field blocks isFormValid$ and the request is not sent', fakeAsync(() => {
      selectTypeWithSchema(REQUIRED_FIELD_SCHEMA);
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(false);

      service.openSubmitDialog();

      expect(mockProcedureService.createProcedure).not.toHaveBeenCalled();
    }));

    it('AC-04 / ES-03: correcting the field re-validates the current FormGroup state (not a cached flag)', fakeAsync(() => {
      selectTypeWithSchema(REQUIRED_FIELD_SCHEMA);
      tick();
      expect(service.isFormValid$()).toBe(false);

      service.form$().get('firstName')!.setValue('Alice');
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(true);

      // Anti-cache clearing it again must block again, not stay "stuck" on true
      service.form$().get('firstName')!.setValue('');
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(false);
    }));
  });
});
