export interface ClaimDisplayDto {
  name: string;
  locale: string;
}

export interface ClaimDefinitionDto {
  path: string[];
  display: ClaimDisplayDto[];
}

export interface CredentialMetadataDto {
  display: ClaimDisplayDto[];
  claims: ClaimDefinitionDto[];
}

export interface CredentialConfigurationDto {
  format: string;
  /** W3C VC formats (jwt_vc_json, jwt_vc_json-ld, ldp_vc). */
  credential_definition?: { type: string[] };
  /** dc+sd-jwt. */
  vct?: string;
  /** mso_mdoc. */
  doctype?: string;
  credential_metadata?: CredentialMetadataDto;
  /**
   * Present when the issuer requires a wallet key proof for this type, i.e. the credential is
   * cryptographically bound to a holder key (ADR-110). Its mere presence is the signal; the inner
   * shape (proof type -> supported signing algorithms) is the wallet's concern, not the form's.
   */
  proof_types_supported?: Record<string, unknown>;
}

export interface CredentialIssuerMetadataDto {
  credential_issuer: string;
  credential_configurations_supported: Record<string, CredentialConfigurationDto>;
}
