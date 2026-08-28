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

  it('yields no main fields when the configuration declares no claims', () => {
    const schema = builder.buildSchema('learcredential.employee.w3c.4', { format: 'jwt_vc_json' }, credential);

    expect(schema.main).toEqual([]);
  });
});
