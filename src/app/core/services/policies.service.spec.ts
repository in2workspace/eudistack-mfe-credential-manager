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
  let canAccessSettings: jest.Mock;
  let canAccessOrganizationContact: jest.Mock;
  let canWriteOrganizationContact: jest.Mock;

  /**
   * Drives both halves of the settings gate at once: `resolveRole$()` is what the policy
   * awaits, `canAccessSettings()` is what it then evaluates. Keeping them in one helper
   * stops the spec from reimplementing the predicate — that duplication is what let the
   * menu and the guard disagree (EUD-72 §2.3).
   */
  const givenSettingsAccess = (role: RoleType, allowed: boolean) => {
    resolveRole$.mockReturnValue(of(role));
    canAccessSettings.mockReturnValue(allowed);
  };

  /**
   * Same idea for `/organization-contact` (EUD-226): drives the role resolution
   * `checkOrganizationContactPolicy` awaits together with the two predicates it
   * then evaluates (feature flag + write capability).
   */
  const givenOrganizationContactAccess = (
    role: RoleType,
    featureEnabled: boolean,
    canWrite: boolean
  ) => {
    resolveRole$.mockReturnValue(of(role));
    canAccessOrganizationContact.mockReturnValue(featureEnabled);
    canWriteOrganizationContact.mockReturnValue(canWrite);
  };

  beforeEach(() => {
    resolveRole$ = jest.fn().mockReturnValue(of(RoleType.LEAR));
    canAccessSettings = jest.fn().mockReturnValue(false);
    canAccessOrganizationContact = jest.fn().mockReturnValue(false);
    canWriteOrganizationContact = jest.fn().mockReturnValue(false);

    authServiceMock = {
      hasPower: jest.fn(),
      isSysAdmin: jest.fn().mockReturnValue(false),
      canAccessSettings,
      canAccessOrganizationContact,
      canWriteOrganizationContact,
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
      givenSettingsAccess(RoleType.TENANT_ADMIN, true);

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
   * Settings is gated on `AuthService.canAccessSettings()` — the predicate the navbar
   * entry and the Settings sidenav also evaluate — and never on a TMF power: the Issuer
   * API does not use CredentialIssuer/Configure. What belongs here is the plumbing (wait
   * for the auth check, then for the role, then ask, then deny properly); who is allowed
   * in is auth.service.spec's business.
   */
  describe('checkSettingsPolicy', () => {
    it('should return true for TENANT_ADMIN', (done) => {
      givenSettingsAccess(RoleType.TENANT_ADMIN, true);

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
      givenSettingsAccess(RoleType.SYSADMIN_READONLY, true);

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(dialogMock.openErrorInfoDialog).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });

    // The predicate is consulted only after the backend has answered: a synchronous
    // roleType() read would deny every admin who navigates before GET /api/v1/me lands.
    it('should not evaluate the predicate before the role resolves', (done) => {
      const role$ = new Subject<RoleType>();
      resolveRole$.mockReturnValue(role$.asObservable());
      canAccessSettings.mockReturnValue(true);

      service.checkSettingsPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          done();
        },
        error: done
      });

      expect(canAccessSettings).not.toHaveBeenCalled();

      role$.next(RoleType.TENANT_ADMIN);
    });

    it('should show an error dialog, redirect and return false for LEAR', (done) => {
      givenSettingsAccess(RoleType.LEAR, false);

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
      givenSettingsAccess(RoleType.LEAR, false);

      service.checkSettingsPolicy().subscribe({
        next: () => {
          expect(authServiceMock.logout).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });

    it('should deny a LEAR holding CredentialIssuer/Configure', (done) => {
      givenSettingsAccess(RoleType.LEAR, false);
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

    // The platform SysAdmin escape hatch lives inside canAccessSettings(); all this
    // policy has to do is honour it once resolveRole$() has fallen back to LEAR.
    it('should return true for SysAdmin if resolveRole$ falls back to LEAR', (done) => {
      givenSettingsAccess(RoleType.LEAR, true);
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

  /**
   * Organization contact (EUD-226) is gated on two predicates: the tenant
   * feature flag (AC-04) and write capability / Caso A (AC-03, EC-04). Both
   * must only be consulted after `resolveRole$()` resolves — see
   * `organization-contact.guard.ts` for the race this replaced.
   */
  describe('checkOrganizationContactPolicy', () => {
    it('should return true when feature enabled and user has write capability (Caso B/C)', (done) => {
      givenOrganizationContactAccess(RoleType.TENANT_ADMIN, true, true);

      service.checkOrganizationContactPolicy().subscribe({
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

    // A synchronous read of canAccessOrganizationContact()/canWriteOrganizationContact()
    // before the backend answers would deny every caller who navigates first.
    it('should not evaluate the predicates before the role resolves', (done) => {
      const role$ = new Subject<RoleType>();
      resolveRole$.mockReturnValue(role$.asObservable());
      canAccessOrganizationContact.mockReturnValue(true);
      canWriteOrganizationContact.mockReturnValue(true);

      service.checkOrganizationContactPolicy().subscribe({
        next: (result) => {
          expect(result).toBe(true);
          done();
        },
        error: done
      });

      expect(canAccessOrganizationContact).not.toHaveBeenCalled();
      expect(canWriteOrganizationContact).not.toHaveBeenCalled();

      role$.next(RoleType.TENANT_ADMIN);
    });

    it('should show an error dialog, redirect to /home and return false when the feature is disabled (AC-04)', (done) => {
      givenOrganizationContactAccess(RoleType.LEAR, false, true);

      service.checkOrganizationContactPolicy().subscribe({
        next: (result) => {
          expect(dialogMock.openErrorInfoDialog).toHaveBeenCalledWith(
            expect.anything(),
            'error.policy.message',
            'error.policy.title'
          );
          expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
          expect(canWriteOrganizationContact).not.toHaveBeenCalled();
          expect(result).toBe(false);
          done();
        },
        error: done
      });
    });

    it('should show an error dialog, redirect to /home and return false when the user lacks write capability (Caso A, AC-03/EC-04)', (done) => {
      givenOrganizationContactAccess(RoleType.SYSADMIN_READONLY, true, false);

      service.checkOrganizationContactPolicy().subscribe({
        next: (result) => {
          expect(dialogMock.openErrorInfoDialog).toHaveBeenCalledWith(
            expect.anything(),
            'error.policy.message',
            'error.policy.title'
          );
          expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
          expect(result).toBe(false);
          done();
        },
        error: done
      });
    });

    it('should not log the user out when denying organization-contact access', (done) => {
      givenOrganizationContactAccess(RoleType.LEAR, false, true);

      service.checkOrganizationContactPolicy().subscribe({
        next: () => {
          expect(authServiceMock.logout).not.toHaveBeenCalled();
          done();
        },
        error: done
      });
    });
  });
});