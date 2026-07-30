import {
  CredentialStatus,
  CredentialStatusType,
  LifeCycleStatus,
} from 'src/app/core/models/entity/lear-credential';
import {
  credentialStatusHasRevokeCredentialButton,
  statusHasArchiveCredentialButton,
  statusHasRevokeCredentialButton,
  statusHasSignCredentialButton,
  statusHasWithdrawCredentialButton,
} from './actions-helpers';

describe('Credential Helpers', () => {
  describe('statusHasSignCredentialButton', () => {
    const allowed: LifeCycleStatus[] = ['PEND_SIGNATURE'];
    const disallowed: LifeCycleStatus = 'DRAFT';

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

  describe('credentialStatusHasRevokeCredentialButton', () => {
    function createCredentialStatus(type: CredentialStatusType): CredentialStatus {
      return { type } as CredentialStatus;
    }

    it('returns true for BitstringStatusListEntry', () => {
      const credentialStatus = createCredentialStatus(
        'BitstringStatusListEntry',
      );

      expect(
        credentialStatusHasRevokeCredentialButton(credentialStatus),
      ).toBeTruthy();
    });

    it('returns false for PlainListEntity', () => {
      const credentialStatus = createCredentialStatus('PlainListEntity');

      expect(
        credentialStatusHasRevokeCredentialButton(credentialStatus),
      ).toBeFalsy();
    });

    it('returns false when credential status is undefined', () => {
      expect(
        credentialStatusHasRevokeCredentialButton(undefined),
      ).toBeFalsy();
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

  describe('statusHasArchiveCredentialButton', () => {
    const terminalStatuses: LifeCycleStatus[] = [
      'WITHDRAWN',
      'REVOKED',
      'EXPIRED',
    ];
    const nonTerminalStatuses: LifeCycleStatus[] = [
      'DRAFT',
      'PEND_SIGNATURE',
      'VALID',
      'PEND_DOWNLOAD',
      'ISSUED',
    ];

    it.each(terminalStatuses)(
      'returns true for terminal status %s',
      (status) => {
        expect(statusHasArchiveCredentialButton(status)).toBeTruthy();
      },
    );

    it.each(nonTerminalStatuses)(
      'returns false for non-terminal status %s',
      (status) => {
        expect(statusHasArchiveCredentialButton(status)).toBeFalsy();
      },
    );
  });
});