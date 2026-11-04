import { CredentialIssuanceViewModelField, IssuanceFormPowerSchema } from "src/app/core/models/entity/lear-credential-issuance";
import { emailValidatorEntries, nameValidatorEntries, orgIdValidatorEntries, orgNameValidatorEntries, serialNumberValidatorEntries } from "src/app/shared/validators/credential-issuance/validators-entries";

export const firstNameField: CredentialIssuanceViewModelField = { key: 'firstName', type: 'control', controlType: 'text', validators: [...nameValidatorEntries] };
export const lastNameField: CredentialIssuanceViewModelField = { key: 'lastName', type: 'control', controlType: 'text', validators: [...nameValidatorEntries] };
export const emailField: CredentialIssuanceViewModelField =  { key: 'email', type: 'control', controlType: 'text', validators: [...emailValidatorEntries] };
export const serialNumberField: CredentialIssuanceViewModelField = {
            key: 'serialNumber',
            type: 'control',
            controlType: 'text',
            validators: [
              ...serialNumberValidatorEntries
            ]
          };
export const organizationField: CredentialIssuanceViewModelField = {
            key: 'organization',
            type: 'control',
            controlType: 'text',
            validators: [
              ...orgNameValidatorEntries
            ]
          }
export const organizationIdentifierField: CredentialIssuanceViewModelField = {
              key: 'organizationIdentifier',
              type: 'control',
              controlType: 'text',
              validators: [ ...orgIdValidatorEntries ],
              hint: 'organizationIdentifier',
            }

/**
 * Powers the issuance form offers (EUD-253 FR-10). Anyone who can issue grants ProductOffering;
 * administering an organization and certifying (E3, E5) are granted by a tenant administrator, in any
 * tenant and for any organization, its own included -- not only on behalf of another one.
 */
export function issuablePowers(canGrantAdministrationPowers: boolean): IssuanceFormPowerSchema[] {
  const powers: IssuanceFormPowerSchema[] = [
    { "action": ["Create", "Update", "Delete"], "function": "ProductOffering", isAdminRequired: false }
  ];
  if (canGrantAdministrationPowers) {
    powers.push(
      { "action": ["Execute"], "function": "Onboarding", isAdminRequired: true },
      { "action": ["Upload", "Attest"], "function": "Certification", isAdminRequired: true }
    );
  }
  return powers;
}
