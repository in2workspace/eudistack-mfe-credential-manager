import { TestBed } from '@angular/core/testing';
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
        { provide: CredentialIssuerMetadataService, useValue: { loadMetadata: jest.fn(() => of(undefined)), findConfigurationsForType: jest.fn(() => []) } }
      ]
    });
    service = TestBed.inject(CredentialIssuanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
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
      (service as any).selectedCredentialType$.set('LEARCredentialEmployee');
      const mockSelect = { value: 'LEARCredentialEmployee' } as any;
      service.updateSelectedType('LEARCredentialMachine', mockSelect);
      expect(globalThis.confirm).toHaveBeenCalled();
      expect((service as any).selectedCredentialType$()).toBe('LEARCredentialMachine');
    });

    it('should not change type when user cancels confirm', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(false);
      jest.spyOn(service, 'canLeave').mockReturnValue(false);
      (service as any).selectedCredentialType$.set('LEARCredentialEmployee');
      const mockSelect = { value: 'LEARCredentialEmployee' } as any;
      service.updateSelectedType('LEARCredentialMachine', mockSelect);
      expect(mockSelect.value).toBe('LEARCredentialEmployee');
      expect((service as any).selectedCredentialType$()).toBe('LEARCredentialEmployee');
    });
  });
});
