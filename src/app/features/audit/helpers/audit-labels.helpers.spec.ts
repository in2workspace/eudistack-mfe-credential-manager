import { AUDIT_EVENT_TYPES, AUDIT_REASONS, AUDIT_RESULTS } from '../constants/audit-catalogue.constants';
import { actorKindKey, actorLabel, eventTypeKey, reasonKey, resourceLabel, resultKey } from './audit-labels.helpers';

describe('audit label helpers', () => {

  describe('catalogue codes', () => {
    it.each(AUDIT_EVENT_TYPES)('keys the event type %s under audit.eventType', type => {
      expect(eventTypeKey(type)).toBe(`audit.eventType.${type}`);
    });

    it.each(AUDIT_RESULTS)('keys the result %s under audit.result', result => {
      expect(resultKey(result)).toBe(`audit.result.${result}`);
    });

    it.each(AUDIT_REASONS)('keys the reason %s under audit.reason', reason => {
      expect(reasonKey(reason)).toBe(`audit.reason.${reason}`);
    });

    // FR-07: the catalogue code is never what the auditor reads, not even for one of a newer catalogue.
    it('falls back to a generic key for a code the portal does not know', () => {
      expect(eventTypeKey('TeleportationRequested')).toBe('audit.eventType.unknown');
      expect(resultKey('Maybe')).toBe('audit.result.unknown');
      expect(reasonKey('SolarFlare')).toBe('audit.reason.unknown');
    });
  });

  describe('actor', () => {
    it('shows the name of a person, or the identifier of a system', () => {
      expect(actorLabel({ kind: 'Person', id: 'u-1', name: 'Ana Pérez' })).toBe('Ana Pérez');
      expect(actorLabel({ kind: 'System', id: 'issuer-client' })).toBe('issuer-client');
      expect(actorLabel({ kind: 'Person', id: 'u-2', name: '' })).toBe('u-2');
    });

    it('translates the kinds it knows and leaves out the others', () => {
      expect(actorKindKey('Person')).toBe('audit.actorKind.Person');
      expect(actorKindKey('System')).toBe('audit.actorKind.System');
      expect(actorKindKey('Holder')).toBe('audit.actorKind.Holder');
      expect(actorKindKey('Robot')).toBeNull();
    });
  });

  describe('resourceLabel', () => {
    it('splits <kind>:<id> and keys a kind it knows', () => {
      expect(resourceLabel('issuance:0b6f1d2e-aaaa')).toEqual(
        { kind: 'issuance', kindKey: 'audit.resourceKind.issuance', id: '0b6f1d2e-aaaa' });
    });

    it('keeps colons inside the identifier', () => {
      expect(resourceLabel('attestation:did:key:z6Mk')).toEqual(
        { kind: 'attestation', kindKey: 'audit.resourceKind.attestation', id: 'did:key:z6Mk' });
    });

    it('has no key for a kind it does not know, and shows it as it came', () => {
      expect(resourceLabel('oidc-client:vc-auth-client-x')).toEqual(
        { kind: 'oidc-client', kindKey: null, id: 'vc-auth-client-x' });
    });

    it('treats a resource without a kind as an identifier', () => {
      expect(resourceLabel('0b6f1d2e')).toEqual({ kind: '', kindKey: null, id: '0b6f1d2e' });
    });
  });
});
