export interface CredentialConfigurationDto {
  format: string;
  credential_definition?: { type: string[] };
}

export interface CredentialIssuerMetadataDto {
  credential_issuer: string;
  credential_configurations_supported: Record<string, CredentialConfigurationDto>;
}
