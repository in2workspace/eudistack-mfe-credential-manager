import { getCredentialTypeFamilyKey, getCredentialTypeFamilyLabelKey } from './credential-type-family';

describe('credential type family', () => {
  it.each([
    ['learcredential.employee.w3c.1', 'EMPLOYEE'],
    ['learcredential.employee.sd.2', 'EMPLOYEE'],
    ['LEARCredentialEmployee', 'EMPLOYEE'],
    ['learcredential.machine.w3c.3', 'MACHINE'],
    ['gx.labelcredential.w3c.2', 'LABEL'],
    ['doctorid.sd.1', 'doctorid.sd.1'],
  ])('groups %s under %s', (credentialType, family) => {
    expect(getCredentialTypeFamilyKey(credentialType)).toBe(family);
  });

  it('names a family through its i18n key', () => {
    expect(getCredentialTypeFamilyLabelKey('learcredential.employee.sd.1')).toBe('credentialManagement.typeFamily.employee');
  });

  it('has no family label for a type outside the known families', () => {
    expect(getCredentialTypeFamilyLabelKey('doctorid.sd.1')).toBeUndefined();
  });
});
