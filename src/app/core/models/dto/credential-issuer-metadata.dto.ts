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
}

export interface CredentialIssuerMetadataDto {
  credential_issuer: string;
  credential_configurations_supported: Record<string, CredentialConfigurationDto>;
}
