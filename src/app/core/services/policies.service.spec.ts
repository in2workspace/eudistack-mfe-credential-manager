import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';

import { PoliciesService } from './policies.service';
import { AuthService } from '../services/auth.service';
import { RoleType } from '../models/enums/auth-rol-type.enum';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';

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
      resolveRole$,
      authCheckComplete$: of(true)
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

      service.checkOnboardingPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(authServiceMock.hasPower).toHaveBeenCalledWith(
            'Onboarding',
            'Execute'
          );
          expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });

    it('should show an error dialog, redirect and return false if the user lacks power', (done) => {
      authServiceMock.hasPower.mockReturnValue(false);

      service.checkOnboardingPolicy().subscribe({
        next: (result) => {
          expect(dialogMock.openErrorInfoDialog).toHaveBeenCalledWith(
            expect.anything(),
            'error.policy.message',
            'error.policy.title'
          );
          expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
          expect(authServiceMock.logout).toHaveBeenCalled();
          expect(result).toBe(false);
          done();
        },
        error: done
      });
    });

    it('should return true for SysAdmin even without Onboarding/Execute', (done) => {
      authServiceMock.hasPower.mockReturnValue(false);
      authServiceMock.isSysAdmin.mockReturnValue(true);

      service.checkOnboardingPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
          expect(routerMock.navigate).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });
  });

  describe('authentication initialization', () => {
    it('should not evaluate onboarding powers until the auth check completes', () => {
      const authCheckComplete$ = new Subject<boolean>();

      authServiceMock.authCheckComplete$ =
        authCheckComplete$.asObservable();
      authServiceMock.hasPower.mockReturnValue(true);

      let result: boolean | undefined;

      service.checkOnboardingPolicy().subscribe((value) => {
        result = value;
      });

      expect(authServiceMock.hasPower).not.toHaveBeenCalled();
      expect(authServiceMock.isSysAdmin).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      authCheckComplete$.next(false);

      expect(authServiceMock.hasPower).not.toHaveBeenCalled();
      expect(authServiceMock.isSysAdmin).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      authCheckComplete$.next(true);

      expect(authServiceMock.isSysAdmin).toHaveBeenCalled();
      expect(authServiceMock.hasPower).toHaveBeenCalledWith(
        'Onboarding',
        'Execute'
      );
      expect(result).toBe(true);
    });

    it('should not resolve the settings role until the auth check completes', () => {
      const authCheckComplete$ = new Subject<boolean>();

      authServiceMock.authCheckComplete$ =
        authCheckComplete$.asObservable();
      resolveRole$.mockReturnValue(of(RoleType.TENANT_ADMIN));

      let result: boolean | undefined;

      service.checkSettingsPolicy().subscribe((value) => {
        result = value;
      });

      expect(resolveRole$).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      authCheckComplete$.next(false);

      expect(resolveRole$).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      authCheckComplete$.next(true);

      expect(resolveRole$).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  /**
   * Settings is gated on the backend role returned by resolveRole$(), not on a
   * TMF power. The Issuer API does not use CredentialIssuer/Configure.
   */
  describe('checkSettingsPolicy', () => {
    it('should return true for TENANT_ADMIN', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.TENANT_ADMIN));

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(resolveRole$).toHaveBeenCalledTimes(1);
          expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
          expect(routerMock.navigate).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });

    it('should return true for SYSADMIN_READONLY', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.SYSADMIN_READONLY));

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });

    it('should show an error dialog, redirect and return false for LEAR', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(dialogMock.openErrorInfoDialog).toHaveBeenCalledWith(
            expect.anything(),
            'error.policy.message',
            'error.policy.title'
          );
          expect(routerMock.navigate).toHaveBeenCalledWith([
            '/organization/credentials'
          ]);
          expect(result).toBe(false);
          done();
        },
        error: done
      });
    });

    it('should not log the user out when denying Settings access', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));

      service.checkSettingsPolicy().subscribe({
        next: () => {
          expect(authServiceMock.logout).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });

    it('should deny a LEAR holding CredentialIssuer/Configure', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));
      authServiceMock.hasPower.mockReturnValue(true);

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(false);
          expect(authServiceMock.hasPower).not.toHaveBeenCalled();
          expect(routerMock.navigate).toHaveBeenCalledWith([
            '/organization/credentials'
          ]);
          done();
        },
        error: done
      });
    });

    it('should return true for SysAdmin if resolveRole$ falls back to LEAR', (done) => {
      resolveRole$.mockReturnValue(of(RoleType.LEAR));
      authServiceMock.isSysAdmin.mockReturnValue(true);

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
          expect(routerMock.navigate).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });
  });
});