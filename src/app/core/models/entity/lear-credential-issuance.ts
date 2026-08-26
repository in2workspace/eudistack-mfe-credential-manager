import { ValidatorEntryUnion } from "src/app/shared/validators/credential-issuance/all-validators";
import { TmfAction, TmfFunction } from "./lear-credential";
import { ComponentType } from "@angular/cdk/portal";
import { BaseIssuanceCustomFormChild } from "src/app/features/credential-details/components/base-issuance-custom-form-child";
import { ClaimDefinitionDto } from "../dto/credential-issuer-metadata.dto";
export const ISSUANCE_CREDENTIAL_TYPES_ARRAY = ['learcredential.employee', 'learcredential.machine'] as const;
export type IssuanceCredentialType = typeof ISSUANCE_CREDENTIAL_TYPES_ARRAY[number];

export type CredentialFormat = 'jwt_vc_json' | 'dc+sd-jwt' | 'mso_mdoc';

export interface CredentialFormatOption {
  configId: string;
  format: CredentialFormat;
  labelKey: string;
  disabled?: boolean;
}

export const FORMAT_LABEL_MAP: Partial<Record<CredentialFormat, string>> = {
  'jwt_vc_json': 'credentialIssuance.format.w3cVcDm',
  'dc+sd-jwt':   'credentialIssuance.format.sdJwt',
  'mso_mdoc':    'credentialIssuance.format.mdoc',
};

export type GrantType = 'authorization_code' | 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface GrantTypeOption {
  value: GrantType;
  labelKey: string;
}

export const GRANT_TYPE_OPTIONS: GrantTypeOption[] = [
  { value: 'authorization_code', labelKey: 'credentialIssuance.grantType.authorizationCode' },
  { value: 'urn:ietf:params:oauth:grant-type:pre-authorized_code', labelKey: 'credentialIssuance.grantType.preAuthorizedCode' },
];

export type DeliveryMode = 'email' | 'ui' | 'direct';

/**
 * Wire form of the request's `delivery` field: a CSV of `DeliveryMode` (e.g. `direct,email`).
 *
 * Branded so the only way to obtain one is `toDeliveryCsv()`.
 */
export type DeliveryCsv = string & { readonly __brand: 'DeliveryCsv' };

export function toDeliveryCsv(modes: Iterable<DeliveryMode>): DeliveryCsv {
  return [...new Set(modes)].join(',') as DeliveryCsv;
}
export interface DeliveryOption {
  value: DeliveryMode;
  labelKey: string;
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { value: 'email', labelKey: 'credentialIssuance.delivery.email' },
  { value: 'ui', labelKey: 'credentialIssuance.delivery.qrCode' },
  { value: 'direct', labelKey: 'credentialIssuance.delivery.direct' },
];

/**
 * Order the result dialog renders one box per selected mode in: what the Operator has to act on
 * first comes first.
 */
export const DELIVERY_RESULT_ORDER: readonly DeliveryMode[] = ['direct', 'ui', 'email'];

export const MDOC_DISABLED_OPTION: CredentialFormatOption = {
  configId: 'mso_mdoc',
  format: 'mso_mdoc',
  labelKey: 'credentialIssuance.format.mdoc',
  disabled: true,
};

export interface BaseCredentialIssuanceViewModelField {
    key: string, //this is used for form models fields names (FormGroup, FormControl) and also as label for transations; i.e. "mandatee" key is used in "credentialIssuance.mandatee"
    label?: string; // already-resolved label (AC-02: comes from credential_metadata.claims[].display).
                    // When present, it wins over the i18n key derived from "key".
    classes?: string; //admits a string of separated classes to customize form styles; i.e.: "classOne classTwo"
    staticValueGetter?: () => IssuanceStaticViewModel | null; // in case the value must be filled programatically (currently this happens when a field it is 'display: side' or 'pref_side' + onBehalf)
    custom?: { // the Issuance component has some default form templates (text/number input, selector); this field allows for using custom components (i.e. Powers)
      component: ComponentType<BaseIssuanceCustomFormChild<any>>,
      data?: any
    }
}

export interface CredentialIssuanceViewModelControlField extends BaseCredentialIssuanceViewModelField {
    type: 'control'; // for FormControl or custom components with one FormControl
    controlType: 'text' | 'number' | 'selector' | 'date',
    multiOptions?: SelectorOption[], //only for 'selector' controlType (and similars if added in the future: 'radio' and 'checkbox')
    validators: ValidatorEntryUnion[];
    hint?: string; //hint that is shown above the control
}

export interface CredentialIssuanceViewModelGroupField extends BaseCredentialIssuanceViewModelField {
    type: 'group'; // for FormGroup or custom components which include multiple controls
    display?: 'main' | 'side' | 'pref_side'; // this specifies whether the group should be displayed in the main space or as a side card. 'pref_side' for sections that are only displayed in main when not "onBehalf" mode
    groupFields: CredentialIssuanceViewModelField[];
}

// the id is needed to allow the "track function" in @for loops
export interface CredentialIssuanceViewModelGroupFieldWithId extends CredentialIssuanceViewModelGroupField{
  id: number;
}

export type CredentialIssuanceViewModelField = CredentialIssuanceViewModelGroupField | CredentialIssuanceViewModelControlField;

export interface CredentialIssuanceSchemaProvider<T extends IssuanceCredentialType> {
  // claims: definition of the selected config (AD-2). Providers that don't derive
  // fields from the definition can implement getSchema(onBehalf) and ignore it.
  getSchema(onBehalf?: boolean, claims?: readonly ClaimDefinitionDto[]): CredentialIssuanceTypedViewModelSchema<T>;
}

export type CredentialIssuanceTypedViewModelSchema<T extends IssuanceCredentialType> = {
  type: T,
  schema: CredentialIssuanceViewModelSchema
};

export type SelectorOption  = { label: string, value: string};

export type CredentialIssuanceViewModelSchema = CredentialIssuanceViewModelGroupField[];
export type CredentialIssuanceViewModelSchemaWithId = CredentialIssuanceViewModelGroupFieldWithId[];


export type IssuanceStaticViewModel = {
    mandator?: { key: string, value: string }[];
}

export type IssuanceViewModelsTuple = [CredentialIssuanceViewModelSchemaWithId, IssuanceStaticViewModel];

// Data collected in Issuance component (form) and sent to request factory
export interface IssuanceRawCredentialPayload {
  formData: Record<string, any>,
  staticData: IssuanceStaticViewModel | null,
  onBehalf: boolean
}

// Power component types
export type IssuanceRawPowerForm = Partial<Record<TmfFunction, Record<TmfAction, boolean>>>;

export interface IssuanceFormPowerSchema{
  //todo: in the future, if there are multiple domains, add a "domain" field
  function: string,
  action: string[],
  isAdminRequired: boolean
}

// Key component and service types
/** Public half of a holder key, in the shape the request's `holder_key.jwk` expects. */
export interface HolderPublicJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}


export interface HolderKeyMaterial {
  privateKeyHex: string;
  didKey: string;
  publicJwk: HolderPublicJwk;
}
