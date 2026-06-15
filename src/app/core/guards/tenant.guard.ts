import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

export const tenantGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  return tenantService.tenant() !== ''
    ? true
    : router.createUrlTree(['/tenant-not-found']);
};
