/**
 * Organization contact information for lifecycle notifications.
 *
 * @since EUD-226
 */
export interface OrganizationContact {
  /**
   * Contact email address for the organization.
   * Null if no contact email has been configured yet.
   */
  email: string | null;
}
