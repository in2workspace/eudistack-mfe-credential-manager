import { ValidatorEntryUnion } from "./all-validators";

export const baseNameLengthValidatorEntries: ValidatorEntryUnion[] = [
    { name: 'minLength', args: [2] },
    { name: 'maxLength', args: [50] }
];

const baseNameValidatorEntries: ValidatorEntryUnion[] = [
    ...baseNameLengthValidatorEntries,
    { name: 'required' }
];

export const nameValidatorEntries: ValidatorEntryUnion[] = [
    ...baseNameValidatorEntries,
    { name: 'unicode' }
];

export const orgNameValidatorEntries: ValidatorEntryUnion[] = [
  ...baseNameValidatorEntries,
  { name:'orgName' }
]

export const emailValidatorEntries: ValidatorEntryUnion[] = [
    { name: 'required' },
    { name: 'customEmail' }
];

export const orgIdValidatorEntries: ValidatorEntryUnion[] = [
  { name: 'required' },
  { name:'minLength', args:[7] },
  { name:'maxLength', args:[15] },
  { name:'orgIdentifier'}
];

/**
 * OPTIONAL field: the mandator's certificate serial number is not always available
 * (`AuthService.extractRawMandator()` falls back to `''` when the token carries no
 * `serial_number`), and it is not needed to identify the mandator — the DID is built
 * from country + organizationIdentifier. Requiring it blocked the whole issuance form.
 * The shape rules stay: Angular's minLength/maxLength/pattern all pass on an empty
 * value, so they only apply once something is typed.
 */
export const serialNumberValidatorEntries: ValidatorEntryUnion[] = [
  { name: 'minLength', args: [7] },
  { name: 'maxLength', args: [15] },
  { name: 'pattern', args: ["^[a-zA-Z0-9-]+$"] }
]