import { DetailsField, DetailsGroupField, DetailsKeyValueField } from 'src/app/core/models/entity/lear-credential-details';
import { DetailsPowerComponent, detailsPowerToken } from '../components/details-power/details-power.component';
import {
  buildLearCredentialFallbackMainFields,
  readSpecificCredentialType,
  resolveLearFallbackLineage,
} from './lear-credential-fallback-schema';

/** The machine credential as the issuer returns it: mandator named by `commonName`, mandatee with no name at all. */
const machineCredential = {
  '@context': [
    'https://www.w3.org/ns/credentials/v2',
    'https://www.dome-marketplace.eu/2025/credentials/learcredentialmachine/v2',
  ],
  id: 'c09caadc-e630-479f-8eff-2d02290c649f',
  type: ['LEARCredentialMachine', 'VerifiableCredential'],
  issuer: 'did:elsi:VATES-B60645900',
  validFrom: '2025-09-15T06:11:19.802230162Z',
  validUntil: '2026-09-15T06:11:19.802230162Z',
  credentialSubject: {
    mandate: {
      mandator: {
        id: 'did:elsi:VATES-B60645900',
        organization: 'IN2 INGENIERIA DE LA INFORMACION SOCIEDAD LIMITADA',
        organizationIdentifier: 'VATES-B60645900',
        country: 'ES',
        commonName: 'Testa Mandatora',
        email: 'roger.miret@in2.es',
      },
      mandatee: {
        id: 'did:key:zDnaey7ZcQ1gfXxaZSYffjvhrrFtd7PQdQtJpofzRJNCwydHL',
        domain: 'issuer.dome-marketplace-sbx.org',
      },
      power: [{ action: ['Execute'], domain: 'DOME', function: 'Onboarding', type: 'domain' }],
    },
  },
};

/** The employee credential: mandatee named by first/last name, three powers. */
const employeeCredential = {
  id: 'urn:uuid:47a52def-3b92-4b6d-8577-833bb2485999',
  type: ['LEARCredentialEmployee', 'VerifiableCredential'],
  validFrom: '2025-10-15T10:16:44.012867826Z',
  validUntil: '2026-10-15T10:16:44.012867826Z',
  credentialSubject: {
    mandate: {
      mandatee: {
        email: 'roger.miret@in2.es',
        firstName: 'mandatee-inn',
        id: 'did:key:zDnaeWVZo9x7JMaXty8cdivQrJQmiecjVWWSFstN7eCMEA1Tx',
        lastName: 'mandator-altia',
      },
      mandator: {
        commonName: 'test manda',
        country: 'ES',
        email: 'roger.miret@altia.es',
        id: 'did:elsi:VATES-B60645900',
        organization: 'IN2 INGENIERIA DE LA INFORMACION SOCIEDAD LIMITADA',
        organizationIdentifier: 'VATES-B60645900',
        serialNumber: 'AAAAAAAA',
      },
      power: [
        { action: ['Execute'], domain: 'DOME', function: 'Onboarding', type: 'domain' },
        { action: ['Create', 'Update', 'Delete'], domain: 'DOME', function: 'ProductOffering', type: 'domain' },
        { action: ['Upload', 'Attest'], domain: 'DOME', function: 'Certification', type: 'domain' },
      ],
    },
  },
};

function group(fields: DetailsGroupField[], key: string): DetailsGroupField {
  const found = fields.find(field => field.key === key);
  if (!found) throw new Error(`No "${key}" group in the fallback schema`);
  return found;
}

