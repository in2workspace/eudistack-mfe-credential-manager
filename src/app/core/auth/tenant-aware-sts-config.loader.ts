import { StsConfigLoader } from 'angular-auth-oidc-client';
import { from, map } from 'rxjs';
import { TenantService } from '../services/tenant.service';
import { buildOidcConfig } from './oidc-config.builder';

export class TenantAwareStsConfigLoader implements StsConfigLoader {
  constructor(private readonly tenantService: TenantService) {}

  loadConfigs() {
    return from(this.tenantService.resolve()).pipe(
      map(() => {
        const tenant = this.tenantService.tenant();

        return [buildOidcConfig(tenant)];
      })
    );
  }
}