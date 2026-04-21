import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { EventTypes, OidcSecurityService, PublicEventsService } from 'angular-auth-oidc-client';
import { UserDataAuthenticationResponse } from '../models/dto/user-data-authentication-response.dto';
import { RoleType } from '../models/enums/auth-rol-type.enum';
import { environment } from 'src/environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';

const mockUserDataWithClaims: UserDataAuthenticationResponse = {
  id: 'id',
  sub: 'subValue',
  commonName: 'commonNameValue',
  country: 'countryValue',
  serialNumber: 'serialNumberValue',
  email_verified: true,
  preferred_username: 'preferred_usernameValue',
  given_name: 'givenNameValue',
  credential_type: 'learcredential.employee.w3c.1',
  mandatee: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'jhonDoe@example.com',
  },
  mandator: {
    id: 'mandator-id',
    organizationIdentifier: 'ORG123',
    organization: 'Test Organization',
    commonName: 'Mandator Name',
    email: 'mandator@example.com',
    serialNumber: '123456',
    country: 'Testland'
  },
  power: [
    {
      function: 'Onboarding',
      action: 'Execute',
      domain: 'localhost',
      type: 'type'
    }
  ],
  'tenant-id': 'tenant-idValue',
  emailAddress: 'someone@example.com',
  organizationIdentifier: 'ORG123',
  organization: 'Test Organization',
  name: 'John Doe',
  family_name: 'Doe',
};

const mockUserDataWithCert: UserDataAuthenticationResponse = {
  id: 'id',
  sub: 'subCert',
  commonName: 'Cert Common Name',
  country: 'CertLand',
  serial_number: '99999999',
  serialNumber: '99999999',
  email_verified: true,
  preferred_username: 'certUser',
  given_name: 'CertGivenName',
  'tenant-id': 'tenant-123',
  email: 'cert-user@example.com',
  emailAddress: 'cert-user@example.com',
  organizationIdentifier: 'ORG-CERT',
  organization: 'Cert Organization',
  name: 'John Cert',
  family_name: 'Cert',
};

const mockUserDataNoVCNoCert: UserDataAuthenticationResponse = {
  id: 'id',
  sub: 'subCert',
  commonName: 'Cert Common Name',
  country: 'CertLand',
  serialNumber: '99999999',
  email_verified: true,
  preferred_username: 'certUser',
  given_name: 'CertGivenName',
  'tenant-id': 'tenant-123',
  emailAddress: 'cert-user@example.com',
  organizationIdentifier: 'ORG-CERT',
  organization: 'Cert Organization',
  name: 'John Cert',
  family_name: 'Cert',
};

