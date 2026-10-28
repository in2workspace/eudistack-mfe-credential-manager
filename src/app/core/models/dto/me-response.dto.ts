/**
 * Response of GET /api/v1/me from the Issuer backend.
 * Resolves the caller's role against the current tenant.
 *
 * Backend role → frontend role mapping (applied in AuthService):
 *   SYSADMIN + tenant === 'platform'  → SYSADMIN_READONLY
 *   SYSADMIN + tenant !== 'platform'  → TENANT_ADMIN
 *   TENANT_ADMIN                      → TENANT_ADMIN
 *   LEAR                              → LEAR
 *   USER (no admin power, EUD-253)    → LEAR, then denied by the Onboarding power guard
 */
export interface MeResponse {
  organizationIdentifier: string;
  role: 'SYSADMIN' | 'TENANT_ADMIN' | 'LEAR' | 'USER';
  readOnly: boolean;
  tenant: string;
  tenantType: string;
  /**
   * Tenant-level feature flags (EUD-226). Optional because the field was
   * added after the initial /me contract — must degrade gracefully for any
   * backend build that predates it.
   */
  tenantFeatures?: {
    organizationContactEnabled: boolean;
  };
}
