import { matchLegacyConfig, normalizeLegacyCredential } from './legacy-credential-support';
import { CredentialConfigurationDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';

function cfg(type: string[]): CredentialConfigurationDto {
  return {
    format: 'jwt_vc_json',
    credential_definition: { type },
    credential_metadata: { display: [], claims: [] },
  };
}

// Mirrors the relevant shape of credential_configurations_supported.
const CONFIGS: Record<string, CredentialConfigurationDto> = {
  'learcredential.employee.w3c.2': cfg(['VerifiableCredential', 'LEARCredentialEmployee']),
  'learcredential.employee.w3c.3': cfg(['VerifiableCredential', 'LEARCredentialEmployee']),
  'learcredential.employee.w3c.4': cfg(['VerifiableCredential', 'learcredential.employee.w3c.4']),
  'learcredential.machine.w3c.1': cfg(['VerifiableCredential', 'LEARCredentialMachine']),
  'learcredential.machine.w3c.2': cfg(['VerifiableCredential', 'LEARCredentialMachine']),
  'learcredential.machine.w3c.3': cfg(['VerifiableCredential', 'learcredential.machine.w3c.3']),
  'gx.labelcredential.w3c.1': cfg(['VerifiableCredential', 'gx:LabelCredential']),
  'gx.labelcredential.w3c.2': cfg(['VerifiableCredential', 'gx.labelcredential.w3c.2']),
};

describe('matchLegacyConfig', () => {
  it('resolves LEARCredentialEmployee to the highest legacy-declaring version (w3c.3)', () => {
    const result = matchLegacyConfig(['LEARCredentialEmployee', 'VerifiableCredential'], CONFIGS);
    expect(result?.configId).toBe('learcredential.employee.w3c.3');
  });

  it('resolves LEARCredentialMachine to w3c.2 (highest that still declares the legacy type)', () => {
    const result = matchLegacyConfig(['VerifiableCredential', 'LEARCredentialMachine'], CONFIGS);
    expect(result?.configId).toBe('learcredential.machine.w3c.2');
  });

  it('resolves gx:LabelCredential to w3c.1 (the only declaring config)', () => {
    const result = matchLegacyConfig(['VerifiableCredential', 'gx:LabelCredential'], CONFIGS);
    expect(result?.configId).toBe('gx.labelcredential.w3c.1');
  });

  it('ignores w3c.4/w3c.3/w3c.2 that no longer declare the legacy name', () => {
    // Only w3c.2 and w3c.3 declare "LEARCredentialEmployee"; w3c.4 must never win.
    const result = matchLegacyConfig(['LEARCredentialEmployee'], CONFIGS);
    expect(result?.configId).not.toBe('learcredential.employee.w3c.4');
  });

  it('returns null when no config declares the type', () => {
    expect(matchLegacyConfig(['SomethingUnknown'], CONFIGS)).toBeNull();
  });

  it('returns null for only-generic types', () => {
    expect(matchLegacyConfig(['VerifiableCredential'], CONFIGS)).toBeNull();
  });

  it('returns null for empty/undefined input', () => {
    expect(matchLegacyConfig(undefined, CONFIGS)).toBeNull();
    expect(matchLegacyConfig([], CONFIGS)).toBeNull();
    expect(matchLegacyConfig(['LEARCredentialEmployee'], null)).toBeNull();
  });
});

describe('normalizeLegacyCredential', () => {
  it('maps DOME v1 tmf_* power keys onto domain/function/action', () => {
    const vc = {
      type: ['VerifiableCredential', 'LEARCredentialMachine'],
      credentialSubject: {
        mandate: {
          power: [{ id: 'p1', tmf_domain: 'DOME', tmf_function: 'Certification', tmf_action: ['Attest', 'Upload'] }],
        },
      },
    };

    const out: any = normalizeLegacyCredential(vc);
    const power = out.credentialSubject.mandate.power[0];
    expect(power.domain).toBe('DOME');
    expect(power.function).toBe('Certification');
    expect(power.action).toEqual(['Attest', 'Upload']);
  });

  it('maps mandator.emailAddress onto email', () => {
    const vc = {
      credentialSubject: { mandate: { mandator: { emailAddress: 'jesus.ruiz@in2.es' } } },
    };
    const out: any = normalizeLegacyCredential(vc);
    expect(out.credentialSubject.mandate.mandator.email).toBe('jesus.ruiz@in2.es');
  });

  it('leaves modern-shaped data unchanged (idempotent)', () => {
    const vc = {
      credentialSubject: {
        mandate: {
          mandator: { email: 'a@b.c' },
          power: [{ domain: 'DOME', function: 'Onboarding', action: ['Execute'], type: 'domain' }],
        },
      },
    };
    const out: any = normalizeLegacyCredential(vc);
    expect(out.credentialSubject.mandate.mandator.email).toBe('a@b.c');
    expect(out.credentialSubject.mandate.power[0].function).toBe('Onboarding');
    expect(out.credentialSubject.mandate.power[0].action).toEqual(['Execute']);
  });

  it('does not mutate the original credential', () => {
    const vc: any = { credentialSubject: { mandate: { mandator: { emailAddress: 'x@y.z' } } } };
    normalizeLegacyCredential(vc);
    expect(vc.credentialSubject.mandate.mandator.email).toBeUndefined();
  });

  it('handles credentials without a mandate gracefully', () => {
    expect(() => normalizeLegacyCredential({ credentialSubject: {} })).not.toThrow();
    expect(normalizeLegacyCredential(null)).toBeNull();
  });
});
