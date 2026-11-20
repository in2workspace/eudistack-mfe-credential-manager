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
 * - 400 `type` ∈ {@link ISSUANCE_REJECTION_TYPES}: the type is not enabled in the tenant, or the
 *   organization named on behalf is not one of the tenant's (EUD-268).
 * - 503 `type` ∈ {@link RETRYABLE_DELIVERY_FAILURES} or 500 `type` ∈ {@link DELIVERY_FAILURES}: the
 *   delivery could not be completed and the Issuer withdrew the process (EUD-268). A 503 is worth
 *   retrying in a few seconds (`Retry-After`); a 500 is not.
 *
 * Wire contract: these codes mirror `LearIssuancePolicyException.Reason`, `GlobalErrorTypes` and
 * `DeliveryErrorCode` in eudistack-core-issuer. A code the Issuer adds or renames without updating
 * these lists degrades safely to the generic message, but nothing warns about it -- keep the lists
 * and the `credentialIssuance.create-error-dialog.*` i18n keys in sync.
 */
export const LEAR_ISSUANCE_POLICY_REASONS = [
  'operator_lacks_onboarding',
  'onboarding_delegation_requires_tenant_admin',
  'certification_delegation_requires_tenant_admin',
  'tenant_admin_delegation_requires_platform_admin',
  'foreign_domain_delegation_requires_platform_admin',
  'on_behalf_requires_tenant_admin',
  'certification_power_required',
  'platform_tenant_read_only',
  'authorization_rule_missing'
] as const;

export type LearIssuancePolicyReason = typeof LEAR_ISSUANCE_POLICY_REASONS[number];

/** 400 rejections of the request itself that the Operator can act on (EUD-268). */
export const ISSUANCE_REJECTION_TYPES = ['unsupported_credential_type', 'unknown_organization'] as const;

export type IssuanceRejectionType = typeof ISSUANCE_REJECTION_TYPES[number];

/** 503 + `Retry-After`: a dependency of the delivery was temporarily unavailable. */
export const RETRYABLE_DELIVERY_FAILURES = ['signing_failed', 'status_list_unavailable', 'wallet_delivery_timeout'] as const;

/** 500: the delivery failed and a retry would not fix it. */
export const DELIVERY_FAILURES = ['delivery_failed', 'persistence_failed'] as const;

export type IssuanceBusinessError =
  | { kind: 'policy'; reason: LearIssuancePolicyReason }
  | { kind: 'validation'; fields: IssuanceInvalidField[] }
  | { kind: 'rejection'; type: IssuanceRejectionType }
  | { kind: 'delivery'; retryable: boolean };

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

  if (status === 400 && isOneOf(ISSUANCE_REJECTION_TYPES, body.type)) {
    return { kind: 'rejection', type: body.type };
  }

  if (status === 503 && isOneOf(RETRYABLE_DELIVERY_FAILURES, body.type)) {
    return { kind: 'delivery', retryable: true };
  }

  if (status === 500 && isOneOf(DELIVERY_FAILURES, body.type)) {
    return { kind: 'delivery', retryable: false };
  }

  return null;
}

function isPolicyReason(value: unknown): value is LearIssuancePolicyReason {
  return isOneOf(LEAR_ISSUANCE_POLICY_REASONS, value);
}

function isOneOf<T extends string>(codes: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (codes as readonly string[]).includes(value);
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
 *
 * Keep in sync: the `VAT<country>-` rule is duplicated in the request factory. If one changes,
 * change the other, or the selector will compare against an id that is not the one sent.
 */
export function toMandatorOrganizationId(country: string | null | undefined, orgId: string | null | undefined): string | null {
  const id = (orgId ?? '').trim();
  if (!id) return null;
  if (/^VAT..-/.test(id)) return id;
  const c = (country ?? '').trim();
  return c ? `VAT${c}-${id}` : null;
}
