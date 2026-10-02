import { TestBed } from '@angular/core/testing';
import { DynamicSchemaBuilder } from './dynamic-schema-builder.service';
import { CredentialConfigurationDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import { DetailsGroupField, DetailsKeyValueField } from 'src/app/core/models/entity/lear-credential-details';

describe('DynamicSchemaBuilder', () => {
  let builder: DynamicSchemaBuilder;

  const config: CredentialConfigurationDto = {
    format: 'jwt_vc_json',
    credential_metadata: {
      display: [{ name: 'LEAR Credential Employee', locale: 'en' }],
      claims: [
        {
          path: ['credentialSubject', 'mandate', 'mandatee', 'firstName'],
          display: [{ name: 'First Name', locale: 'en' }],
        },
        {
          path: ['credentialSubject', 'mandate', 'mandatee', 'email'],
          display: [{ name: 'Email', locale: 'en' }],
        },
      ],
    },
  };

  const credential = {
    credentialSubject: {
      mandate: { mandatee: { firstName: 'System', email: 'admin@example.com' } },
    },
  };

  /** The fields carry a resolver, not a value: evaluating it is what renders the detail. */
  function evaluate(main: DetailsGroupField[], label: string): unknown {
    const fields = main.flatMap(group =>
      Array.isArray(group.value) ? (group.value as DetailsKeyValueField[]) : []
    );
    const field = fields.find(f => f.label === label);
    return typeof field?.value === 'function' ? field.value(credential) : field?.value;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DynamicSchemaBuilder] });
    builder = TestBed.inject(DynamicSchemaBuilder);
  });

  it('builds one field per claim, labelled from the metadata', () => {
    const schema = builder.buildSchema('learcredential.employee.w3c.4', config, credential);

    const labels = schema.main
      .flatMap(group => (Array.isArray(group.value) ? (group.value as DetailsKeyValueField[]) : []))
      .map(field => field.label);

    expect(labels).toEqual(['First Name', 'Email']);
  });

  it('resolves each claim value by walking its path', () => {
    const schema = builder.buildSchema('learcredential.employee.w3c.4', config, credential);

    expect(evaluate(schema.main, 'First Name')).toBe('System');
    expect(evaluate(schema.main, 'Email')).toBe('admin@example.com');
  });

  it('renders the value as published, without mapping it through anything', () => {
    // OID4VCI 1.0 Final Appendix B.1 defines path, display and mandatory — nothing that
    // relabels a value. What the issuer puts in the credential is what the user reads.
    const labelConfig: CredentialConfigurationDto = {
      format: 'jwt_vc_json',
      credential_metadata: {
        display: [{ name: 'Gaia-X Label Credential', locale: 'en' }],
        claims: [{
          path: ['credentialSubject', 'gx:labelLevel'],
          display: [{ name: 'Label Level', locale: 'en' }],
        }],
      },
    };
    const labelCredential = { credentialSubject: { 'gx:labelLevel': 'BL' } };

    const schema = builder.buildSchema('gx.labelcredential.w3c.2', labelConfig, labelCredential);
    const field = (schema.main[0].value as DetailsKeyValueField[])[0];

    expect(typeof field.value === 'function' ? field.value(labelCredential) : field.value).toBe('BL');
  });

  it('labels the LEAR mandator commonName from i18n instead of the metadata display', () => {
    const commonName = (groupKey: string) => ({
      path: ['credentialSubject', 'mandate', groupKey, 'commonName'],
      display: [{ name: 'Common name', locale: 'en' }],
    });
    const mandatorConfig: CredentialConfigurationDto = {
      format: 'jwt_vc_json',
      credential_metadata: {
        display: [{ name: 'LEAR Credential Employee', locale: 'en' }],
        claims: [commonName('mandator'), commonName('signer')],
      },
    };

    const schema = builder.buildSchema('learcredential.employee.w3c.4', mandatorConfig, credential);
    const fieldOf = (groupKey: string) =>
      (schema.main.find(group => group.key === groupKey)?.value as DetailsKeyValueField[])[0];

    expect(fieldOf('mandator').key).toBe('commonName');
    expect(fieldOf('mandator').label).toBeUndefined();
    expect(fieldOf('signer').label).toBe('Common name');
  });

  it('puts the Label Credential validated criteria last, after the compliant credentials', () => {
    const claim = (name: string) => ({
      path: ['credentialSubject', name],
      display: [{ name, locale: 'en' }],
    });
    // Metadata order deliberately differs from the order the sections must render in.
    const labelConfig: CredentialConfigurationDto = {
      format: 'jwt_vc_json',
      credential_metadata: {
        display: [{ name: 'Gaia-X Label Credential', locale: 'en' }],
        claims: [claim('gx:validatedCriteria'), claim('gx:compliantCredentials'), claim('gx:labelLevel')],
      },
    };
    const criteria = ['https://example.org/criteria/1'];
    const labelCredential = { credentialSubject: { 'gx:validatedCriteria': criteria, 'gx:compliantCredentials': [] } };

    const schema = builder.buildSchema('gx.labelcredential.w3c.1', labelConfig, labelCredential);
    const last = schema.main[schema.main.length - 1];

    expect(schema.main.map(group => group.key)).toEqual([
      'credentialSubject',
      'gx:compliantCredentials',
      'gx:validatedCriteriaReference',
    ]);
    expect(last.custom?.value(labelCredential)).toEqual(criteria);
  });

  it('yields no main fields when the configuration declares no claims', () => {
    const schema = builder.buildSchema('learcredential.employee.w3c.4', { format: 'jwt_vc_json' }, credential);

    expect(schema.main).toEqual([]);
  });
});
