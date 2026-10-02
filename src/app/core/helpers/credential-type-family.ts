const TYPE_FAMILY_LABEL_KEYS: Record<string, string> = {
  EMPLOYEE: 'credentialManagement.typeFamily.employee',
  MACHINE: 'credentialManagement.typeFamily.machine',
  LABEL: 'credentialManagement.typeFamily.label',
};

/**
 * Groups every version and format — legacy or current — of the employee/machine/label
 * credential types under one bucket ("learcredential.employee.w3c.4", "LEARCredentialEmployee"
 * and "learcredential.employee.sd.1" are all EMPLOYEE). Any other type is its own bucket.
 */
export function getCredentialTypeFamilyKey(credentialType: string): string {
  if (/employee/i.test(credentialType)) return 'EMPLOYEE';
  if (/machine/i.test(credentialType)) return 'MACHINE';
  if (/label/i.test(credentialType)) return 'LABEL';
  return credentialType;
}

/** The i18n key naming the type's family, or `undefined` when it belongs to none. */
export function getCredentialTypeFamilyLabelKey(credentialType: string): string | undefined {
  return TYPE_FAMILY_LABEL_KEYS[getCredentialTypeFamilyKey(credentialType)];
}
