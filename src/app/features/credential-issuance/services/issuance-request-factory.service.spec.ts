import { TestBed } from '@angular/core/testing';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import {
  IssuanceLEARCredentialEmployeePayload,
  IssuanceLEARCredentialMachinePayload
} from '../../../core/models/dto/lear-credential-issuance-request.dto';
import { IssuanceRawCredentialPayload, IssuanceRawPowerForm } from 'src/app/core/models/entity/lear-credential-issuance';
import { AuthService } from 'src/app/core/services/auth.service';
import { ThemeService } from 'src/app/core/services/theme.service';

describe('IssuanceRequestFactoryService', () => {
  let service: IssuanceRequestFactoryService;

  const authServiceMock = {
    getMandateeEmail: jest.fn(() => 'mandatee@example.com')
  };

  const themeServiceMock = {
    tenantDomain: 'TENANT'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IssuanceRequestFactoryService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: ThemeService, useValue: themeServiceMock }
      ]
    });

    service = TestBed.inject(IssuanceRequestFactoryService);

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should throw TypeError for unknown credential type', () => {
    const payload = {
      onBehalf: false,
      optional: { staticData: { mandator: {} } },
      formData: { mandatee: {} }
    } as unknown as IssuanceRawCredentialPayload;

    expect(() => service.createCredentialRequest(payload, 'UNKNOWN' as any, 'cfg'))
      .toThrow(TypeError);
  });

  it('should use provided commonName and keep VAT prefix for employee', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: {
          emailAddress: 'bob@example.com',
          organization: 'Beta Ltd',
          country: 'FR',
          commonName: 'Beta Common',
          serialNumber: 'SN555',
          organizationIdentifier: 'VATFR-999'
        },
        mandatee: { id: 'M2', domain: 'beta.com' }
      }
    };

    const result = service.createCredentialRequest(credentialData, 'learcredential.employee', 'cfg');
    const emp = result.payload as IssuanceLEARCredentialEmployeePayload;

    expect(emp.mandator.commonName).toBe('Beta Common');
    expect(emp.mandator.organizationIdentifier).toBe('VATFR-999');
  });

  it('should create machine request with did and mandatee fields', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: {
          firstName: 'Eve',
          lastName: 'Doe',
          organization: 'Tech Corp',
          country: 'ES',
          organizationIdentifier: '246',
          serialNumber: 'S246'
        },
        mandatee: { domain: 'example.com', ipAddress: '127.0.0.1' },
        keys: { didKey: 'did:desmos:abc' }
      }
    };

    const result = service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg');
    const mach = result.payload as IssuanceLEARCredentialMachinePayload;

    // Acceptem camps extra (p. ex. email: undefined) amb toMatchObject
    expect(mach).toMatchObject({
      mandator: {
        commonName: 'Eve Doe',
        serialNumber: 'S246',
        organization: 'Tech Corp',
        organizationIdentifier: 'VATES-246',
        id: 'did:elsi:VATES-246',
        country: 'ES'
      },
      mandatee: {
        id: 'did:desmos:abc',
        domain: 'example.com',
        ipAddress: '127.0.0.1'
      },
      power: [
        {
          type: 'domain',
          domain: 'TENANT',
          function: 'Onboarding',
          action: ['Execute']
        }
      ]
    });
  });

  it('should use provided commonName and keep VAT prefix for machine', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: {
          commonName: 'MachineCo',
          organization: 'Org',
          country: 'DE',
          organizationIdentifier: 'VATDE-555',
          serialNumber: 'SN555'
        },
        mandatee: { domain: 'machine.com', ipAddress: '1.2.3.4' },
        keys: { didKey: 'did:test' }
      }
    };

    const result = service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg');
    const mach = result.payload as IssuanceLEARCredentialMachinePayload;

    expect(mach.mandator.commonName).toBe('MachineCo');
    expect(mach.mandator.id).toBe('did:elsi:VATDE-555');
    expect(mach.mandatee.id).toBe('did:test');
  });

  it('should parse power errors for unknown base and no actions', () => {
    const powerForm: IssuanceRawPowerForm = {
      UnknownFunc: { Foo: true },
      Onboarding: { Execute: false }
    } as any;

    const parsed = (service as any).parsePower(powerForm, 'learcredential.employee');

    expect(parsed).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      'Function key found in schema but not in received data: UnknownFunc'
    );
    expect(console.error).toHaveBeenCalledWith(
      'Not actions found for this key: Onboarding'
    );
  });

  it('should return empty array when power form is empty', () => {
    const parsed = (service as any).parsePower({}, 'learcredential.employee');
    expect(parsed).toEqual([]);
  });

  it('should return empty payload and log error when employee mandator is null', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: null,
        mandatee: { id: 'M1', email: 'emp@example.com' }
      }
    };
    const result = service.createCredentialRequest(credentialData, 'learcredential.employee', 'cfg');
    expect(console.error).toHaveBeenCalledWith('Error getting mandator.');
    expect(result.payload).toEqual({});
  });

  it('should return empty payload and log error when machine mandator is null', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: null,
        mandatee: { domain: 'machine.com', ipAddress: '1.2.3.4' },
        keys: { didKey: 'did:test' }
      }
    };
    const result = service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg');
    expect(console.error).toHaveBeenCalledWith('Error getting mandator.');
    expect(result.payload).toEqual({});
  });

  it('should use authService email and staticData mandator when machine is not onBehalf', () => {
    const credentialData: any = {
      onBehalf: false,
      staticData: {
        mandator: [
          { key: 'country', value: 'ES' },
          { key: 'organizationIdentifier', value: 'VATES-123' },
          { key: 'organization', value: 'Tech Corp' },
          { key: 'commonName', value: 'Tech Corp CN' },
          { key: 'serialNumber', value: 'SN123' },
          { key: 'email', value: 'mandator@example.com' }
        ]
      },
      formData: {
        power: { Onboarding: { Execute: true } },
        mandatee: { domain: 'machine.com', ipAddress: '10.0.0.1' },
        keys: { didKey: 'did:key:abc' }
      }
    };

    const result = service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg');

    expect(authServiceMock.getMandateeEmail).toHaveBeenCalled();
    expect(result.email).toBe('mandatee@example.com');
    expect(result.payload).toMatchObject({
      mandator: {
        country: 'ES',
        organizationIdentifier: 'VATES-123',
        commonName: 'Tech Corp CN'
      }
    });
  });

  it('should throw when machine is not onBehalf and staticData has no mandator', () => {
    const credentialData: any = {
      onBehalf: false,
      staticData: {},
      formData: {
        power: { Onboarding: { Execute: true } },
        mandatee: { domain: 'machine.com', ipAddress: '1.2.3.4' },
        keys: { didKey: 'did:key:abc' }
      }
    };

    expect(() => service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg'))
      .toThrow('Could not get valid mandator on behalf');
  });

  it('should parse multiple powers correctly', () => {
    const powerForm: IssuanceRawPowerForm = {
      Onboarding: { Execute: true },
      ProductOffering: { Create: true, Update: true, Upload: false }
    } as any;

    const parsed = (service as any).parsePower(powerForm, 'learcredential.employee');

    expect(parsed).toEqual([
      {
        type: 'domain',
        domain: 'TENANT',
        function: 'Onboarding',
        action: ['Execute']
      },
      {
        type: 'domain',
        domain: 'TENANT',
        function: 'ProductOffering',
        action: ['Create', 'Update']
      }
    ]);
  });

  // Regression: LearCredentialMachine onBehalf=true was sending email='' because
  // getCredentialEmail fell through to mandatee.email, which machines don't have.
  it('should use mandator email as root email for machine credential when onBehalf is true', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: {
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          organization: 'Org S.L.',
          country: 'ES',
          organizationIdentifier: 'VATES-999',
          serialNumber: 'SN999'
        },
        mandatee: { domain: 'machine.org', ipAddress: '10.0.0.2' },
        keys: { didKey: 'did:key:xyz' }
      }
    };

    const result = service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg');

    expect(result.email).toBe('alice@example.com');
  });

  it('should return empty string as root email for machine onBehalf when mandator email is absent', () => {
    const credentialData: any = {
      onBehalf: true,
      formData: {
        power: { Onboarding: { Execute: true } },
        mandator: {
          firstName: 'Bob',
          lastName: 'Jones',
          organization: 'Org B',
          country: 'ES',
          organizationIdentifier: 'VATES-111',
          serialNumber: 'SN111'
          // email intentionally omitted
        },
        mandatee: { domain: 'nomail.org' },
        keys: { didKey: 'did:key:nomail' }
      }
    };

    const result = service.createCredentialRequest(credentialData, 'learcredential.machine', 'cfg');

    expect(result.email).toBe('');
  });
});
