/**
 * I-03: turns a failed `POST /api/v1/issuances` into the business explanation the Operator can
 * act on, when -- and only when -- the Issuer answered with one of the shapes below.
 *
 * ES-02 still holds for everything else: the raw `detail` is never surfaced (it may name the
 * tenant or its configuration), and any other status, type or reason falls back to the generic
 * message. Only stable, machine-readable members of the body are read:
 * - 403 `insufficient_permission` + `reason` ∈ {@link LEAR_ISSUANCE_POLICY_REASONS}: which LEAR
 *   issuance rule rejected the request.
 * - 400 `payload_validation_error` + `violations[].field`: which form fields the schema rejected.
 */
export const LEAR_ISSUANCE_POLICY_REASONS = [
  'operator_lacks_onboarding',
  'onboarding_delegation_requires_tenant_admin',
  'onboarding_delegation_requires_multi_org',
  'onboarding_delegation_same_org',
  'certification_delegation_requires_tenant_admin',
  'certification_delegation_requires_multi_org',
  'mandator_organization_missing',
  'on_behalf_requires_tenant_admin',
  'on_behalf_requires_multi_org'
] as const;

export type LearIssuancePolicyReason = typeof LEAR_ISSUANCE_POLICY_REASONS[number];

export type IssuanceBusinessError =
  | { kind: 'policy'; reason: LearIssuancePolicyReason }
  | { kind: 'validation'; fields: IssuanceInvalidField[] };

/** A rejected field, as translation keys: `group` is the payload section, `field` its key. */
export interface IssuanceInvalidField {
  group: string | null;
  field: string;
}

const INSUFFICIENT_PERMISSION = 'insufficient_permission';
const PAYLOAD_VALIDATION = 'payload_validation_error';

export function resolveIssuanceBusinessError(error: unknown): IssuanceBusinessError | null {
  const status = (error as { status?: unknown } | null)?.status;
  const body = (error as { error?: unknown } | null)?.error as
    { type?: unknown; reason?: unknown; violations?: unknown } | null | undefined;
  if (!body || typeof body !== 'object') return null;

  if (status === 403 && body.type === INSUFFICIENT_PERMISSION && isPolicyReason(body.reason)) {
    return { kind: 'policy', reason: body.reason };
  }

  if (status === 400 && body.type === PAYLOAD_VALIDATION && Array.isArray(body.violations)) {
    const fields = uniqueFields(body.violations
      .map(v => toInvalidField((v as { field?: unknown } | null)?.field))
      .filter((f): f is IssuanceInvalidField => f !== null));
    return fields.length > 0 ? { kind: 'validation', fields } : null;
  }

  return null;
}

function isPolicyReason(value: unknown): value is LearIssuancePolicyReason {
  return typeof value === 'string' && (LEAR_ISSUANCE_POLICY_REASONS as readonly string[]).includes(value);
}

/**
 * JSON-pointer-ish instance location from the schema validator (`$.mandatee.email`,
 * `$.power[0].action`) -> the form's own group/field keys. Array indexes are dropped: the form
 * labels a field, not an occurrence.
 */
function toInvalidField(location: unknown): IssuanceInvalidField | null {
  if (typeof location !== 'string') return null;
  const segments = location
    .replace(/^\$\.?/, '')
    .replace(/\[\d+\]/g, '')
    .split(/[./]/)
    .filter(Boolean);
  const field = segments.at(-1);
  if (!field) return null;
  return { group: segments.length > 1 ? segments[0] : null, field };
}

function uniqueFields(fields: IssuanceInvalidField[]): IssuanceInvalidField[] {
  const seen = new Set<string>();
  return fields.filter(f => {
    const key = `${f.group ?? ''}.${f.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The organizationIdentifier the request factory will send for this mandator form value (same
 * rule as `IssuanceRequestFactoryService.createOrganizationId`), so the power selector can compare
 * it with the operator's own organization before submitting.
 */
export function toMandatorOrganizationId(country: string | null | undefined, orgId: string | null | undefined): string | null {
  const id = (orgId ?? '').trim();
  if (!id) return null;
  if (/^VAT..-/.test(id)) return id;
  const c = (country ?? '').trim();
  return c ? `VAT${c}-${id}` : null;
}
