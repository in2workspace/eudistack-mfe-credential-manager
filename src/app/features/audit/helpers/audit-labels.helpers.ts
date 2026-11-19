import { AUDIT_EVENT_TYPES, AUDIT_REASONS, AUDIT_RESULTS } from '../constants/audit-catalogue.constants';
import { AuditActor } from '../models/audit-event.model';

const EVENT_TYPES = new Set<string>(AUDIT_EVENT_TYPES);
const RESULTS = new Set<string>(AUDIT_RESULTS);
const REASONS = new Set<string>(AUDIT_REASONS);
const ACTOR_KINDS = new Set(['Person', 'System', 'Holder']);
const RESOURCE_KINDS = new Set([
  'issuance', 'issuance-list', 'attestation', 'status-list', 'status-list-entry', 'catalog-entry',
  'tenant', 'system', 'system-client', 'external-system', 'audit-event', 'audit-archive',
]);

/**
 * i18n keys of the catalogue codes. A code the portal does not know (a type of a newer catalogue) gets the
 * generic key, so the section never shows a catalogue code.
 */
export const eventTypeKey = (type: string): string =>
  EVENT_TYPES.has(type) ? `audit.eventType.${type}` : 'audit.eventType.unknown';

export const resultKey = (result: string): string =>
  RESULTS.has(result) ? `audit.result.${result}` : 'audit.result.unknown';

export const reasonKey = (reason: string): string =>
  REASONS.has(reason) ? `audit.reason.${reason}` : 'audit.reason.unknown';

export const actorKindKey = (kind: string): string | null =>
  ACTOR_KINDS.has(kind) ? `audit.actorKind.${kind}` : null;

export const actorLabel = (actor: AuditActor): string => actor.name || actor.id;

/** `<kind>:<id>` split, with the i18n key of the kind when the portal knows it. */
export function resourceLabel(resource: string): { kind: string; kindKey: string | null; id: string } {
  const separator = resource.indexOf(':');
  const kind = separator < 0 ? '' : resource.slice(0, separator);
  const id = separator < 0 ? resource : resource.slice(separator + 1);
  return { kind, kindKey: RESOURCE_KINDS.has(kind) ? `audit.resourceKind.${kind}` : null, id };
}
