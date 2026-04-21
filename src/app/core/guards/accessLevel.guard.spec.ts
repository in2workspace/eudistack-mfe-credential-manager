import { TestBed } from '@angular/core/testing';
import { of, Observable } from 'rxjs';
import { basicGuard, settingsGuard } from './accessLevel.guard';
import { PoliciesService } from '../services/policies.service';

const mockPoliciesService = {
  checkOnboardingPolicy: jest.fn(),
  checkSettingsPolicy: jest.fn()
};

describe('AccessLevel Guard Tests', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PoliciesService, useValue: mockPoliciesService }
      ]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basicGuard', () => {
    it('delegates to checkOnboardingPolicy (true)', (done) => {
      mockPoliciesService.checkOnboardingPolicy.mockReturnValue(of(true));

      TestBed.runInInjectionContext(() => {
        const result$ = basicGuard(null as any, null as any) as Observable<boolean>;

        result$.subscribe((value) => {
          expect(mockPoliciesService.checkOnboardingPolicy).toHaveBeenCalled();
          expect(value).toBe(true);
          done();
        });
      });
    });

    it('delegates to checkOnboardingPolicy (false)', (done) => {
      mockPoliciesService.checkOnboardingPolicy.mockReturnValue(of(false));

      TestBed.runInInjectionContext(() => {
        const result$ = basicGuard(null as any, null as any) as Observable<boolean>;

        result$.subscribe((value) => {
          expect(mockPoliciesService.checkOnboardingPolicy).toHaveBeenCalled();
          expect(value).toBe(false);
          done();
        });
      });
    });
  });

  describe('settingsGuard', () => {
    it('delegates to checkSettingsPolicy (true)', (done) => {
      mockPoliciesService.checkSettingsPolicy.mockReturnValue(of(true));

      TestBed.runInInjectionContext(() => {
        const result$ = settingsGuard(null as any, null as any) as Observable<boolean>;

        result$.subscribe((value) => {
          expect(mockPoliciesService.checkSettingsPolicy).toHaveBeenCalled();
          expect(value).toBe(true);
          done();
        });
      });
    });

    it('delegates to checkSettingsPolicy (false)', (done) => {
      mockPoliciesService.checkSettingsPolicy.mockReturnValue(of(false));

      TestBed.runInInjectionContext(() => {
        const result$ = settingsGuard(null as any, null as any) as Observable<boolean>;

        result$.subscribe((value) => {
          expect(mockPoliciesService.checkSettingsPolicy).toHaveBeenCalled();
          expect(value).toBe(false);
          done();
        });
      });
    });
  });
});
