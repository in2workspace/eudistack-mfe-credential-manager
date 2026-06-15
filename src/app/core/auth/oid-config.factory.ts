import { StsConfigLoader } from 'angular-auth-oidc-client';
import { TenantService } from '../services/tenant.service';
import { TenantAwareStsConfigLoader } from './tenant-aware-sts-config.loader';

export function oidcConfigFactory(tenantService: TenantService): StsConfigLoader {
  return new TenantAwareStsConfigLoader(tenantService);
}