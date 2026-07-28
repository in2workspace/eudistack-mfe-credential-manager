import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CredentialIssuanceService } from './credential-issuance.service';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import { CountryService } from 'src/app/shared/services/country.service';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { CREDENTIAL_SCHEMA_PROVIDERS, IssuanceSchemaBuilder } from './issuance-schema-builders/issuance-schema-builder';
import { TranslateModule } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { ThemeService } from 'src/app/core/services/theme.service';

class MockDialogWrapperService {
  openDialogWithCallback = jest.fn((comp, data, cb) => cb());
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


  beforeEach(() => {
    dialogService = new MockDialogWrapperService();
    mockProcedureService = { createProcedure: jest.fn() }
    mockSchemaBuilder = { formSchemasBuilder: jest.fn(), getIssuancePowerFormSchema: jest.fn() };
    mockAuthService = { getMandateeEmail: jest.fn(() => 'mandatee@example.com')};

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        CredentialIssuanceService,
        { provide: DialogWrapperService, useValue: dialogService },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { pathFromRoot: [] } } },
        { provide: IssuanceSchemaBuilder, useValue: mockSchemaBuilder },
        IssuanceRequestFactoryService, 
        CountryService, 
        { provide: CredentialProcedureService, useValue: mockProcedureService },
        { provide: CredentialIssuerMetadataService, useValue: { loadMetadata: jest.fn(() => of(undefined)), findConfigurationsForType: jest.fn(() => []) } },
        { provide: ThemeService, useValue: { tenantDomain: 'TENANT' } }
      ]
    });
    service = TestBed.inject(CredentialIssuanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose only employee credential type for KPMG tenant', () => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        CredentialIssuanceService,
        { provide: DialogWrapperService, useValue: dialogService },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { pathFromRoot: [] } } },
        { provide: IssuanceSchemaBuilder, useValue: mockSchemaBuilder },
        IssuanceRequestFactoryService,
        CountryService,
        { provide: CredentialProcedureService, useValue: mockProcedureService },
        { provide: CredentialIssuerMetadataService, useValue: { loadMetadata: jest.fn(() => of(undefined)), findConfigurationsForType: jest.fn(() => []) } },
        { provide: ThemeService, useValue: { tenantDomain: 'KPMG' } }
      ]
    });

    const kpmgService = TestBed.inject(CredentialIssuanceService);
    expect(kpmgService.credentialTypesArr).toEqual(['learcredential.employee']);
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

    it('ES-02: sin tipo seleccionado, isFormValid$ es false (fail-closed) y no se envía la petición', fakeAsync(() => {
      tick();
      TestBed.flushEffects();
      expect(service.isFormValid$()).toBe(false);

      service.openSubmitDialog();

      expect(mockProcedureService.createProcedure).not.toHaveBeenCalled();
    }));

    it('ES-02: un schema con 0 campos también es fail-closed (FormGroup resultante sería VALID en Angular)', fakeAsync(() => {
      selectTypeWithSchema([]);
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(false);
    }));

    it('AC-02: campo obligatorio vacío bloquea isFormValid$ y no se envía la petición', fakeAsync(() => {
      selectTypeWithSchema(REQUIRED_FIELD_SCHEMA);
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(false);

      service.openSubmitDialog();

      expect(mockProcedureService.createProcedure).not.toHaveBeenCalled();
    }));

    it('AC-04 / ES-03: corregir el campo revalida el estado actual del FormGroup (no un flag cacheado)', fakeAsync(() => {
      selectTypeWithSchema(REQUIRED_FIELD_SCHEMA);
      tick();
      expect(service.isFormValid$()).toBe(false);

      service.form$().get('firstName')!.setValue('Alice');
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(true);

      // Anti-caché (§20 D-5): vaciar de nuevo debe volver a bloquear, no quedarse "pegado" en true
      service.form$().get('firstName')!.setValue('');
      tick();
      TestBed.flushEffects();

      expect(service.isFormValid$()).toBe(false);
    }));
  });
});
