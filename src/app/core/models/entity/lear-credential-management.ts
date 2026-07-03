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
 * Both fields are evaluated in AND by the MatTableDataSource filterPredicate.
 * An empty string ('') means "no filter applied" for that field.
 */
export interface CredentialFilter {
  subject: string;
  status: string;
}

/**
 * Statuses available as options in the status filter control.
 * Derived from STATUSES_WITH_DEFINED_CLASS, excluding ARCHIVED
 * (archived credentials are handled by a separate view — US-06/EUD-129).
 */
export const FILTERABLE_STATUSES = STATUSES_WITH_DEFINED_CLASS.filter(
  (s) => s !== 'ARCHIVED'
) as ReadonlyArray<Exclude<DefinedStatusClass, 'ARCHIVED'>>;