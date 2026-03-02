import { CredentialType, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';

const credentialTypeHasSendReminderButtonSet = new Set<CredentialType>(['LEARCredentialEmployee', 'LEARCredentialMachine', 'gx:LabelCredential']);
const credentialTypeHasSignCredentialButtonSet = new Set<CredentialType>(['LEARCredentialEmployee', 'LEARCredentialMachine', 'gx:LabelCredential']);
const credentialTypeHasRevokeCredentialButtonSet = new Set<CredentialType>(['LEARCredentialEmployee', 'LEARCredentialMachine', 'gx:LabelCredential']);

const statusHasSendReminderButtonSet = new Set<LifeCycleStatus>(['WITHDRAWN', 'DRAFT', 'PEND_DOWNLOAD']);
const statusHasSignCredentialButtonSet = new Set<LifeCycleStatus>(['PEND_SIGNATURE']);
const statusHasRevokeCredentialButtonSet = new Set<LifeCycleStatus>(['VALID']);

export function credentialTypeHasSendReminderButton(type: CredentialType): boolean {
    return credentialTypeHasSendReminderButtonSet.has(type);
}

export function credentialTypeHasSignCredentialButton(type: CredentialType): boolean {
    return credentialTypeHasSignCredentialButtonSet.has(type);
}

export function credentialTypeHasRevokeCredentialButton(type: CredentialType): boolean {
    return credentialTypeHasRevokeCredentialButtonSet.has(type);
}

export function statusHasSendReminderlButton(status: LifeCycleStatus): boolean {
    return statusHasSendReminderButtonSet.has(status);
}

export function statusHasSignCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasSignCredentialButtonSet.has(status);
}

export function statusHasRevokeCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasRevokeCredentialButtonSet.has(status);
}
