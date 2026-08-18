import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PATH } from '../constants/api-paths.constants';
import { OrganizationContact } from '../models/entity/organization-contact';
import { TenantService } from './tenant.service';

/**
 * Service for managing organization contact information (EUD-226).
 *
 * The URL is built from `TenantService.serverUrl`, not a relative path: the OIDC
 * config declares `secureRoutes: [serverUrl]` (see `oidc-config.builder.ts`), and
 * `AuthInterceptor` only attaches the Bearer token to URLs matching it. A relative
 * URL would resolve against the page origin instead, carry no Bearer, and 401 once
 * the tenant feature flag is enabled — same reasoning as `CredentialCatalogService`.
 *
 * @since EUD-226
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationContactService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  private contactUrl(orgId: string): string {
    return `${this.tenantService.serverUrl}${API_PATH.ORGANIZATIONS}/${orgId}/contact`;
  }

  /**
   * Fetches the contact information for an organization.
   *
   * @param orgId - The organization ID
   * @returns Observable of the organization contact (email may be null)
   */
  fetchContact(orgId: string): Observable<OrganizationContact> {
    return this.http.get<OrganizationContact>(this.contactUrl(orgId));
  }

  /**
   * Updates the contact email for an organization.
   *
   * @param orgId - The organization ID
   * @param email - The new contact email address
   * @returns Observable that completes when update succeeds
   */
  updateContact(orgId: string, email: string): Observable<void> {
    return this.http.put<void>(this.contactUrl(orgId), { email });
  }
}
