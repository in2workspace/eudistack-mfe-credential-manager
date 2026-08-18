import { TestBed } from '@angular/core/testing';
import { of, Observable } from 'rxjs';
import { organizationContactGuard } from './organization-contact.guard';
import { PoliciesService } from 'src/app/core/services/policies.service';

/**
 * Unit tests for {@link organizationContactGuard}.
 *
 * @since EUD-226 (Task 27, rewritten again to delegate to
 * `PoliciesService.checkOrganizationContactPolicy()` instead of reading
 * `AuthService` predicates synchronously — see that guard's doc for the race
 * condition this fixes. Mirrors `accessLevel.guard.spec.ts`.)
 */
const mockPoliciesService = {
  checkOrganizationContactPolicy: jest.fn()
};

describe('organizationContactGuard', () => {
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

  it('delegates to checkOrganizationContactPolicy (true, AC-03/AC-04)', (done) => {
    mockPoliciesService.checkOrganizationContactPolicy.mockReturnValue(of(true));

    TestBed.runInInjectionContext(() => {
      const result$ = organizationContactGuard(null as any, null as any) as Observable<boolean>;

      result$.subscribe((value) => {
        expect(mockPoliciesService.checkOrganizationContactPolicy).toHaveBeenCalled();
        expect(value).toBe(true);
        done();
      });
    });
  });

  it('delegates to checkOrganizationContactPolicy (false, AC-03/AC-04)', (done) => {
    mockPoliciesService.checkOrganizationContactPolicy.mockReturnValue(of(false));

    TestBed.runInInjectionContext(() => {
      const result$ = organizationContactGuard(null as any, null as any) as Observable<boolean>;

      result$.subscribe((value) => {
        expect(mockPoliciesService.checkOrganizationContactPolicy).toHaveBeenCalled();
        expect(value).toBe(false);
        done();
      });
    });
  });
});
