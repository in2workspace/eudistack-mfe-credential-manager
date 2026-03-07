import { CredentialType, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';

const credentialTypeHasSignCredentialButtonSet = new Set<CredentialType>([
  'learcredential.employee.w3c.4', 'learcredential.employee.sd.1',
  'learcredential.machine.w3c.3', 'learcredential.machine.sd.1',
  'gx.labelcredential.w3c.1',
]);
const credentialTypeHasRevokeCredentialButtonSet = new Set<CredentialType>([
  'learcredential.employee.w3c.4', 'learcredential.employee.sd.1',
  'learcredential.machine.w3c.3', 'learcredential.machine.sd.1',
  'gx.labelcredential.w3c.1',
]);

const statusHasSignCredentialButtonSet = new Set<LifeCycleStatus>(['PEND_SIGNATURE']);
const statusHasRevokeCredentialButtonSet = new Set<LifeCycleStatus>(['VALID']);

export function credentialTypeHasSignCredentialButton(type: CredentialType): boolean {
    return credentialTypeHasSignCredentialButtonSet.has(type);
}

export function credentialTypeHasRevokeCredentialButton(type: CredentialType): boolean {
    return credentialTypeHasRevokeCredentialButtonSet.has(type);
}

export function statusHasSignCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasSignCredentialButtonSet.has(status);
}

export function statusHasRevokeCredentialButton(status: LifeCycleStatus): boolean {
    return statusHasRevokeCredentialButtonSet.has(status);
}