/** Resolves a group's key-value fields the way CredentialDetailsService.evaluateField does. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evaluate(fields: DetailsGroupField[], key: string, credential: any): Record<string, unknown> {
  const children = group(fields, key).value as DetailsField[];
  const resolved: Record<string, unknown> = {};
  for (const child of children) {
    const keyValue = child as DetailsKeyValueField;
    resolved[keyValue.key!] = typeof keyValue.value === 'function' ? keyValue.value(credential) : keyValue.value;
  }
  return resolved;
}

describe('resolveLearFallbackLineage', () => {
  it('should recognize the employee family under every id it is named by', () => {
    expect(resolveLearFallbackLineage('learcredential.employee.w3c.4', {})).toBe('employee');
    expect(resolveLearFallbackLineage('LEAR_CREDENTIAL_EMPLOYEE', {})).toBe('employee');
    expect(resolveLearFallbackLineage(undefined, employeeCredential)).toBe('employee');
    expect(resolveLearFallbackLineage(undefined, { vct: 'learcredential.employee.sd.1' })).toBe('employee');
  });

  it('should recognize the machine family under every id it is named by', () => {
    expect(resolveLearFallbackLineage('learcredential.machine.w3c.3', {})).toBe('machine');
    expect(resolveLearFallbackLineage('LEAR_CREDENTIAL_MACHINE', {})).toBe('machine');
    expect(resolveLearFallbackLineage(undefined, machineCredential)).toBe('machine');
    expect(resolveLearFallbackLineage(undefined, { vct: 'learcredential.machine.sd.1' })).toBe('machine');
  });

  it('should return null for any other credential, so no shape is guessed', () => {
    expect(resolveLearFallbackLineage('gx.labelcredential.w3c.1', { type: ['gx:LabelCredential'] })).toBeNull();
    expect(resolveLearFallbackLineage(undefined, { type: ['VerifiableCertification'] })).toBeNull();
    expect(resolveLearFallbackLineage(undefined, undefined)).toBeNull();
    expect(resolveLearFallbackLineage(undefined, { type: 'not-an-array' })).toBeNull();
  });
});

describe('readSpecificCredentialType', () => {
  it('should return the type that names the credential, ignoring the generic ones', () => {
    expect(readSpecificCredentialType(machineCredential)).toBe('LEARCredentialMachine');
    expect(readSpecificCredentialType({ type: ['VerifiableCredential', 'VerifiableAttestation'] })).toBeUndefined();
    expect(readSpecificCredentialType({})).toBeUndefined();
    expect(readSpecificCredentialType(undefined)).toBeUndefined();
  });
});

describe('buildLearCredentialFallbackMainFields', () => {
  it('should expose the agreed mandator fields for a machine credential', () => {
    const fields = buildLearCredentialFallbackMainFields(machineCredential);

    // The mandator carries no first/last name, so `commonName` names it.
    expect(evaluate(fields, 'mandator', machineCredential)).toEqual({
      name: 'Testa Mandatora',
      email: 'roger.miret@in2.es',
      organization: 'IN2 INGENIERIA DE LA INFORMACION SOCIEDAD LIMITADA',
      organizationIdentifier: 'VATES-B60645900',
    });
  });

  it('should expose the mandatee fields as null when the machine mandatee carries none', () => {
    const fields = buildLearCredentialFallbackMainFields(machineCredential);

    // null, not '' — the template renders '-' for both, but null is what safeCompute yields.
    expect(evaluate(fields, 'mandatee', machineCredential)).toEqual({ name: null, email: null });
  });

  it('should compose the mandatee name from first and last name for an employee credential', () => {
    const fields = buildLearCredentialFallbackMainFields(employeeCredential);

    expect(evaluate(fields, 'mandatee', employeeCredential)).toEqual({
      name: 'mandatee-inn mandator-altia',
      email: 'roger.miret@in2.es',
    });
    expect(evaluate(fields, 'mandator', employeeCredential)).toEqual({
      name: 'test manda',
      email: 'roger.miret@altia.es',
      organization: 'IN2 INGENIERIA DE LA INFORMACION SOCIEDAD LIMITADA',
      organizationIdentifier: 'VATES-B60645900',
    });
  });

  it('should render powers through the existing details power component', () => {
    const fields = buildLearCredentialFallbackMainFields(employeeCredential);
    const powerGroup = group(fields, 'power');

    expect(powerGroup.custom?.component).toBe(DetailsPowerComponent);
    expect(powerGroup.custom?.token).toBe(detailsPowerToken);
    expect(powerGroup.custom?.value(employeeCredential)).toEqual(
      employeeCredential.credentialSubject.mandate.power
    );
  });

  it('should wrap a single power object into an array for the power component', () => {
    const power = { action: 'Execute', domain: 'DOME', function: 'Onboarding', type: 'domain' };
    const credential = { type: ['LEARCredentialMachine'], credentialSubject: { mandate: { power } } };

    const fields = buildLearCredentialFallbackMainFields(credential);

    expect(group(fields, 'power').custom?.value(credential)).toEqual([power]);
  });

  it('should omit the power group when the credential carries no powers', () => {
    const credential = { type: ['LEARCredentialEmployee'], credentialSubject: { mandate: { mandator: {} } } };

    const fields = buildLearCredentialFallbackMainFields(credential);

    expect(fields.map(field => field.key)).toEqual(['mandator', 'mandatee']);
  });

  it('should read a mandate flattened onto credentialSubject (SD-JWT)', () => {
    const credential = {
      vct: 'learcredential.employee.sd.1',
      credentialSubject: {
        mandator: { commonName: 'Flat Mandator', emailAddress: 'flat@in2.es', organization: 'IN2', organizationIdentifier: 'VATES-B60645900' },
        mandatee: { firstName: 'Flat', lastName: 'Mandatee', email: 'mandatee@in2.es' },
        power: [{ action: ['Execute'], domain: 'DOME', function: 'Onboarding', type: 'domain' }],
      },
    };

    const fields = buildLearCredentialFallbackMainFields(credential);

    expect(evaluate(fields, 'mandator', credential)).toEqual({
      name: 'Flat Mandator',
      // DOME v1 spells it `emailAddress`; both spellings feed the same field.
      email: 'flat@in2.es',
      organization: 'IN2',
      organizationIdentifier: 'VATES-B60645900',
    });
    expect(evaluate(fields, 'mandatee', credential)).toEqual({ name: 'Flat Mandatee', email: 'mandatee@in2.es' });
  });

  it('should read a mandate flattened onto the credential root (SD-JWT direct strategy)', () => {
    const credential = {
      vct: 'learcredential.machine.sd.1',
      mandator: { commonName: 'Root Mandator', email: 'root@in2.es' },
      mandatee: { domain: 'issuer.example.org' },
    };

    const fields = buildLearCredentialFallbackMainFields(credential);

    expect(evaluate(fields, 'mandator', credential)).toEqual({
      name: 'Root Mandator',
      email: 'root@in2.es',
      organization: null,
      organizationIdentifier: null,
    });
  });

  it('should always describe both parties, whatever the credential carries', () => {
    const fields = buildLearCredentialFallbackMainFields({ type: ['LEARCredentialMachine'] });

    expect(fields.map(field => field.key)).toEqual(['mandator', 'mandatee']);
    expect(evaluate(fields, 'mandator', {})).toEqual({
      name: null, email: null, organization: null, organizationIdentifier: null,
    });
  });

  it('should treat blank strings as absent so they render like a missing field', () => {
    const credential = { credentialSubject: { mandate: { mandator: { commonName: '   ', email: '' } } } };

    expect(evaluate(buildLearCredentialFallbackMainFields(credential), 'mandator', credential))
      .toEqual({ name: null, email: null, organization: null, organizationIdentifier: null });
  });
});
