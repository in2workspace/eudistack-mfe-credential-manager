import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { auditAccessGuard } from './audit-access.guard';

describe('auditAccessGuard', () => {
  let authCheckComplete: BehaviorSubject<boolean>;
  let authService: { authCheckComplete$: Observable<boolean>; canAccessAudit: jest.Mock };

  const run = (): Observable<boolean | UrlTree> =>
    TestBed.runInInjectionContext(() =>
      auditAccessGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

  beforeEach(() => {
    authCheckComplete = new BehaviorSubject<boolean>(false);
    authService = { authCheckComplete$: authCheckComplete.asObservable(), canAccessAudit: jest.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }]
    });
  });

  it('lets in someone who may read the audit', done => {
    authService.canAccessAudit.mockReturnValue(true);
    authCheckComplete.next(true);

    run().subscribe(result => {
      expect(result).toBe(true);
      done();
    });
  });

  it('takes anyone else to the access-denied notice, without a dialog', done => {
    authService.canAccessAudit.mockReturnValue(false);
    authCheckComplete.next(true);

    run().subscribe(result => {
      expect(result).toBeInstanceOf(UrlTree);
      expect(result.toString()).toBe('/audit/access-denied');
      done();
    });
  });

  // The powers are empty until the initial check resolves: evaluating them earlier would deny
  // everyone who reloads straight into /audit.
  it('does not evaluate the powers before the authentication check has completed', () => {
    authService.canAccessAudit.mockReturnValue(false);
    const emissions: Array<boolean | UrlTree> = [];

    run().subscribe(result => emissions.push(result));

    expect(emissions).toEqual([]);
    expect(authService.canAccessAudit).not.toHaveBeenCalled();

    authService.canAccessAudit.mockReturnValue(true);
    authCheckComplete.next(true);

    expect(emissions).toEqual([true]);
  });

  it('decides once, even if the authentication check completes again', () => {
    authService.canAccessAudit.mockReturnValue(true);
    authCheckComplete.next(true);
    const emissions: Array<boolean | UrlTree> = [];

    run().subscribe({ next: result => emissions.push(result) });
    authCheckComplete.next(true);

    expect(emissions).toEqual([true]);
  });
});
