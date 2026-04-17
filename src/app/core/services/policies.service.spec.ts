import { TestBed } from '@angular/core/testing';
import { PoliciesService } from './policies.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { of } from 'rxjs';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let authServiceMock: jest.Mocked<AuthService>;
  let routerMock: jest.Mocked<Router>;
  let dialogMock: jest.Mocked<DialogWrapperService>;
  let translateMock: jest.Mocked<TranslateService>;

  beforeEach(() => {
    authServiceMock = {
      hasPower: jest.fn(),
      isSysAdmin: jest.fn().mockReturnValue(false),
      logout: jest.fn().mockReturnValue(of(null))
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

  describe('checkSettingsPolicy', () => {
    it('should return true if the user has the required power', (done) => {
      authServiceMock.hasPower.mockReturnValue(true);

      service.checkSettingsPolicy().subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it('should show error dialog and return false if the user lacks power', (done) => {
      authServiceMock.hasPower.mockReturnValue(false);

      service.checkSettingsPolicy().subscribe((result) => {
        expect(dialogMock.openErrorInfoDialog).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/organization/credentials']);
        expect(result).toBe(false);
        done();
      });
    });
  });
});