describe('AuthService', () => {
  let service: AuthService;
  let mockPublicEventsService: jest.Mocked<any>;

  let oidcSecurityServiceMock: {
    checkAuth: jest.Mock,
    logoff: jest.Mock,
    authorize: jest.Mock,
    logoffAndRevokeTokens: jest.Mock,
    logoffLocal: jest.Mock
  };

  beforeEach(() => {
    oidcSecurityServiceMock = {
      checkAuth: jest.fn().mockReturnValue(of({
        isAuthenticated: false,
        userData: null,
        accessToken: null
      })),
      authorize: jest.fn(),
      logoffAndRevokeTokens: jest.fn(),
      logoff: jest.fn().mockReturnValue(of()),
      logoffLocal: jest.fn(),
    };
    mockPublicEventsService = {
      registerForEvents: jest.fn().mockReturnValue(of())
    };

    const translateServiceMock = {
      instant: jest.fn((key: string) => key),
    };
    const dialogWrapperServiceMock = {
      openErrorInfoDialog: jest.fn().mockReturnValue({ afterClosed: () => of(undefined) }),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: OidcSecurityService, useValue: oidcSecurityServiceMock },
        { provide: PublicEventsService, useValue: mockPublicEventsService },
        { provide: TranslateService, useValue: translateServiceMock },
        { provide: DialogWrapperService, useValue: dialogWrapperServiceMock },
      ]
    });

    service = TestBed.inject(AuthService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // creation / login / basic logout
  // --------------------------------------------------------------------------
  it('hauria de crear-se', () => {
    expect(service).toBeTruthy();
  });

  it('login(): truca authorize a OidcSecurityService', () => {
    service.login();
    expect(oidcSecurityServiceMock.authorize).toHaveBeenCalled();
  });

  it('logout(): truca logoffLocal', () => {
    service.logout();
    expect(oidcSecurityServiceMock.logoffLocal).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // initial observables
  // --------------------------------------------------------------------------
  it('isLoggedIn() inicialment false', (done) => {
    service.isLoggedIn().subscribe(v => {
      expect(v).toBe(false);
      done();
    });
  });

  it('getUserData() inicialment null', (done) => {
    service.getUserData().subscribe(v => {
      expect(v).toBeNull();
      done();
    });
  });

  it('getMandateeEmail() inicialment ""', () => {
    expect(service.getMandateeEmail()).toBe('');
  });

  it('getToken() inicialment ""', (done) => {
    service.getToken().subscribe(v => {
      expect(v).toBe('');
      done();
    });
  });

  it('getName() inicialment ""', (done) => {
    service.getName().subscribe(v => {
      expect(v).toBe('');
      done();
    });
  });

  // --------------------------------------------------------------------------
  // hasPower()
  // --------------------------------------------------------------------------
  it('true si te "Onboarding" i accio "Execute"', () => {
    (service as any).userPowers = [
      { function: 'Onboarding', action: ['Read', 'Execute', 'Write'] }
    ];
    expect(service.hasPower('Onboarding', 'Execute')).toBe(true);
  });

  it('false si no te "Execute"', () => {
    (service as any).userPowers = [
      { function: 'Onboarding', action: ['Read', 'Write'] }
    ];
    expect(service.hasPower('Onboarding', 'Execute')).toBe(false);
  });

  it('false si no te "Onboarding"', () => {
    (service as any).userPowers = [
      { function: 'OtherFunction', action: 'Execute' }
    ];
    expect(service.hasPower('Onboarding', 'Execute')).toBe(false);
  });

  it('false si userPowers es buit', () => {
    (service as any).userPowers = [];
    expect(service.hasPower('Onboarding', 'Execute')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // isSysAdmin()
  // --------------------------------------------------------------------------
  describe('isSysAdmin', () => {
    it('true amb power organization/EUDISTACK/System/Administration (action string)', () => {
      (service as any).userPowers = [
        { type: 'organization', domain: 'EUDISTACK', function: 'System', action: 'Administration' }
      ];
      expect(service.isSysAdmin()).toBe(true);
    });

    it('true amb Administration dins array d\'actions', () => {
      (service as any).userPowers = [
        { type: 'organization', domain: 'EUDISTACK', function: 'System', action: ['Read', 'Administration'] }
      ];
      expect(service.isSysAdmin()).toBe(true);
    });

    it('false si el domain no es EUDISTACK', () => {
      (service as any).userPowers = [
        { type: 'organization', domain: 'OTHER', function: 'System', action: 'Administration' }
      ];
      expect(service.isSysAdmin()).toBe(false);
    });

    it('false si userPowers es buit', () => {
      (service as any).userPowers = [];
      expect(service.isSysAdmin()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // hasAdminOrganizationIdentifier()
  // --------------------------------------------------------------------------
  describe('hasAdminOrganizationIdentifier', () => {
    it('retorna true si organizationIdentifier coincideix amb environment.admin_organization_id', () => {
      (environment as any).admin_organization_id = 'VATES-B60645900';

      (service as any).mandatorSubject.next({
        organizationIdentifier: 'VATES-B60645900'
      });
      (service as any).userPowers = [
        { function: 'Onboarding', action: 'Execute', domain: 'localhost', type: 'domain' }
      ];

      expect(service.hasAdminOrganizationIdentifier()).toBe(true);
    });

    it('retorna false si organizationIdentifier no coincideix amb environment.admin_organization_id', () => {
      (environment as any).admin_organization_id = 'VATES-B60645900';

      (service as any).mandatorSubject.next({
        organizationIdentifier: 'OTHER-ORG'
      });

      expect(service.hasAdminOrganizationIdentifier()).toBe(false);
    });
  });

  it('false si mandator es null', () => {
    (service as any).mandatorSubject.next(null);
    expect(service.hasAdminOrganizationIdentifier()).toBe(false);
  });

  // --------------------------------------------------------------------------
  // getMandator()
  // --------------------------------------------------------------------------
  it('getMandator() retorna l\'observable amb el mandator', (done) => {
    const mockMandator = {
      id: 'mandator-id',
      organizationIdentifier: 'ORG123',
      organization: 'Test Org',
      commonName: 'Some Name',
      email: 'some@example.com',
      serialNumber: '123',
      country: 'SomeCountry'
    };
    (service as any).mandatorSubject.next(mockMandator);

    service.getMandator().subscribe(m => {
      expect(m).toEqual(mockMandator);
      done();
    });
  });

  // --------------------------------------------------------------------------
  // handleLoginCallback()
  // --------------------------------------------------------------------------
  it('setejaria userData i token si autenticat i amb claims valids', (done) => {
    oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
      isAuthenticated: true,
      userData: mockUserDataWithClaims,
      accessToken: 'test-token'
    }));

    service.handleLoginCallback();

    service.isLoggedIn().subscribe(isLogged => {
      expect(isLogged).toBe(true);
      service.getUserData().subscribe(ud => {
        expect(ud).toEqual(mockUserDataWithClaims);
        service.getToken().subscribe(token => {
          expect(token).toBe('test-token');
          done();
        });
      });
    });
  });

  it('omple el correu del mandatee despres de handleUserAuthentication()', () => {
    (service as any).handleUserAuthentication(mockUserDataWithClaims);

    expect(service.getMandateeEmail()).toBe('jhonDoe@example.com');
  });

  it('fa logout si autenticat pero sense power Onboarding Execute', async () => {
    const userDataWithoutOnboarding: UserDataAuthenticationResponse = {
      ...mockUserDataWithClaims,
      power: [{ function: 'OtherFunction', action: 'Write', domain: 'domain', type: 'type' }]
    };

    oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
      isAuthenticated: true,
      userData: userDataWithoutOnboarding,
      accessToken: 'abc'
    }));
    const logoutSpy = jest.spyOn(service, 'logout');

    service.handleLoginCallback();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(logoutSpy).toHaveBeenCalled();
  });

  it('fa logout si el power Onboarding/Execute no correspon al tenant actual (cross-tenant bypass)', async () => {
    const crossTenantUserData: UserDataAuthenticationResponse = {
      ...mockUserDataWithClaims,
      power: [{ function: 'Onboarding', action: 'Execute', domain: 'kpmg', type: 'domain' }]
    };

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname: 'dome.example.com' }
    });

    try {
      oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
        isAuthenticated: true,
        userData: crossTenantUserData,
        accessToken: 'cross-tenant-token'
      }));
      const logoutSpy = jest.spyOn(service, 'logout');

      service.handleLoginCallback();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(logoutSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation
      });
    }
  });

  it('accepta login d\'un SysAdmin sense power Onboarding/Execute', (done) => {
    const sysAdminUserData: UserDataAuthenticationResponse = {
      ...mockUserDataWithClaims,
      power: [{ type: 'organization', domain: 'EUDISTACK', function: 'System', action: 'Administration' }]
    };

    oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
      isAuthenticated: true,
      userData: sysAdminUserData,
      accessToken: 'sysadmin-token'
    }));
    const logoutSpy = jest.spyOn(service, 'logout');

    service.handleLoginCallback();

    expect(logoutSpy).not.toHaveBeenCalled();
    service.isLoggedIn().subscribe(isLogged => {
      expect(isLogged).toBe(true);
      done();
    });
  });

  it('fa logout si autenticat pero sense mandatee/mandator (no powers)', async () => {
    oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
      isAuthenticated: true,
      userData: mockUserDataNoVCNoCert,
      accessToken: 'some-token'
    }));
    const logoutSpy = jest.spyOn(service, 'logout');

    service.handleLoginCallback();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(logoutSpy).toHaveBeenCalled();
  });

  it('no canvia estats si no autenticat', (done) => {
    oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
      isAuthenticated: false,
      userData: null,
      accessToken: ''
    }));

    service.handleLoginCallback();

    service.isLoggedIn().subscribe(isLoggedIn => {
      expect(isLoggedIn).toBe(false);
      service.getUserData().subscribe(ud => {
        expect(ud).toBeNull();
        service.getToken().subscribe(token => {
          expect(token).toBe('');
          done();
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // handleUserAuthentication()
  // --------------------------------------------------------------------------
  it('gestiona el flux flat claims a handleUserAuthentication()', () => {
    const handleFlatClaimsLoginSpy = jest.spyOn(service as any, 'handleFlatClaimsLogin');

    (service as any).handleUserAuthentication(mockUserDataWithClaims);
    expect(handleFlatClaimsLoginSpy).toHaveBeenCalledWith(mockUserDataWithClaims);
    expect(service.roleType()).toBe(RoleType.LEAR);
  });

  it('extractDataFromCertificate extreu dades correctament', () => {
    const result = (service as any).extractDataFromCertificate(mockUserDataWithCert);
    expect(result).toEqual({
      id: mockUserDataWithCert.id,
      organizationIdentifier: mockUserDataWithCert.organizationIdentifier,
      organization: mockUserDataWithCert.organization,
      commonName: mockUserDataWithCert.name,
      email: mockUserDataWithCert.email ?? '',
      serialNumber: mockUserDataWithCert.serial_number ?? '',
      country: mockUserDataWithCert.country
    });
  });

  it('handleUserAuthentication logs error si no hi ha mandatee ni mandator', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    (service as any).handleUserAuthentication(mockUserDataNoVCNoCert);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Missing mandatee or mandator claims in ID Token.');
  });

  // --------------------------------------------------------------------------
  // logout()
  // --------------------------------------------------------------------------
  describe('logout', () => {
    it('crida logoffLocal i neteja la sessio', () => {
      service.logout();
      expect(oidcSecurityServiceMock.logoffLocal).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // checkAuth$()
  // --------------------------------------------------------------------------
  describe('checkAuth$', () => {
    it('marca autenticat i invoca handleUserAuthentication si valid', (done) => {
      const handleUserAuthSpy = jest.spyOn(service as any, 'handleUserAuthentication');
      oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
        isAuthenticated: true,
        userData: mockUserDataWithClaims,
        accessToken: 'xxx'
      }));

      service.checkAuth$().subscribe(() => {
        expect(handleUserAuthSpy).toHaveBeenCalledWith(mockUserDataWithClaims);
        service.isLoggedIn().subscribe(isLoggedIn => {
          expect(isLoggedIn).toBe(true);
          done();
        });
      });
    });

    it('marca no autenticat si isAuthenticated=false', (done) => {
      oidcSecurityServiceMock.checkAuth.mockReturnValue(of({
        isAuthenticated: false,
        userData: mockUserDataWithCert,
        accessToken: ''
      }));

      service.checkAuth$().subscribe(() => {
        service.isLoggedIn().subscribe(isLoggedIn => {
          expect(isLoggedIn).toBe(false);
          done();
        });
      });
    });

    it('propaga error si checkAuth llenca', (done) => {
      const error = new Error('Some error');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      oidcSecurityServiceMock.checkAuth.mockReturnValue(throwError(() => error));

      service.checkAuth$().subscribe({
        next: () => {
          fail('S\'esperava un error');
        },
        error: err => {
          expect(err).toBe(error);
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Checking authentication: error in initial authentication.'
          );
          done();
        }
      });
    });

  });

  // --------------------------------------------------------------------------
  // subscribeToAuthEvents
  // --------------------------------------------------------------------------
  describe('subscribeToAuthEvents', () => {
    let eventSubject: Subject<any>;

    beforeEach(() => {
      eventSubject = new Subject();
      jest.spyOn(service, 'checkAuth$').mockReturnValue(of({ isAuthenticated: false } as any));
      jest.spyOn(service, 'logout').mockImplementation(() => {});
      jest.spyOn(service, 'authorize').mockImplementation();
      mockPublicEventsService.registerForEvents.mockReturnValue(eventSubject.asObservable());
    });

    it('gestiona SilentRenewStarted', () => {
      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.SilentRenewStarted });
      expect(service.authorize).not.toHaveBeenCalled();
    });

    it('gestiona SilentRenewFailed offline', () => {
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const addEventListenerSpy = jest.spyOn(globalThis, 'addEventListener');

      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.SilentRenewFailed });

      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('offline mode'), expect.anything());
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));

      consoleError.mockRestore();
    });

    it('online handler: not authenticated after reconnect -> logs error and calls authorize', () => {
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const removeListenerSpy = jest.spyOn(globalThis, 'removeEventListener').mockImplementation();

      let capturedHandler: (() => void) | undefined;
      jest.spyOn(globalThis, 'addEventListener').mockImplementation((event: any, handler: any) => {
        if (event === 'online') capturedHandler = handler;
      });

      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.SilentRenewFailed });
      expect(capturedHandler).toBeDefined();

      oidcSecurityServiceMock.checkAuth.mockReturnValue(of({ isAuthenticated: false, userData: null, accessToken: null }));
      capturedHandler!();

      expect(consoleError).toHaveBeenCalledWith('User still not authenticated after reconnect, logging out');
      expect(service.authorize).toHaveBeenCalled();
      expect(removeListenerSpy).toHaveBeenCalledWith('online', capturedHandler);

      consoleError.mockRestore();
      removeListenerSpy.mockRestore();
    });

    it('online handler: error during reauth -> logs error and calls authorize', () => {
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const removeListenerSpy = jest.spyOn(globalThis, 'removeEventListener').mockImplementation();

      let capturedHandler: (() => void) | undefined;
      jest.spyOn(globalThis, 'addEventListener').mockImplementation((event: any, handler: any) => {
        if (event === 'online') capturedHandler = handler;
      });

      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.SilentRenewFailed });
      expect(capturedHandler).toBeDefined();

      const reconnectError = new Error('Network error');
      jest.spyOn(service, 'checkAuth$').mockReturnValue(throwError(() => reconnectError));
      capturedHandler!();

      expect(consoleError).toHaveBeenCalledWith('Error while reauthenticating after reconnect:', reconnectError);
      expect(service.authorize).toHaveBeenCalled();

      consoleError.mockRestore();
      removeListenerSpy.mockRestore();
    });

    it('gestiona SilentRenewFailed online -> authorize()', () => {
      jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.SilentRenewFailed });

      expect(consoleError).toHaveBeenCalledWith('Silent token refresh failed: online mode, proceeding to logout', expect.anything());
      expect(service.authorize).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('gestiona IdTokenExpired', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.IdTokenExpired });
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Session expired'), expect.anything());
      consoleError.mockRestore();
    });

    it('gestiona TokenExpired', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      service.subscribeToAuthEvents();
      eventSubject.next({ type: EventTypes.TokenExpired });
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Session expired'), expect.anything());
      consoleError.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // private helpers
  // --------------------------------------------------------------------------
  it('extractPowersFromClaims retorna l\'array de power', () => {
    const result = (service as any).extractPowersFromClaims(mockUserDataWithClaims);
    expect(result).toEqual(mockUserDataWithClaims.power);
  });

  it('extractPowersFromClaims retorna [] si no hi ha power', () => {
    const result = (service as any).extractPowersFromClaims(mockUserDataNoVCNoCert);
    expect(result).toEqual([]);
  });
});
