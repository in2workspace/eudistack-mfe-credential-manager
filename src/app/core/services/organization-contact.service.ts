import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganizationContact } from '../models/entity/organization-contact';

/**
 * Service for managing organization contact information.
 *
 * @since EUD-226
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationContactService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/organizations';

  /**
   * Fetches the contact information for an organization.
   *
   * @param orgId - The organization ID
   * @returns Observable of the organization contact (email may be null)
   */
  fetchContact(orgId: string): Observable<OrganizationContact> {
    return this.http.get<OrganizationContact>(`${this.baseUrl}/${orgId}/contact`);
  }

  /**
   * Updates the contact email for an organization.
   *
   * @param orgId - The organization ID
   * @param email - The new contact email address
   * @returns Observable that completes when update succeeds
   */
  updateContact(orgId: string, email: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${orgId}/contact`, { email });
  }
}
