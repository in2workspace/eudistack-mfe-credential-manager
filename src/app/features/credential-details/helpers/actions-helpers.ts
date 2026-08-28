import { CredentialStatus, CredentialStatusType, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';

// Credential status types that this issuer CANNOT revoke: legacy DOME PlainList
// credentials have no status list index, so the revoke endpoint fails. The revoke
// button must be hidden for them.
//
// Modelled as a denylist on purpose. It used to be an allowlist of
// ['BitstringStatusListEntry'], which silently hid the button for every dc+sd-jwt
// credential: those carry an IETF Token Status List (`status.status_list`), which
// LEARCredentialDataNormalizer maps to type 'TokenStatusListEntry', and the issuer
// revokes it through the very same status_list_index table. Any future status
// mechanism is revocable unless proven otherwise.
const credentialStatusCannotRevokeSet = new Set<CredentialStatusType>(['PlainListEntity']);

const statusHasSignCredentialButtonSet = new Set<LifeCycleStatus>(['PEND_SIGNATURE']);
const statusHasRevokeCredentialButtonSet = new Set<LifeCycleStatus>(['VALID']);
const statusHasWithdrawCredentialButtonSet = new Set<LifeCycleStatus>(['DRAFT']);
const statusHasArchiveCredentialButtonSet = new Set<LifeCycleStatus>(['WITHDRAWN', 'REVOKED', 'EXPIRED']);

export function statusHasSignCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasSignCredentialButtonSet.has(status);
}

export function statusHasRevokeCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasRevokeCredentialButtonSet.has(status);
}

export function credentialStatusHasRevokeCredentialButton(
  credentialStatus?: CredentialStatus,
): boolean {
  return credentialStatus?.type
    ? !credentialStatusCannotRevokeSet.has(credentialStatus.type)
    : false;
}


export function statusHasWithdrawCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasWithdrawCredentialButtonSet.has(status);
}

export function statusHasArchiveCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasArchiveCredentialButtonSet.has(status);
}
