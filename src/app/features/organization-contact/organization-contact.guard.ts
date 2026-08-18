import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { PoliciesService } from 'src/app/core/services/policies.service';

/**
 * Guard that denies access to organization contact management if:
 * - Feature flag is disabled (AC-04)
 * - User lacks write capability / Caso A (AC-03, EC-04)
 *
 * Delegates to `PoliciesService.checkOrganizationContactPolicy()`, which awaits
 * the backend's own verdict (`AuthService.resolveRole$()`) before evaluating —
 * same pattern as `settingsGuard` / `checkSettingsPolicy()`. Do not read
 * `AuthService` predicates synchronously here: they collapse "not resolved
 * yet" into a value (see `AuthService.roleType` doc), so a guard evaluated
 * before `GET /api/v1/me` answers would deny every caller who navigates or
 * reloads directly into this route first.
 *
 * @since EUD-226
 */
export const organizationContactGuard: CanActivateFn = () => {
  const policiesService = inject(PoliciesService);
  return policiesService.checkOrganizationContactPolicy();
};
