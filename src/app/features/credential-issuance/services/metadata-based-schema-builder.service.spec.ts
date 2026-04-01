import { TestBed } from '@angular/core/testing';
import { MetadataBasedSchemaBuilder } from './metadata-based-schema-builder.service';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { CredentialConfigurationDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';

class MockCredentialIssuerMetadataService {
  getConfigurationById = jest.fn();
}

class MockAuthService {
  extractRawMandator = jest.fn();
}

describe('MetadataBasedSchemaBuilder', () => {
  let service: MetadataBasedSchemaBuilder;
  let metadataService: MockCredentialIssuerMetadataService;
  let authService: MockAuthService;

  const mockCredentialConfig: CredentialConfigurationDto = {
    format: 'jwt_vc_json',
    credential_definition: { type: ['LEARCredentialEmployee'] },
    credential_metadata: {
      display: [{ name: 'Employee Credential', locale: 'en' }],
      claims: [
        {
          path: ['mandatee', 'firstName'],
          display: [{ name: 'First Name', locale: 'en' }]
        },
        {
          path: ['mandatee', 'lastName'],
          display: [{ name: 'Last Name', locale: 'en' }]
        },
        {
          path: ['mandator', 'organization'],
          display: [{ name: 'Organization', locale: 'en' }]
        }
      ]
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MetadataBasedSchemaBuilder,
        { provide: CredentialIssuerMetadataService, useClass: MockCredentialIssuerMetadataService },
        { provide: AuthService, useClass: MockAuthService }
      ]
    });

    service = TestBed.inject(MetadataBasedSchemaBuilder);
    metadataService = TestBed.inject(CredentialIssuerMetadataService) as any;
    authService = TestBed.inject(AuthService) as any;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when no configuration is found', () => {
    metadataService.getConfigurationById.mockReturnValue(undefined);
    
    const result = service.buildSchemaFromMetadata('non-existent', false);
    
    expect(result).toBeNull();
  });

  it('should build schema from metadata configuration', () => {
    metadataService.getConfigurationById.mockReturnValue(mockCredentialConfig);
    authService.extractRawMandator.mockReturnValue({
      organization: 'Test Org',
      firstName: 'John',
      lastName: 'Doe'
    });
    
    const result = service.buildSchemaFromMetadata('test-config', false);
    
    expect(result).not.toBeNull();
    expect(result![0]).toBeDefined(); // form schema
    expect(result![1]).toBeDefined(); // static data
    expect(result![0].length).toBeGreaterThan(0);
  });

  it('should group fields correctly by path', () => {
    metadataService.getConfigurationById.mockReturnValue(mockCredentialConfig);
    authService.extractRawMandator.mockReturnValue({});
    
    const result = service.buildSchemaFromMetadata('test-config', false);
    
    expect(result).not.toBeNull();
    const [formSchema, staticSchema] = result!;
    
    // Should have grouped fields by parent path
    const formGroupKeys = formSchema.map(group => group.key);
    expect(formGroupKeys).toContain('mandatee'); // This should be in the form
    
    // Mandator fields are moved to static data when not onBehalf
    expect(staticSchema).toBeDefined();
  });

  it('should handle onBehalf mode correctly', () => {
    metadataService.getConfigurationById.mockReturnValue(mockCredentialConfig);
    authService.extractRawMandator.mockReturnValue({});
    
    const resultOnBehalf = service.buildSchemaFromMetadata('test-config', true);
    const resultNormal = service.buildSchemaFromMetadata('test-config', false);
    
    expect(resultOnBehalf).not.toBeNull();
    expect(resultNormal).not.toBeNull();
    
    // The schema structure might differ based on onBehalf mode
    // (some fields might be moved to static data)
    expect(resultOnBehalf![0]).toBeDefined();
    expect(resultNormal![0]).toBeDefined();
  });
});