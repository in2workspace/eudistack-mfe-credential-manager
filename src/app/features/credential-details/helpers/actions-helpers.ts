import { CredentialStatus, CredentialStatusType, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';

// Credential status types that this issuer cannot revoke (legacy DOME PlainList
// credentials have no bitstring index, so the revoke endpoint fails). The revoke
// button must be hidden for them.
const credentialStatusHasRevokeCredentialButtonSet = new Set<CredentialStatusType>(['BitstringStatusListEntry']);

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
  return credentialStatus
    ? credentialStatusHasRevokeCredentialButtonSet.has(credentialStatus.type)
    : false;
}


export function statusHasWithdrawCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasWithdrawCredentialButtonSet.has(status);
}

export function statusHasArchiveCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasArchiveCredentialButtonSet.has(status);
}
