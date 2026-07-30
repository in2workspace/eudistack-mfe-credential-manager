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

class MockDialogWrapperService {
  // El DialogWrapperService real se suscribe internamente al observable que devuelve el
  // callback (confirm$.pipe(..., switchMap(() => callback())).subscribe(...)) — sin
  // reproducir esa suscripcion aqui, la cadena de submitCredentialPayload() nunca se
  // ejecuta de verdad (los observables de RxJS son fríos hasta que alguien se suscribe).
  openDialogWithCallback = jest.fn((comp, data, cb) => cb().subscribe());
  openDialog = jest.fn(() => ({ afterClosed: () => of(true) }));
}

describe('CredentialIssuanceService', () => {
  let service: CredentialIssuanceService;
  let mockProcedureService: { createProcedure: jest.Mock };
  let mockSchemaBuilder: { formSchemasBuilder: jest.Mock, getIssuancePowerFormSchema: jest.Mock };
  let dialogService: MockDialogWrapperService;
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
    mockProcedureService = { createProcedure: jest.fn() }
    mockSchemaBuilder = { formSchemasBuilder: jest.fn(), getIssuancePowerFormSchema: jest.fn() };
    mockAuthService = { getMandateeEmail: jest.fn(() => 'mandatee@example.com')};
    // Respaldado por signals reales: si fuesen valores fijos, los computed del
    // servicio memoizarian y no podriamos testear el recalculo tras loadMetadata().
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
        // navigate() debe devolver una Promise (contrato real de Router): la cadena de
        // submitCredentialPayload() envuelve la navegacion con from(...), que revienta
        // sincronamente si recibe undefined en vez de un thenable.
        { provide: Router, useValue: { navigate: jest.fn(() => Promise.resolve(true)) } },
        { provide: ActivatedRoute, useValue: { snapshot: { pathFromRoot: [] } } },
        { provide: IssuanceSchemaBuilder, useValue: mockSchemaBuilder },
        IssuanceRequestFactoryService,
        CountryService,
        { provide: CredentialProcedureService, useValue: mockProcedureService },
        { provide: CredentialIssuerMetadataService, useValue: mockMetadataService },
        // No relacionado con AD-1 (esa dependencia ya se eliminó de CredentialIssuanceService):
        // IssuanceRequestFactoryService, provisto real en este TestBed, inyecta ThemeService
        // por su cuenta para resolver el mandatee/mandator del payload.
        { provide: ThemeService, useValue: { tenantDomain: 'TENANT' } }
      ]
    });
    service = TestBed.inject(CredentialIssuanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Sustituye a 'should expose only employee credential type for KPMG tenant'.
  // AD-1: ya no hay casos especiales por tenant en el frontend.
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
      // IssuanceRequestFactoryService NO esta mockeado en este fichero (es el real, para
      // probar la construccion del request de verdad) — necesita 'mandatee.email' y un
      // 'power' (aunque vacio) en el formulario, y un 'mandator' completo en staticData
      // (onBehalf=false lee el mandator de ahi, no del form), o revienta con
      // "Object.entries(undefined)" / "Could not get valid mandator on behalf".
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
      // form$/formValue$ se derivan via toObservable(), que empuja los cambios a traves de
      // un effect() interno programado como microtarea: sin esto, formValue$() en el resto
      // del test seguiria devolviendo el valor inicial (FormGroup vacio de la construccion).
      TestBed.flushEffects();
    };

    const originalLocation = window.location;

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation();
      // location.reload() ya vive en la cadena de éxito (preexistente, fuera de esta Story).
      // jsdom expone `reload` como no configurable en la instancia real de Location, así que
      // en vez de redefinir esa propiedad se sustituye window.location entero por un objeto
      // plano equivalente con un stub jest.fn() — se restaura en el afterEach.
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

    it('should show the success dialog and never surface credential offer artefacts (AC-05)', () => {
      mockProcedureService.createProcedure.mockReturnValue(of({ credential_offer_uri: 'openid-credential-offer://abc' }));

      service.openSubmitDialog();

      // AD-3: pese a que la respuesta trae la oferta, el unico dialogo abierto es el de exito.
      expect(dialogService.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogService.openDialog).toHaveBeenCalledWith(expect.anything(), successDialogData);
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

      // sin reset y sin navegacion: los datos introducidos sobreviven
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

      // tras el exito la pantalla navega y canLeave() deja de bloquear: no puede quedarse
      // el Operador con dos confirmaciones de exito contradictorias en pantalla.
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
