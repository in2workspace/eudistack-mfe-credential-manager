import { inject, Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "src/app/core/services/auth.service";
import { CountryService } from "src/app/shared/services/country.service";
import { ClaimDefinitionDto } from "src/app/core/models/dto/credential-issuer-metadata.dto";
import { CredentialIssuanceTypedViewModelSchema, CredentialIssuanceSchemaProvider, CredentialIssuanceViewModelField } from "src/app/core/models/entity/lear-credential-issuance";
import { convertToOrderedArray, employeeMandatorFieldsOrder } from "../../helpers/fields-order-helpers";
import { claimKey, mapClaimsToFields } from "../../helpers/claims-to-schema.mapper";
import { emailField, firstNameField, lastNameField, organizationField, organizationIdentifierField, serialNumberField } from "./common-issuance-schema-fields";
import { IssuancePowerComponent } from "../../components/power/issuance-power.component";
import { baseNameLengthValidatorEntries } from "src/app/shared/validators/credential-issuance/validators-entries";
import { PROVISIONAL_FIELD_VALIDATION_RULE_RESOLVER } from "src/app/shared/validators/credential-issuance/field-validation-rule.resolver";

@Injectable({ providedIn: 'root' })
export class LearCredentialEmployeeSchemaProvider implements CredentialIssuanceSchemaProvider<'learcredential.employee'> {

  /**
   * AD-2 BRIDGE (option C) — DEPENDS ON EUD-58 (risk R-1).
   * Provisional `mandatee` field set: used (a) when the credential definition declares no
   * capturable claims (EC-02) and (b) as a validator override for the keys the frontend
   * already knows how to validate, so deriving from the metadata never degrades the
   * current validation.
   * Once EUD-58 publishes the definitive schema, just delete these two constants: the
   * rest of the rendering is already driven by the definition.
   */
  private static readonly PROVISIONAL_MANDATEE_FIELDS: Readonly<Record<string, CredentialIssuanceViewModelField>> = {
    firstName: firstNameField,
    lastName: lastNameField,
    email: emailField,
    employeeId: { key: 'employeeId', type: 'control', controlType: 'text', validators: [...baseNameLengthValidatorEntries] }
  };

  private static readonly MANDATEE_PATH_SEGMENT = 'mandatee';

  private readonly authService = inject(AuthService);
  private readonly countriesService = inject(CountryService);
  private readonly translate = inject(TranslateService);

  public getSchema(onBehalf: boolean = false, claims?: readonly ClaimDefinitionDto[]): CredentialIssuanceTypedViewModelSchema<'learcredential.employee'> {

    const countriesSelectorOptions = this.countriesService.getCountriesAsSelectorOptions();
    const isSysAdmin = this.authService.isSysAdmin();

    const powersData: any[] = [
      {
        "action": ["Create", "Update", "Delete"],
        "function": "ProductOffering",
        isAdminRequired: false
      }
    ];

    if (isSysAdmin || onBehalf) {
      powersData.push({
        "action": ["Execute"],
        "function": "Onboarding",
        isAdminRequired: true
      });
      powersData.push({
        "action": ["Upload", "Attest"],
        "function": "Certification",
        isAdminRequired: true
      });
    }

    return {
      type: 'learcredential.employee',
      schema: [

        // MANDATEE — AD-2: derived from credential_metadata.claims of the selected config.
        {
          key: 'mandatee',
          classes: 'mandatee',
          type: 'group',
          display: 'main',
          groupFields: this.buildMandateeFields(claims),
        },
        // MANDATOR — out of scope for AD-2: static side data (staticValueGetter + AuthService).
        {
          key: 'mandator',
          type: 'group',
          display: 'pref_side',
          staticValueGetter: () => {
            const mandator = this.authService.extractRawMandator();
            return mandator ? { mandator: convertToOrderedArray(mandator, employeeMandatorFieldsOrder) } : null;
          },
          groupFields: [
            {
              ...firstNameField
            },
            {
              ...lastNameField
            },
            { ...emailField

            },
            {
              ...serialNumberField
            },
            {
              ...organizationField
            },
            {
              ...organizationIdentifierField
            },
            {
              key: 'country',
              type: 'control',
              controlType: 'selector',
              multiOptions: countriesSelectorOptions,
              validators: [{ name: 'required' }]
            }
          ]
        },
      //  POWER — out of scope for AD-2: custom component (powers/PDP).
      {
        key: 'power',
        type: 'group',
        groupFields: [],
        custom: {
          component: IssuancePowerComponent,
          data: powersData
        }
      }]};
  }

  /**
   * AC-07 — required fields. ClaimDefinitionDto does NOT expose a required flag (nor does
   * the backend's ClaimDefinition record), so the requiredness of the derived keys comes
   * from the EUD-73 generic resolver (AC-06) until EUD-58 folds it into the metadata.
   * `employeeId` is NOT in the resolver's provisional set and stays optional.
   */
  private static resolveRequiredKeys(claims: readonly ClaimDefinitionDto[]): string[] {
    return claims
      .map(claim => claimKey(claim))
      .filter(key => PROVISIONAL_FIELD_VALIDATION_RULE_RESOLVER.resolve({ key }).required);
  }

  /**
   * AC-02: fields derived from the definition.
   * EC-02: if the definition declares no capturable `mandatee` claims, falls back to the
   * provisional field set. An empty group is never returned (that would leave a blank form).
   */
  private buildMandateeFields(claims?: readonly ClaimDefinitionDto[]): CredentialIssuanceViewModelField[] {
    const derivedFields = mapClaimsToFields(claims, {
      locale: this.translate.currentLang,
      pathSegment: LearCredentialEmployeeSchemaProvider.MANDATEE_PATH_SEGMENT,
      requiredKeys: LearCredentialEmployeeSchemaProvider.resolveRequiredKeys(claims ?? []),
      fieldOverrides: LearCredentialEmployeeSchemaProvider.PROVISIONAL_MANDATEE_FIELDS
    });

    if (derivedFields.length > 0) return derivedFields;

    return Object.values(LearCredentialEmployeeSchemaProvider.PROVISIONAL_MANDATEE_FIELDS)
      .map(field => ({ ...field }));
  }
}
