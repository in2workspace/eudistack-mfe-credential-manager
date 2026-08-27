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
  // determines whether the credential can be issued with 'direct' delivery.
  cryptographic_binding_methods_supported?: string[];
  cnf_required?: boolean;
  credential_definition?: { type: string[] };
  credential_metadata?: CredentialMetadataDto;
}

export interface CredentialIssuerMetadataDto {
  credential_issuer: string;
  credential_configurations_supported: Record<string, CredentialConfigurationDto>;
}
