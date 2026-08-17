import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Guard that denies access to organization contact management if:
 * - Feature flag is disabled (AC-04)
 * - User lacks write capability / Caso A (AC-03, EC-04)
 *
 * @since EUD-226
 */
export const organizationContactGuard: CanActivateFn = () => {
  const router = inject(Router);

  // TODO: Inject TenantFeatureFlags service when available
  // For now, assume feature is enabled
  const featureEnabled = true;

  // TODO: Inject AuthorizationService / UserCapabilities when available
  // For now, assume user has write capability
  const canWrite = true;

  // AC-04: Feature flag disabled → deny access
  if (!featureEnabled) {
    console.warn('Organization contact feature is disabled');
    router.navigate(['/']);
    return false;
  }

  // AC-03, EC-04: Caso A (no write capability) → deny access
  if (!canWrite) {
    console.warn('User lacks write capability for organization contact');
    router.navigate(['/']);
    return false;
  }

  return true;
};
