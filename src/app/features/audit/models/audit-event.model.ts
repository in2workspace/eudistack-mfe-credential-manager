import { AUDIT_RESULTS } from '../constants/audit-catalogue.constants';

export type AuditResult = (typeof AUDIT_RESULTS)[number];

export interface AuditActor {
  kind: string;
  id: string;
  name?: string;
  email?: string;
  organization?: string;
}

/** The fields of an audit event the listing shows (`AuditEvent` of the audit API). */
export interface AuditEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  organization?: string;
  actor: AuditActor;
  /** `<kind>:<id>`. */
  resource: string;
  result: string;
  reason?: string;
}

export interface AuditEventsPage {
  events: AuditEvent[];
  next_cursor: string | null;
}

export interface AuditPeriod {
  from: Date;
  to: Date;
}
