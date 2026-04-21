/**
 * Response of GET /api/v1/me from the Issuer backend.
 * Resolves the caller's role against the current tenant.
 *
 * Backend role → frontend role mapping (applied in AuthService):
 *   SYSADMIN + tenant === 'platform'  → SYSADMIN_READONLY
 *   SYSADMIN + tenant !== 'platform'  → TENANT_ADMIN
 *   TENANT_ADMIN                      → TENANT_ADMIN
 *   LEAR                              → LEAR
 */
export interface MeResponse {
  organizationIdentifier: string;
  role: 'SYSADMIN' | 'TENANT_ADMIN' | 'LEAR';
  readOnly: boolean;
  tenant: string;
}
