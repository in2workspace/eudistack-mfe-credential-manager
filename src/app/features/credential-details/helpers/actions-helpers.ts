import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';

const statusHasRevokeCredentialButtonSet = new Set<LifeCycleStatus>(['VALID']);
const statusHasWithdrawCredentialButtonSet = new Set<LifeCycleStatus>(['DRAFT']);
const statusHasArchiveCredentialButtonSet = new Set<LifeCycleStatus>(['WITHDRAWN', 'REVOKED', 'EXPIRED']);

export function statusHasRevokeCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasRevokeCredentialButtonSet.has(status);
}

export function statusHasWithdrawCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasWithdrawCredentialButtonSet.has(status);
}

export function statusHasArchiveCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasArchiveCredentialButtonSet.has(status);
}
