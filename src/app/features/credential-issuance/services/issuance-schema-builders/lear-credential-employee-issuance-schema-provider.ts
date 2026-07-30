import { inject, Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "src/app/core/services/auth.service";
import { CountryService } from "src/app/shared/services/country.service";
import { ClaimDefinitionDto } from "src/app/core/models/dto/credential-issuer-metadata.dto";
import { CredentialIssuanceTypedViewModelSchema, CredentialIssuanceSchemaProvider, CredentialIssuanceViewModelField } from "src/app/core/models/entity/lear-credential-issuance";
import { convertToOrderedArray, employeeMandatorFieldsOrder } from "../../helpers/fields-order-helpers";
import { mapClaimsToFields } from "../../helpers/claims-to-schema.mapper";
import { emailField, firstNameField, lastNameField, organizationField, organizationIdentifierField, serialNumberField } from "./common-issuance-schema-fields";
import { IssuancePowerComponent } from "../../components/power/issuance-power.component";
import { baseNameLengthValidatorEntries } from "src/app/shared/validators/credential-issuance/validators-entries";

@Injectable({ providedIn: 'root' })
export class LearCredentialEmployeeSchemaProvider implements CredentialIssuanceSchemaProvider<'learcredential.employee'> {

  /**
   * PUENTE AD-2 (opcion C) — DEPENDE DE EUD-58 (riesgo R-1).
   * Conjunto provisional de campos de `mandatee`: se usa (a) cuando la definicion de la
   * credencial no declara claims capturables (EC-02) y (b) como override de validadores
   * para las claves que el frontend ya sabe validar, de modo que derivar del metadata no
   * degrade la validacion vigente.
   * Cuando EUD-58 publique el esquema definitivo, basta con borrar estas dos constantes:
   * el resto del renderizado ya esta dirigido por la definicion.
   */
  private static readonly PROVISIONAL_MANDATEE_FIELDS: Readonly<Record<string, CredentialIssuanceViewModelField>> = {
    firstName: firstNameField,
    lastName: lastNameField,
    email: emailField,
    employeeId: { key: 'employeeId', type: 'control', controlType: 'text', validators: [...baseNameLengthValidatorEntries] }
  };

  /**
   * AC-07 — obligatorios. ClaimDefinitionDto NO expone flag de obligatoriedad (tampoco el
   * record ClaimDefinition del backend), asi que la obligatoriedad de las claves derivadas
   * sale de aqui hasta que EUD-58 la incorpore al metadata. `employeeId` NO es obligatorio
   * hoy y se mantiene asi.
   */
  private static readonly PROVISIONAL_REQUIRED_MANDATEE_KEYS = ['firstName', 'lastName', 'email'] as const;

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

        // MANDATEE — AD-2: derivado de credential_metadata.claims del config seleccionado.
        {
          key: 'mandatee',
          classes: 'mandatee',
          type: 'group',
          display: 'main',
          groupFields: this.buildMandateeFields(claims),
        },
        // MANDATOR — fuera del alcance de AD-2: side data estatico (staticValueGetter + AuthService).
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
      //  POWER — fuera del alcance de AD-2: componente custom (powers/PDP).
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
   * AC-02: campos derivados de la definicion.
   * EC-02: si la definicion no declara claims capturables de `mandatee`, se cae al
   * conjunto provisional. Nunca se devuelve un grupo vacio (dejaria un formulario mudo).
   */
  private buildMandateeFields(claims?: readonly ClaimDefinitionDto[]): CredentialIssuanceViewModelField[] {
    const derivedFields = mapClaimsToFields(claims, {
      locale: this.translate.currentLang,
      pathSegment: LearCredentialEmployeeSchemaProvider.MANDATEE_PATH_SEGMENT,
      requiredKeys: LearCredentialEmployeeSchemaProvider.PROVISIONAL_REQUIRED_MANDATEE_KEYS,
      fieldOverrides: LearCredentialEmployeeSchemaProvider.PROVISIONAL_MANDATEE_FIELDS
    });

    if (derivedFields.length > 0) return derivedFields;

    return Object.values(LearCredentialEmployeeSchemaProvider.PROVISIONAL_MANDATEE_FIELDS)
      .map(field => ({ ...field }));
  }
}
