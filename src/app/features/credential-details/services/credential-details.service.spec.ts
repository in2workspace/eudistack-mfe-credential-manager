import { TestBed } from '@angular/core/testing';
import { CredentialDetailsService } from './credential-details.service';
import { FormBuilder } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialActionsService } from './credential-actions.service';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { of } from 'rxjs';
import { Injector } from '@angular/core';
import { DetailsKeyValueField, DetailsGroupField, ViewModelSchema } from 'src/app/core/models/entity/lear-credential-details';
import { ComponentPortal } from '@angular/cdk/portal';
import { LEARCredentialEmployee, LEARCredential } from 'src/app/core/models/entity/lear-credential';

describe('CredentialDetailsService', () => {
  let service: CredentialDetailsService;

  const mockCredentialProcedureService = {
    fetchCredentialProcedureById: jest.fn(),
  };

  const mockCredentialActionsService = {
    openSignCredentialDialog: jest.fn(),
    openRevokeCredentialDialog: jest.fn(),
  };

  const mockMetadataService = {
    loadMetadata: jest.fn().mockReturnValue(of(void 0)),
    getConfigurationById: jest.fn().mockReturnValue(undefined),
  };

  const mockDialogWrapperService = {
    openErrorInfoDialog: jest.fn()
  } as any;
  const mockRouter = {} as any;

  const mockAuthService = {
    getUserRole: jest.fn().mockReturnValue(RoleType.LEAR),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        CredentialDetailsService,
        FormBuilder,
        { provide: CredentialProcedureService, useValue: mockCredentialProcedureService },
        { provide: CredentialActionsService, useValue: mockCredentialActionsService },
        { provide: CredentialIssuerMetadataService, useValue: mockMetadataService },
        { provide: DialogWrapperService, useValue: mockDialogWrapperService },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(CredentialDetailsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set the procedureId$ signal when setProcedureId is called', () => {
    service.setProcedureId('abc123');
    expect(service.procedureId$()).toBe('abc123');
  });

  it('should call actionsService.openSignCredentialDialog with procedureId', () => {
    service.procedureId$.set('pid456');
    service.openSignCredentialDialog();
    expect(mockCredentialActionsService.openSignCredentialDialog).toHaveBeenCalledWith('pid456');
  });

  it('getProcedureId ha de retornar el valor de procedureId$', () => {
  (service as any).procedureId$ = () => 'proc-123';
  expect((service as any).getProcedureId()).toBe('proc-123');
});



  describe('evaluateFieldMain', () => {
 it('should evaluate “key-value” and “group” correctly', () => {
    const credStub = { foo: 'bar' } as any;

    const kv: DetailsKeyValueField = {
      type: 'key-value',
      key: 'x',
      value: (c: any) => 'valX',
      custom: {
        token: 'T' as any,
        component: class {},
        value: (c: any) => 'V'
      }
    };

    const grp: DetailsGroupField = {
      type: 'group',
      key: 'g',
      value: (c: any) => [
        { type: 'key-value', key: 'y', value: 'valY' }
      ] as DetailsKeyValueField[]
    };

    const kvGroup: DetailsGroupField = {
      type: 'group',
      key: 'gKv',
      value: [ kv ]
    };

    const schema: ViewModelSchema = {
      main: [ kvGroup, grp ],
      side: []
    };

    const evaluated = (service as any).evaluateSchemaValues(schema, credStub);

    const evaluatedGroup = evaluated.main[0] as any;
    expect(evaluatedGroup.key).toBe('gKv');
    expect(Array.isArray(evaluatedGroup.value)).toBeTruthy();

    const evaluatedKv = evaluatedGroup.value[0] as any;
    expect(evaluatedKv.key).toBe('x');
    expect(evaluatedKv.value).toBe('valX');
    expect(evaluatedKv.custom!.value).toBe('V');

    const evaluatedDynGroup = evaluated.main[1] as any;
    expect(evaluatedDynGroup.key).toBe('g');
    expect(Array.isArray(evaluatedDynGroup.value)).toBeTruthy();
    expect((evaluatedDynGroup.value[0] as any).value).toBe('valY');
  });
});


  describe('computed signals', () => {
    const mockVc = {
      validFrom: '2024-01-01',
      validUntil: '2024-12-31',
      credentialStatus: 'VALID'
    } as any;

    beforeEach(() => {
      // reset signals
      service.procedureId$.set('');
      service.credentialProcedureDetails$.set(undefined);
      // for the computed‐override tests
      jest.restoreAllMocks();
    });

    it('lifeCycleStatus$() should be undefined when no data', () => {
      expect(service.lifeCycleStatus$()).toBeUndefined();
    });

    it('lifeCycleStatus$() should return data.lifeCycleStatus', () => {
      const payload = { lifeCycleStatus: 'PENDING' } as any;
      service.credentialProcedureDetails$.set(payload);
      expect(service.lifeCycleStatus$()).toBe('PENDING');
    });

    it('credential$() should return vc when present', () => {
      service.credentialProcedureDetails$.set({ credential: { vc: mockVc } } as any);
      expect(service.credential$()).toBe(mockVc);
    });

    it('credential$() should be undefined when no vc', () => {
      service.credentialProcedureDetails$.set({ credential: { vc: undefined } } as any);
      expect(service.credential$()).toBeUndefined();
    });

    it('credentialValidFrom$() and credentialValidUntil$() fallback to empty string', () => {
      expect(service.credentialValidFrom$()).toBe('');
      expect(service.credentialValidUntil$()).toBe('');
    });

    it('credentialValidFrom$() and credentialValidUntil$() map from vc', () => {
      service.credentialProcedureDetails$.set({ credential: { vc: mockVc } } as any);
      expect(service.credentialValidFrom$()).toBe('2024-01-01');
      expect(service.credentialValidUntil$()).toBe('2024-12-31');
    });

    it('credentialStatus$() returns vc.credentialStatus', () => {
      service.credentialProcedureDetails$.set({ credential: { vc: mockVc } } as any);
      expect(service.credentialStatus$()).toBe('VALID');
    });

    it('credentialType$() returns credential_configuration_id from details', () => {
      service.credentialProcedureDetails$.set({
        credential_configuration_id: 'learcredential.employee.w3c.1',
        credential: { vc: mockVc }
      } as any);
      expect(service.credentialType$()).toBe('learcredential.employee.w3c.1');
    });

    it('showSideTemplateCard$() is false by default, true when sideViewModel has items', () => {
      expect(service.showSideTemplateCard$()).toBe(false);
      service.sideViewModel$.set([ { foo: 'bar' } as any ]);
      expect(service.showSideTemplateCard$()).toBe(true);
    });

    it('enableRevokeCredentialButton$() is false when no status, true when credentialStatus set', () => {
      service.credentialProcedureDetails$.set({ credential: { vc: { validFrom: '', validUntil: '', credentialStatus: undefined } } } as any);
      expect(service.enableRevokeCredentialButton$()).toBe(false);

      service.credentialProcedureDetails$.set({
        credential: {
          vc: { validFrom: '', validUntil: '', credentialStatus: {status:'ANY'} }
        }
      } as any);
      expect(service.enableRevokeCredentialButton$()).toBe(true);
    });


    it('showSignCredentialButton$, showRevokeCredentialButton$ all false by default', () => {
      expect(service.showSignCredentialButton$()).toBe(false);
      expect(service.showRevokeCredentialButton$()).toBe(false);
    });

     it('showActionsButtonsContainer$() és true si almenys un botó està visible', () => {
      service.credentialProcedureDetails$.set({
        lifeCycleStatus: 'PEND_SIGNATURE',
        credential: { vc: { type: ['learcredential.employee.w3c.1'], validFrom: '', validUntil: '', credentialStatus: 'OK' } }
      } as any);

      expect(service.showSignCredentialButton$()).toBe(true);
      expect(service.showActionsButtonsContainer$()).toBe(true);
    });
});


describe('Load models', () => {
  it('should load and evaluate credential models correctly', () => {
    const svc: any = service;

    const vc = { foo: 'bar' };
    const mockData = { credential: { vc } };
    jest.spyOn(svc, 'loadCredentialDetails').mockReturnValue(of(mockData));

    const schemaResult = { schema: { schemaKey: 'schemaVal' }, vcForEvaluation: vc };
    const resolveSchemaSpy = jest.spyOn(svc, 'resolveSchema').mockReturnValue(schemaResult);
    const evaluated = { evaluatedKey: 'evaluatedVal' };
    const evaluateSpy = jest.spyOn(svc, 'evaluateSchemaValues').mockReturnValue(evaluated);
    const templateSpy = jest.spyOn(svc, 'setViewModels').mockImplementation(() => {});

    const injector = TestBed.inject(Injector);
    svc.loadCredentialModels(injector);

    expect(svc.loadCredentialDetails).toHaveBeenCalled();
    expect(resolveSchemaSpy).toHaveBeenCalledWith(mockData, vc);
    expect(evaluateSpy).toHaveBeenCalledWith(schemaResult.schema, vc);
    expect(templateSpy).toHaveBeenCalledWith(evaluated, injector);
  });
});

describe('shouldIncludeSideField', () => {
  it('should include fields with a key other than "issuer"', () => {
    const field: any = { key: 'other', type: 'key-value', value: null };
    expect((service as any).shouldIncludeSideField(field)).toBe(true);
  });

  it('should exclude issuer when type is key-value and value is null', () => {
    const field: any = { key: 'issuer', type: 'key-value', value: null };
    expect((service as any).shouldIncludeSideField(field)).toBe(false);
  });

  it('should include issuer when type is key-value and value is not null', () => {
    const field: any = { key: 'issuer', type: 'key-value', value: 'foo' };
    expect((service as any).shouldIncludeSideField(field)).toBe(true);
  });

  it('should exclude issuer when type is group and all children values are null', () => {
    const field: any = {
      key: 'issuer',
      type: 'group',
      value: [
        { type: 'key-value', value: null },
        { type: 'key-value', value: null },
      ],
    };
    expect((service as any).shouldIncludeSideField(field)).toBe(false);
  });

  it('should include issuer when type is group and at least one child value is not null', () => {
    const field: any = {
      key: 'issuer',
      type: 'group',
      value: [
        { type: 'key-value', value: null },
        { type: 'key-value', value: 'bar' },
      ],
    };
    expect((service as any).shouldIncludeSideField(field)).toBe(true);
  });
});

describe('setViewModels', () => {
  let mockMainViewModel$: { set: jest.Mock<any, any> };
  let mockSideViewModel$: { set: jest.Mock<any, any> };

  beforeEach(() => {
    // Mock the internal template model subjects
    mockMainViewModel$ = { set: jest.fn() };
    mockSideViewModel$ = { set: jest.fn() };
    (service as any).mainViewModel$ = mockMainViewModel$;
    (service as any).sideViewModel$ = mockSideViewModel$;
  });

  it('should extend main and side schemas and set the template models', () => {
    // Arrange dummy schema and injector
    const dummySchema: any = { main: { foo: 'bar' }, side: { baz: 'qux' } };
    const dummyInjector = {} as Injector;

    // Prepare extended schemas
    const extendedMain = { foo: 'extended' };
    const extendedSide = { baz: 'extended' };
    // Spy on extendFields to return extended schemas in order
    const extendSpy = jest.spyOn(service as any, 'extendFields')
      .mockReturnValueOnce(extendedMain)
      .mockReturnValueOnce(extendedSide);

    // Act: call the private method
    (service as any).setViewModels(dummySchema, dummyInjector);

    // Assert extendFields calls
    expect(extendSpy).toHaveBeenCalledWith(dummySchema.main, dummyInjector);
    expect(extendSpy).toHaveBeenCalledWith(dummySchema.side, dummyInjector);

    // Assert that template models are set
    expect(mockMainViewModel$.set).toHaveBeenCalledWith(extendedMain);
    expect(mockSideViewModel$.set).toHaveBeenCalledWith(extendedSide);
  });
});

describe('extendFields', () => {
  it('should return identical fields array when no custom or group', () => {
    // Arrange
    const fields: any[] = [
      { key: 'field1', type: 'key-value', value: 'val', custom: null }
    ];
    const injector = Injector.create({ providers: [] });

    // Act
    const result = (service as any).extendFields(fields, injector);

    // Assert
    expect(result).toEqual(fields);
    expect(result[0].portal).toBeUndefined();
  });

  it('should add portal property when custom is defined', () => {
    // Arrange dummy component and token/value
    class DummyComponent {};
    const token = 'TEST_TOKEN';
    const tokenInjectionValue = 'injectedValue';

    const fields: any[] = [
      {
        key: 'field2',
        type: 'custom',
        value: 'val2',
        custom: {
          token,
          value: tokenInjectionValue,
          component: DummyComponent
        }
      }
    ];
    const injector = Injector.create({ providers: [] });

    // Act
    const result = (service as any).extendFields(fields, injector);
    const extended = result[0];

    // Assert portal instance and injector behavior
    expect(extended.portal).toBeInstanceOf(ComponentPortal);
    expect((extended.portal as ComponentPortal<any>).component).toBe(DummyComponent);
    // The portal.injector should provide the custom value
    expect(extended.portal.injector.get(token)).toBe(tokenInjectionValue);
  });

  it('should recursively extend group fields', () => {
    // Arrange a nested group field
    const nested: any = {
      key: 'nested',
      type: 'key-value',
      value: 'nestedVal',
      custom: null
    };
    const groupField: any = {
      key: 'groupField',
      type: 'group',
      value: [nested],
      custom: null
    };
    const injector = Injector.create({ providers: [] });

    // Spy on extendFields to track recursive calls
    const spy = jest.spyOn(service as any, 'extendFields');

    // Act
    const result = (service as any).extendFields([groupField], injector);
    const extendedGroup = result[0];

    // Assert top-level call and recursive call
    expect(spy).toHaveBeenCalledWith([nested], injector);
    expect(extendedGroup.value).toEqual([nested]);
  });
});

});