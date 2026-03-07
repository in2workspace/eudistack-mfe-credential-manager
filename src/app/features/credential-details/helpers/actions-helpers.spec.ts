import { CredentialType, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { credentialTypeHasSignCredentialButton, statusHasSignCredentialButton } from './actions-helpers';

describe('Credential Helpers', () => {
  describe('credentialTypeHasSignCredentialButton', () => {
    const allowed: CredentialType[] = ['learcredential.employee.w3c.4', 'gx.labelcredential.w3c.1'];
    const disallowed: any = 'AnotherType';

    it.each(allowed)('returns true for allowed type %s', (type) => {
      expect(credentialTypeHasSignCredentialButton(type)).toBeTruthy();
    });

    it('returns false for a disallowed type', () => {
      expect(credentialTypeHasSignCredentialButton(disallowed)).toBeFalsy();
    });
  });

  describe('statusHasSignCredentialButton', () => {
    const allowed: LifeCycleStatus[] = ['PEND_SIGNATURE'];
    const disallowed: any = 'DRAFT';

    it.each(allowed)('returns true for allowed status %s', (status) => {
      expect(statusHasSignCredentialButton(status)).toBeTruthy();
    });

    it('returns false for a disallowed status', () => {
      expect(statusHasSignCredentialButton(disallowed)).toBeFalsy();
    });
  });
});
