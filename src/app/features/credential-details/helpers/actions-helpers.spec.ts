import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { statusHasSignCredentialButton, statusHasRevokeCredentialButton, statusHasWithdrawCredentialButton } from './actions-helpers';

describe('Credential Helpers', () => {
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

  describe('statusHasRevokeCredentialButton', () => {
    it('returns true for VALID', () => {
      expect(statusHasRevokeCredentialButton('VALID')).toBeTruthy();
    });

    it('returns false for DRAFT', () => {
      expect(statusHasRevokeCredentialButton('DRAFT')).toBeFalsy();
    });
  });

  describe('statusHasWithdrawCredentialButton', () => {
    it('returns true for DRAFT', () => {
      expect(statusHasWithdrawCredentialButton('DRAFT')).toBeTruthy();
    });

    it('returns false for VALID', () => {
      expect(statusHasWithdrawCredentialButton('VALID')).toBeFalsy();
    });
  });
});
