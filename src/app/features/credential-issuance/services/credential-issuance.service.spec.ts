import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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

    it('should load the issuer metadata once on construction', () => {
      expect(mockMetadataService.loadMetadata).toHaveBeenCalledTimes(1);
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
});
