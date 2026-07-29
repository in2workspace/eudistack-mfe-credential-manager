import { TestBed } from '@angular/core/testing';
import { PoliciesService } from './policies.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { of } from 'rxjs';
import { RoleType } from '../models/enums/auth-rol-type.enum';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let authServiceMock: jest.Mocked<AuthService>;
  let routerMock: jest.Mocked<Router>;
  let dialogMock: jest.Mocked<DialogWrapperService>;
  let translateMock: jest.Mocked<TranslateService>;
  let resolveRole$: jest.Mock;

  beforeEach(() => {
    resolveRole$ = jest.fn().mockReturnValue(of(RoleType.LEAR));

    authServiceMock = {
      hasPower: jest.fn(),
      isSysAdmin: jest.fn().mockReturnValue(false),
      logout: jest.fn().mockReturnValue(of(null)),
      resolveRole$
    } as unknown as jest.Mocked<AuthService>;

    routerMock = {
      navigate: jest.fn().mockResolvedValue(true)
    } as unknown as jest.Mocked<Router>;

    dialogMock = {
      openErrorInfoDialog: jest.fn().mockReturnValue({
        afterClosed: jest.fn().mockReturnValue(of(null))
      })
    } as unknown as jest.Mocked<DialogWrapperService>;

    translateMock = {
      instant: jest.fn().mockImplementation((key: string) => key)
    } as unknown as jest.Mocked<TranslateService>;

    TestBed.configureTestingModule({
      providers: [
        PoliciesService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: DialogWrapperService, useValue: dialogMock },
        { provide: TranslateService, useValue: translateMock }
      ]
    });

    service = TestBed.inject(PoliciesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('checkOnboardingPolicy', () => {
    it('should return true if the user has the required power', (done) => {
      authServiceMock.hasPower.mockReturnValue(true);

      service.checkOnboardingPolicy().subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it('should show error dialog and return false if the user lacks power', (done) => {
      authServiceMock.hasPower.mockReturnValue(false);

      service.checkOnboardingPolicy().subscribe((result) => {
        expect(dialogMock.openErrorInfoDialog).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
        expect(result).toBe(false);
        done();
      });
    });

    it('should return true for SysAdmin even without Onboarding/Execute', (done) => {
      authServiceMock.hasPower.mockReturnValue(false);
      (authServiceMock.isSysAdmin as jest.Mock).mockReturnValue(true);

      service.checkOnboardingPolicy().subscribe((result) => {
        expect(result).toBe(true);
        expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
        done();
      });
    });
  });

  /**
   * Gated on the backend's verdict (`resolveRole$()`), not on a TMF power: the
   * Issuer API never reads `CredentialIssuer/Configure` (EUD-72 §2.3).
   */
  describe('checkSettingsPolicy', () => {
    it('should return true for TENANT_ADMIN', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.TENANT_ADMIN));

      service.checkSettingsPolicy().subscribe((result) => {
        expect(result).toBe(true);
        expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
        done();
      });
    });

    it('should return true for SYSADMIN_READONLY (reads the catalog, cannot save it)', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.SYSADMIN_READONLY));

      service.checkSettingsPolicy().subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it('should show error dialog and return false for LEAR', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));

      service.checkSettingsPolicy().subscribe((result) => {
        expect(dialogMock.openErrorInfoDialog).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/organization/credentials']);
        expect(result).toBe(false);
        done();
      });
    });

    it('should not log the user out when denying (unlike the onboarding policy)', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));

      service.checkSettingsPolicy().subscribe(() => {
        expect(authServiceMock.logout).not.toHaveBeenCalled();
        done();
      });
    });

    it('should deny a LEAR holding CredentialIssuer/Configure, a power the API ignores', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));
      authServiceMock.hasPower.mockReturnValue(true);

      service.checkSettingsPolicy().subscribe((result) => {
        expect(result).toBe(false);
        expect(authServiceMock.hasPower).not.toHaveBeenCalled();
        done();
      });
    });

    it('should return true for SysAdmin even if /me fell back to LEAR', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));
      (authServiceMock.isSysAdmin as jest.Mock).mockReturnValue(true);

      service.checkSettingsPolicy().subscribe((result) => {
        expect(result).toBe(true);
        expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
