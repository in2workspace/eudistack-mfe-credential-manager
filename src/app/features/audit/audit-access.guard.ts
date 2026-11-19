import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';

/**
 * Lets the audit section open only to someone who may read the audit (EUD-293); anyone else is taken to
 * the access-denied notice, which makes no request.
 *
 * Waits for the initial authentication check: the powers are empty until it resolves, and evaluating
 * them earlier would deny everyone who reloads straight into `/audit`. Unlike `settingsGuard`, it opens
 * no dialog and does not redirect home: the notice is the answer.
 */
export const auditAccessGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authCheckComplete$.pipe(
    filter(Boolean),
    take(1),
    map(() => authService.canAccessAudit() || router.createUrlTree(['/audit/access-denied']))
  );
};
