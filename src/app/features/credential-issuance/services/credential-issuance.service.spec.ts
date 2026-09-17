import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CredentialIssuanceService } from './credential-issuance.service';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import { IssuanceHolderKeyService } from './issuance-holder-key.service';
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
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';
import { HolderPrivateKeyStore } from 'src/app/core/services/holder-private-key-store.service';
import { CredentialCatalogService } from 'src/app/core/services/credential-catalog.service';
import { DeliveryEligibilitySnapshot } from 'src/app/core/models/entity/delivery-eligibility-snapshot';
import { HolderBinding } from 'src/app/core/models/entity/holder-binding';
import { HolderKeyGenerationError } from 'src/app/core/models/entity/holder-key-generation-error';
import { DirectCredentialResultDialogComponent } from 'src/app/shared/components/dialog/direct-credential-result-dialog/direct-credential-result-dialog.component';
import { CredentialOfferDialogComponent } from 'src/app/shared/components/dialog/credential-offer-dialog/credential-offer-dialog.component';

class MockDialogWrapperService {
  // The real DialogWrapperService internally subscribes to the observable returned by the
  // callback (confirm$.pipe(..., switchMap(() => callback())).subscribe(...)) — without
  // reproducing that subscription here, submitCredentialPayload()'s chain never actually
  // runs (RxJS observables are cold until someone subscribes).
  openDialogWithCallback = jest.fn((comp, data, cb) => cb().subscribe());
  openDialog = jest.fn(() => ({ afterClosed: () => of(true) }));
}

/** EUD-233 AD-9: state 1, offering all three modes for every configId this file exercises. */
const OPEN_CATALOG_SNAPSHOT: DeliveryEligibilitySnapshot = {
  status: 'read',
  modesByConfigId: new Map([
    ['learcredential.employee.w3c.2', ['direct', 'ui', 'email']],
    ['learcredential.employee.sd.1', ['direct', 'ui', 'email']],
    ['learcredential.employee', ['direct', 'ui', 'email']],
    ['learcredential.machine.w3c.3', ['direct', 'ui', 'email']],
    ['learcredential.machine.sd.1', ['direct', 'ui', 'email']],
    ['learcredential.machine', ['direct', 'ui', 'email']],
    // Fixture-only configIds for the delivery-mode defaulting suite below: narrower offerable
    // sets than the "everything open" ones above, never reused by any other describe block.
    ['learcredential.employee.email-only.1', ['email']],
    ['learcredential.employee.ui-only.1', ['ui']],
  ]),
};

