export interface ClaimDisplayDto {
  name: string;
  locale: string;
}

export interface ClaimDefinitionDto {
  path: string[];
  display: ClaimDisplayDto[];
  value_map?: Record<string, string>;
}

export interface CredentialMetadataDto {
  display: ClaimDisplayDto[];
  claims: ClaimDefinitionDto[];
}

export interface CredentialConfigurationDto {
  format: string;
  /**
   * Declared when the holder key arrives through an OID4VCI wallet proof. Its presence is
   * exactly what makes `direct` delivery impossible for the configuration — see
   * `CredentialIssuerMetadataService.isDirectDeliveryEligible`.
   *
   * The issuer omits the field rather than publishing an empty array, so absent and empty mean
   * the same thing and both must be treated as eligible.
   */
  cryptographic_binding_methods_supported?: string[];
  /**
   * Whether the credential carries a `cnf` claim at all. The other half of the holder-binding
   * rule: together with `cryptographic_binding_methods_supported` it says whether the issuance
   * request has to supply the holder key itself — see
   * `CredentialIssuerMetadataService.isHolderKeyRequired`.
   *
   * Optional because an issuer older than this field publishes nothing, and a missing flag is
   * read as `false` (fail-closed: never generate a key we cannot prove the credential binds to).
   */
  cnf_required?: boolean;
  credential_definition?: { type: string[] };
  credential_metadata?: CredentialMetadataDto;
}

export interface CredentialIssuerMetadataDto {
  credential_issuer: string;
  credential_configurations_supported: Record<string, CredentialConfigurationDto>;
}
