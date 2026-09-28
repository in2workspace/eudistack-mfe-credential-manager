import { CredentialProcedureBasicInfo } from "../dto/credential-procedures-response.dto";


export interface CredentialProcedureWithClass extends CredentialProcedureBasicInfo {
  statusClass: string;
}

export const STATUSES_WITH_DEFINED_CLASS = [
    'VALID',
    'DRAFT',
    'EXPIRED',
    'REVOKED',
    'WITHDRAWN',
    'ARCHIVED'
  ] as const;

export type DefinedStatusClass = typeof STATUSES_WITH_DEFINED_CLASS[number];

// This creates types 'X_Y' to 'status-x-y"; it used to create status classes from status
export type ToSlug<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Lowercase<Head>}-${ToSlug<Tail>}`
    : Lowercase<S>;

export type StatusClassFromDefined = `status-${ToSlug<DefinedStatusClass>}`;

export type StatusClass = StatusClassFromDefined | 'status-default';

const filters = ["subject", "status"] as const;
export type Filter = typeof filters[number];

export type FilterConfig = {
  filterName: Filter;
  translationLabel: string;
  placeholderTranslationLabel: string;
}

/**
 * Composite filter model for the credential list.
 * `subject` is evaluated as a substring match; `organizations`/`types`/`statuses`
 * are evaluated as OR-within-facet, AND-across-facets by the MatTableDataSource
 * filterPredicate. An empty string / empty array means "no filter applied" for
 * that facet.
 */
export interface CredentialFilter {
  subject: string;
  organizations: string[];
  types: string[];
  statuses: string[];
}

/** A single checkbox option offered by a `FilterDropdownComponent` instance. */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Material icon ligature shown per status in the table's Status column, with a
 * matTooltip carrying the translated label (US — credential-management dashboard
 * revamp). One icon per status: ISSUED is included for completeness even though it
 * is normally transient (see LifeCycleStatusService.getStatusIcon doc).
 */
export const STATUS_ICON_MAP: Record<string, string> = {
  DRAFT: 'edit',
  ISSUED: 'outbound',
  VALID: 'check_circle',
  EXPIRED: 'event_busy',
  REVOKED: 'block',
  WITHDRAWN: 'undo',
  ARCHIVED: 'archive',
};

export const DEFAULT_STATUS_ICON = 'help_outline';

/**
 * Statuses available as options in the status filter control.
 * Derived from STATUSES_WITH_DEFINED_CLASS, excluding ARCHIVED
 * (archived credentials are handled by a separate view — US-06/EUD-129).
 */
export const FILTERABLE_STATUSES = STATUSES_WITH_DEFINED_CLASS.filter(
  (s) => s !== 'ARCHIVED'
) as ReadonlyArray<Exclude<DefinedStatusClass, 'ARCHIVED'>>;