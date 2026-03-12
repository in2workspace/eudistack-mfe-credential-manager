import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';

const statusHasSignCredentialButtonSet = new Set<LifeCycleStatus>(['PEND_SIGNATURE']);
const statusHasRevokeCredentialButtonSet = new Set<LifeCycleStatus>(['VALID']);
const statusHasWithdrawCredentialButtonSet = new Set<LifeCycleStatus>(['DRAFT']);

export function statusHasSignCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasSignCredentialButtonSet.has(status);
}

export function statusHasRevokeCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasRevokeCredentialButtonSet.has(status);
}

export function statusHasWithdrawCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasWithdrawCredentialButtonSet.has(status);
}