describe('CredentialIssuanceService', () => {
  let service: CredentialIssuanceService;
  let mockProcedureService: { createProcedure: jest.Mock };
  let mockSchemaBuilder: { formSchemasBuilder: jest.Mock, getIssuancePowerFormSchema: jest.Mock };
  let dialogService: MockDialogWrapperService;
  let mockMatDialog: { open: jest.Mock };
  let mockAuthService: {
    getMandateeEmail: jest.Mock
  };
  let mockCatalogService: { fetchCatalog: jest.Mock; loadDeliveryEligibility: jest.Mock };
  let mockHolderKeyService: { generateForSubmission: jest.Mock; clear: jest.Mock };
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
    // jsdom's `crypto` does not implement randomUUID() in this test environment (unlike
    // crypto.subtle, which key-generator.service.spec.ts already has to stub separately) --
    // submitCredentialPayload() mints one per attempt (AD-6).
    if (typeof globalThis.crypto.randomUUID !== 'function') {
      (globalThis.crypto as any).randomUUID = jest.fn(() => '11111111-1111-1111-1111-111111111111');
    }
    dialogService = new MockDialogWrapperService();
    // openCredentialOfferDialog() / openDirectCredentialResultDialog() use the real MatDialog
    // directly (not the DialogWrapperService mock above), because those components need dialog
    // options (width, disableClose, closeOnNavigation) the wrapper's defaults don't offer.
    // Without this mock, .open() would try to instantiate the real component (which injects
    // TenantService/UncopiedArtifactCloseGuard) and throw, which the pipe's catchError would
    // silently turn into a failure-dialog false positive.
    mockMatDialog = { open: jest.fn(() => ({ afterClosed: () => of(true) })) };
    mockProcedureService = { createProcedure: jest.fn() }
    mockSchemaBuilder = { formSchemasBuilder: jest.fn(), getIssuancePowerFormSchema: jest.fn() };
    mockAuthService = { getMandateeEmail: jest.fn(() => 'mandatee@example.com')};
    mockCatalogService = {
      fetchCatalog: jest.fn(() => of([])),
      loadDeliveryEligibility: jest.fn(() => of(OPEN_CATALOG_SNAPSHOT)),
    };
    // Real crypto generation is out of scope here (covered by issuance-holder-key.service.spec.ts,
    // Task 35) -- this file is about what the SERVICE does with the HolderBinding it gets back.
    // Default implementation wired below, once HolderPrivateKeyStore is injected.
    mockHolderKeyService = {
      generateForSubmission: jest.fn(),
      clear: jest.fn(),
    };
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
        { provide: CredentialCatalogService, useValue: mockCatalogService },
        { provide: IssuanceHolderKeyService, useValue: mockHolderKeyService },
        // HolderPrivateKeyStore / HolderKeyStoreService: real instances (root, simple signal
        // stores) rather than mocks, so seal verification (AC-10.1) and clear() semantics are
        // exercised for real, not merely assumed.
        HolderPrivateKeyStore,
        HolderKeyStoreService,
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

    // The real IssuanceHolderKeyService.generateForSubmission() seals the private hex into
    // HolderPrivateKeyStore AND writes the public JWK into HolderKeyStoreService, as two of its
    // three consumer writes (AD-6) -- mocking the service away must not also lose those side
    // effects, or takeSealedPrivateKey()/attachHolderKey() would never find anything, regardless
    // of what this file is trying to test.
    const privateKeyStore = TestBed.inject(HolderPrivateKeyStore);
    const holderKeyStore = TestBed.inject(HolderKeyStoreService);
    mockHolderKeyService.generateForSubmission.mockImplementation(
      (credentialConfigurationId: string, submissionId: string) => {
        const publicJwk = { kty: 'EC' as const, crv: 'P-256' as const, x: 'x-coord', y: 'y-coord' };
        privateKeyStore.set({ privateKeyHex: 'mock-private-key-hex', credentialConfigurationId, submissionId });
        holderKeyStore.set({ publicJwk, credentialConfigurationId, submissionId });
        return Promise.resolve<HolderBinding>({ didKey: 'did:key:zMock', publicJwk });
      }
    );
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

  // PO override 2026-09-16, supersedes EC-05's "no default" rule for the initial/reset state.
  describe('delivery mode defaulting (PO override 2026-09-16, supersedes EC-05)', () => {
    // The delivery-eligibility read is one of the three forkJoin sources gating construction
    // (isLoadingCatalog$'s own describe block above); the policy load is a Promise, so it only
    // settles on the microtask queue -- a real await, not fakeAsync/tick(). Without this,
    // _deliveryEligibility$ stays at its constructor default ({status: 'unreadable'}), and
    // offerableModes$ falls back to the schema-only, direct-less catalogue for every configId.
    const settleDeliveryEligibility = async () => {
      resolvePolicyLoad();
      await new Promise(resolve => setTimeout(resolve, 0));
    };

    it("defaults to 'direct' when it is offerable", async () => {
      await settleDeliveryEligibility();
      service.selectedCredentialType$.set('learcredential.employee');
      TestBed.flushEffects();

      expect([...service.selectedDeliveryModes$()]).toEqual(['direct']);
    });

    it("defaults to 'email' when 'direct' is not offerable but 'email' is", async () => {
      await settleDeliveryEligibility();
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.email-only.1', format: 'jwt_vc_json' }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');
      TestBed.flushEffects();

      expect([...service.selectedDeliveryModes$()]).toEqual(['email']);
    });

    it("leaves the selection empty when neither 'direct' nor 'email' is offerable -- never defaults to 'ui'", async () => {
      await settleDeliveryEligibility();
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.ui-only.1', format: 'jwt_vc_json' }
      ]);
      service.selectedCredentialType$.set('learcredential.employee');
      TestBed.flushEffects();

      expect(service.selectedDeliveryModes$().size).toBe(0);
    });

    it('does not clobber a deliberate operator selection that still contains a valid mode', async () => {
      await settleDeliveryEligibility();
      service.selectedCredentialType$.set('learcredential.employee');
      TestBed.flushEffects();
      expect([...service.selectedDeliveryModes$()]).toEqual(['direct']);

      // The operator unmarks 'direct' and marks 'email' instead -- still one valid mode, so the
      // defaulting effect must not step back in and re-add 'direct'.
      service.toggleDeliveryMode('direct', false);
      service.toggleDeliveryMode('email', true);
      TestBed.flushEffects();

      expect([...service.selectedDeliveryModes$()]).toEqual(['email']);
    });

    it('re-defaults after a type change prunes the selection down to nothing valid', async () => {
      await settleDeliveryEligibility();
      service.selectedCredentialType$.set('learcredential.employee');
      TestBed.flushEffects();
      expect([...service.selectedDeliveryModes$()]).toEqual(['direct']);

      // Switching to a configId that does not offer 'direct' prunes it away (EC-01); with nothing
      // valid left, the defaulting rule fires again, landing on 'email'.
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId: 'learcredential.employee.email-only.1', format: 'jwt_vc_json' }
      ]);
      service.selectedFormatOption$.set(null);
      service.updateSelectedFormat({ configId: 'learcredential.employee.email-only.1', format: 'jwt_vc_json', labelKey: 'k' });
      TestBed.flushEffects();

      expect([...service.selectedDeliveryModes$()]).toEqual(['email']);
    });
  });

  describe('submitCredentialPayload', () => {
    const successDialogData = expect.objectContaining({
      title: 'credentialIssuance.create-success-dialog.title',
      status: 'default'
    });
    const errorDialogData = expect.objectContaining({
      title: 'credentialIssuance.create-error-dialog.title',
      status: 'error'
    });

    /**
     * AD-13: the checkbox model -- replaces the whole selection with exactly these modes (never
     * additive across fixtures: a type change's EC-01 pruning effect only removes modes that
     * became non-offerable, so a mode marked by an earlier `givenASubmittable*Form()` call in the
     * same test would otherwise survive into a later, unrelated fixture).
     */
    const markDeliveryModes = (...modes: Array<'direct' | 'ui' | 'email'>) => {
      service.selectedDeliveryModes$.set(new Set(modes));
    };

    /**
     * `IssuanceHolderKeyService.generateForSubmission()` is Promise-based even when mocked to
     * resolve immediately, so the AD-8 exempt machine types' submit path always crosses a real
     * microtask boundary before reaching the HTTP call -- unlike the synchronous `of(undefined)`
     * path non-exempt types take. Every test that submits a machine-type form must await this.
     */
    const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

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
      markDeliveryModes('email');
    };

    /**
     * Same shape as givenASubmittableForm, but for an AD-8 exempt machine configId. No `keys`
     * schema group (Task 17 retired it, AC-12.1): the machine form is structurally identical to
     * any other type's.
     */
    const givenASubmittableMachineForm = (configId: string) => {
      mockMetadataService.findConfigurationsForType.mockReturnValue([
        { configId, format: 'jwt_vc_json' }
      ]);
      mockSchemaBuilder.formSchemasBuilder.mockReturnValue([
        [
          { id: 1, key: 'mandatee', type: 'group', display: 'main', groupFields: [] },
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
      service.selectedCredentialType$.set('learcredential.machine');
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

    describe('base outcome matrix (AC-01, AC-03.x, AC-04, AC-08, AC-09, EC-02, EC-03, EC-07)', () => {
      it('AC-01/EC-05: direct solo (non-machine) opens DirectCredentialResultDialogComponent with the credential only', () => {
        markDeliveryModes('direct');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } }]
        }));

        service.openSubmitDialog();

        expect(mockMatDialog.open).toHaveBeenCalledWith(
          DirectCredentialResultDialogComponent,
          expect.objectContaining({
            disableClose: true,
            closeOnNavigation: false,
            data: expect.objectContaining({
              signedCredential: 'signed-jwt',
              requiresHolderKeySection: false,
              privateKeyHex: undefined,
            })
          })
        );
        expect(service.hasSubmitted$()).toBe(true);
      });

      it('AC-03.1/AC-04: hybrid direct+ui, direct delivered, wallet failed -- credential surfaces, outcomes show both', () => {
        markDeliveryModes('direct', 'ui');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [
            { channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } },
            { channel: 'ui', status: 503, error: { type: 'delivery_failed', title: 'x', status: 503, detail: 'x' } }
          ]
        }));

        service.openSubmitDialog();

        const [, config] = mockMatDialog.open.mock.calls[0];
        expect(config.data.signedCredential).toBe('signed-jwt');
        expect(config.data.outcomes.get('direct')).toBe('delivered');
        expect(config.data.outcomes.get('ui')).toBe('failed');
      });

      it('AC-03.2/EC-07: all three modes, direct+ui delivered, email failed, fixed order preserved in the outcomes map', () => {
        markDeliveryModes('direct', 'ui', 'email');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [
            { channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } },
            { channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://abc' } },
            { channel: 'email', status: 503, error: { type: 'delivery_failed', title: 'x', status: 503, detail: 'x' } }
          ]
        }));

        service.openSubmitDialog();

        const [component, config] = mockMatDialog.open.mock.calls[0];
        expect(component).toBe(DirectCredentialResultDialogComponent);
        expect(config.data.credentialOfferUri).toBe('openid-credential-offer://abc');
        expect([...config.data.outcomes.keys()]).toEqual(['direct', 'ui', 'email']);
      });

      it('AC-08: direct solo, direct fails -- no result dialog, generic failure surfaces (ES-04-shaped)', () => {
        markDeliveryModes('direct');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 503, error: { type: 'delivery_failed', title: 'x', status: 503, detail: 'x' } }]
        }));
        const router = TestBed.inject(Router);

        service.openSubmitDialog();

        expect(mockMatDialog.open).not.toHaveBeenCalled();
        expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), errorDialogData);
        expect(router.navigate).not.toHaveBeenCalled();
        expect(service.hasSubmitted$()).toBe(false);
      });

      it('AC-09: hybrid direct+ui, direct fails, wallet delivers -- no result dialog, wallet outcome still shown', () => {
        markDeliveryModes('direct', 'ui');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [
            { channel: 'direct', status: 503, error: { type: 'delivery_failed', title: 'x', status: 503, detail: 'x' } },
            { channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://abc' } }
          ]
        }));
        const router = TestBed.inject(Router);

        service.openSubmitDialog();

        expect(mockMatDialog.open).toHaveBeenCalledWith(
          CredentialOfferDialogComponent,
          expect.objectContaining({
            data: expect.objectContaining({ requiresHolderKeySection: false, credentialOfferUri: 'openid-credential-offer://abc' })
          })
        );
        expect(mockMatDialog.open.mock.calls[0][1].data.outcomes.get('direct')).toBe('failed');
        expect(service.hasSubmitted$()).toBe(true); // envelope present (AD-8)
        expect(router.navigate).toHaveBeenCalled();
      });

      it('EC-02/AC-05.2: ui+email, no direct, both delivered -- extended CredentialOfferDialogComponent, no key section', () => {
        markDeliveryModes('ui', 'email');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [
            { channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://abc' } },
            { channel: 'email', status: 200 }
          ]
        }));

        service.openSubmitDialog();

        const [component, config] = mockMatDialog.open.mock.calls[0];
        expect(component).toBe(CredentialOfferDialogComponent);
        expect(config.data.requiresHolderKeySection).toBe(false);
        expect(config.disableClose).toBeFalsy();
        expect(config.closeOnNavigation).not.toBe(false);
      });

      it('AC-05.1 regression: single ui channel, no artifact to gate -- unchanged AS-IS dialog options', () => {
        markDeliveryModes('ui');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://abc' } }]
        }));

        service.openSubmitDialog();

        expect(mockMatDialog.open).toHaveBeenCalledWith(CredentialOfferDialogComponent, expect.objectContaining({
          width: '420px',
          disableClose: false,
          closeOnNavigation: true,
        }));
      });

      it('EC-03: email-only 207 with no error at all behaves like a plain 200 (no total failure)', () => {
        markDeliveryModes('email');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'email', status: 200 }]
        }));

        service.openSubmitDialog();

        expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), successDialogData);
        expect(service.hasSubmitted$()).toBe(true);
      });
    });

    describe('AC-07/AC-10.1/AC-12.1/AC-12.2: holder-key provisioning for the two AD-8 exempt machine types', () => {
      beforeEach(() => {
        givenASubmittableMachineForm('learcredential.machine.w3c.3');
        markDeliveryModes('direct');
      });

      it('AC-12.1: invokes IssuanceHolderKeyService.generateForSubmission() before building the request', async () => {
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } }]
        }));

        service.openSubmitDialog();
        await flushMicrotasks();

        expect(mockHolderKeyService.generateForSubmission).toHaveBeenCalledWith(
          'learcredential.machine.w3c.3', expect.any(String)
        );
        const [request] = mockProcedureService.createProcedure.mock.calls[0] as any[];
        expect(request.holder_key).toEqual({ jwk: { kty: 'EC', crv: 'P-256', x: 'x-coord', y: 'y-coord' } });
        expect(request.payload.mandatee.id).toBe('did:key:zMock');
      });

      it('AC-07: direct delivered -- the sealed private key reaches DirectCredentialResultDialogComponent', async () => {
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } }]
        }));

        service.openSubmitDialog();
        await flushMicrotasks();

        const [, config] = mockMatDialog.open.mock.calls[0];
        expect(config.data.requiresHolderKeySection).toBe(true);
        expect(config.data.privateKeyHex).toBe('mock-private-key-hex');
      });

      it('AC-10.1: the key is unavailable in the store when the response arrives -- degrades to credential-only, no throw', async () => {
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } }]
        }));
        // Simulates a reload between submit and response: generation succeeds (the request still
        // carries holder_key), but the private half never makes it into (or survives in) the store.
        mockHolderKeyService.generateForSubmission.mockImplementation(() => Promise.resolve<HolderBinding>({
          didKey: 'did:key:zMock',
          publicJwk: { kty: 'EC', crv: 'P-256', x: 'x-coord', y: 'y-coord' },
        }));

        service.openSubmitDialog();
        await flushMicrotasks();

        const [, config] = mockMatDialog.open.mock.calls[0];
        expect(config.data.requiresHolderKeySection).toBe(true);
        expect(config.data.privateKeyHex).toBeUndefined();
      });

      it('2026-09-17 hardening: a public-key entry sealed to a different submission is not attached (holder_key omitted, never a stale cnf)', async () => {
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } }]
        }));
        // Simulates a stale/foreign entry surviving in the root HolderKeyStoreService under a
        // different (configId, submissionId) than this attempt's own -- generateForSubmission()
        // itself always writes a correctly-sealed entry, so this can only happen via a bug
        // elsewhere; attachHolderKey() must still refuse to trust it.
        mockHolderKeyService.generateForSubmission.mockImplementation(() => {
          const holderKeyStore = TestBed.inject(HolderKeyStoreService);
          holderKeyStore.set({
            publicJwk: { kty: 'EC', crv: 'P-256', x: 'stale-x', y: 'stale-y' },
            credentialConfigurationId: 'some-other-config',
            submissionId: 'some-other-submission',
          });
          return Promise.resolve<HolderBinding>({
            didKey: 'did:key:zMock',
            publicJwk: { kty: 'EC', crv: 'P-256', x: 'x-coord', y: 'y-coord' },
          });
        });

        service.openSubmitDialog();
        await flushMicrotasks();

        const [request] = mockProcedureService.createProcedure.mock.calls[0] as any[];
        expect(request.holder_key).toBeUndefined();
      });

      it('AC-12.2: a non-exempt type never calls generateForSubmission and never carries holder_key', () => {
        givenASubmittableForm(); // learcredential.employee.w3c.2 -- not exempt
        markDeliveryModes('direct');
        mockHolderKeyService.generateForSubmission.mockClear();
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'direct', status: 200, body: { signed_credential: 'signed-jwt' } }]
        }));

        service.openSubmitDialog();

        expect(mockHolderKeyService.generateForSubmission).not.toHaveBeenCalled();
        const [request] = mockProcedureService.createProcedure.mock.calls[0] as any[];
        expect(request.holder_key).toBeUndefined();
      });
    });

    describe('AC-13/AC-10.2/EC-09.1/EC-09.2: wallet-only path for the two AD-8 exempt machine types', () => {
      beforeEach(() => {
        givenASubmittableMachineForm('learcredential.machine.sd.1');
      });

      it('AC-13: direct not declared, wallet delivers -- extended dialog gets the key section', async () => {
        markDeliveryModes('ui');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://abc' } }]
        }));

        service.openSubmitDialog();
        await flushMicrotasks();

        expect(mockMatDialog.open).toHaveBeenCalledWith(CredentialOfferDialogComponent, expect.objectContaining({
          data: expect.objectContaining({ requiresHolderKeySection: true, privateKeyHex: 'mock-private-key-hex' })
        }));
      });

      it('EC-09.1: the one declared Wallet channel fails, but the envelope is present -- key section still shown, not total failure', async () => {
        markDeliveryModes('email');
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'email', status: 503, error: { type: 'delivery_failed', title: 'x', status: 503, detail: 'x' } }]
        }));
        const router = TestBed.inject(Router);

        service.openSubmitDialog();
        await flushMicrotasks();

        expect(dialogService.openDialog).not.toHaveBeenCalledWith(expect.anything(), errorDialogData);
        expect(mockMatDialog.open).toHaveBeenCalledWith(CredentialOfferDialogComponent, expect.objectContaining({
          data: expect.objectContaining({ requiresHolderKeySection: true, privateKeyHex: 'mock-private-key-hex' })
        }));
        expect(mockMatDialog.open.mock.calls[0][1].data.outcomes.get('email')).toBe('failed');
        expect(service.hasSubmitted$()).toBe(true);
        expect(router.navigate).toHaveBeenCalled();
      });

      it('EC-09.2: the emission fails outright (no envelope) -- generic error, no key section anywhere', async () => {
        markDeliveryModes('email');
        mockProcedureService.createProcedure.mockReturnValue(throwError(() => ({ status: 500 })));

        service.openSubmitDialog();
        await flushMicrotasks();

        expect(mockMatDialog.open).not.toHaveBeenCalled();
        expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), errorDialogData);
      });

      it('AC-10.2: key unavailable in the wallet-only path -- Done ungated, i.e. no dialog reconfiguration needed from this service', async () => {
        markDeliveryModes('email');
        // Simulates the same "reload wiped the store" scenario as AC-10.1, on the wallet-only path.
        mockHolderKeyService.generateForSubmission.mockImplementation(() => Promise.resolve<HolderBinding>({
          didKey: 'did:key:zMock',
          publicJwk: { kty: 'EC', crv: 'P-256', x: 'x-coord', y: 'y-coord' },
        }));
        mockProcedureService.createProcedure.mockReturnValue(of({
          responses: [{ channel: 'email', status: 200 }]
        }));

        service.openSubmitDialog();
        await flushMicrotasks();

        const [, config] = mockMatDialog.open.mock.calls[0];
        expect(config.data.requiresHolderKeySection).toBe(true);
        expect(config.data.privateKeyHex).toBeUndefined();
      });
    });

    describe('ES-09: holder-key generation failure', () => {
      beforeEach(() => {
        givenASubmittableMachineForm('learcredential.machine.w3c.3');
        markDeliveryModes('direct');
      });

      it('never sends the request, and surfaces the same generic failure as any other error (ES-04)', async () => {
        mockHolderKeyService.generateForSubmission.mockReturnValue(
          Promise.reject(new HolderKeyGenerationError('boom'))
        );

        service.openSubmitDialog();
        await flushMicrotasks();

        expect(mockProcedureService.createProcedure).not.toHaveBeenCalled();
        expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), errorDialogData);
      });
    });

    describe('general error handling (ES-02, ES-03, ES-04, ES-05)', () => {
      // givenASubmittableForm() marks 'email' by default -- a bare `{}` response (no responses[]
      // at all) resolves every requested channel to 'missing' under AD-7's outcome projection, so
      // it no longer represents a success fixture the way it did before that rework.
      const emailDeliveredResponse = { responses: [{ channel: 'email', status: 200 }] };

      it('should navigate to the credential list after a successful issuance', () => {
        const router = TestBed.inject(Router);
        mockProcedureService.createProcedure.mockReturnValue(of(emailDeliveredResponse));

        service.openSubmitDialog();

        expect(router.navigate).toHaveBeenCalledWith(['/organization/credentials']);
      });

      it('should submit the newest version of the selected format, not the bare type', () => {
        mockProcedureService.createProcedure.mockReturnValue(of(emailDeliveredResponse));

        service.openSubmitDialog();

        const [request] = mockProcedureService.createProcedure.mock.calls[0] as any[];
        expect(request.credential_configuration_id).toBe('learcredential.employee.w3c.2');
      });

      it.each([
        ['400 invalid payload (ES-01)', { status: 400 }],
        ['403 configuration not allowed for the tenant (ES-02)', { status: 403 }],
        ['409 stale eligibility read (ES-03)', { status: 409 }],
        ['500 issuer failure (ES-04)', { status: 500 }]
      ])('should show an observable failure on %s', (_label, httpError) => {
        mockProcedureService.createProcedure.mockReturnValue(throwError(() => httpError));

        service.openSubmitDialog();

        expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), errorDialogData);
      });

      it('should keep the form data and let the operator retry after a failure', () => {
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

      it('should guard the double submit through hasSubmitted$ and the async dialog', () => {
        mockProcedureService.createProcedure.mockReturnValue(of(emailDeliveredResponse));

        service.openSubmitDialog();

        // after success the screen navigates away and canLeave() stops blocking: the Operator
        // must never end up with two contradictory success confirmations on screen.
        expect(service.hasSubmitted$()).toBe(true);
        expect(service.canLeave()).toBe(true);
        expect(dialogService.openDialog).toHaveBeenCalledTimes(1);
      });
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
