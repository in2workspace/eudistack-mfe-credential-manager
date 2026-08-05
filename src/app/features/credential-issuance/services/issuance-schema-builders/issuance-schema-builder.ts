import { inject, Injectable, InjectionToken } from "@angular/core";
import { CredentialIssuanceTypedViewModelSchema, CredentialIssuanceSchemaProvider, IssuanceCredentialType, IssuanceStaticViewModel, CredentialIssuanceViewModelField, CredentialIssuanceViewModelSchema, IssuanceViewModelsTuple, CredentialIssuanceViewModelGroupField, CredentialIssuanceViewModelSchemaWithId, CredentialIssuanceViewModelGroupFieldWithId } from "src/app/core/models/entity/lear-credential-issuance";
import { ValidatorEntryUnion } from "src/app/shared/validators/credential-issuance/all-validators";
import {
  FieldValidationRule,
  FieldValidationRuleInput,
  FieldValidationRuleResolver,
  PROVISIONAL_FIELD_VALIDATION_RULE_RESOLVER,
} from "src/app/shared/validators/credential-issuance/field-validation-rule.resolver";
import { ClaimDefinitionDto } from "src/app/core/models/dto/credential-issuer-metadata.dto";

export const CREDENTIAL_SCHEMA_PROVIDERS = new InjectionToken<CredentialIssuanceSchemaProvider<IssuanceCredentialType>[]>('CREDENTIAL_SCHEMA_PROVIDERS');

@Injectable({ providedIn: 'root' })
export class IssuanceSchemaBuilder {
    private readonly schemaProviders: CredentialIssuanceSchemaProvider<IssuanceCredentialType>[] = inject(CREDENTIAL_SCHEMA_PROVIDERS);

    // AD-1 safe-deploy: implementación provisional hasta que EUD-50/58/59 declaren el catálogo real.
    // El swap a una implementación metadata-driven es un cambio de esta asignación, no del resto de la clase.
    private readonly fieldValidationRuleResolver: FieldValidationRuleResolver =
      PROVISIONAL_FIELD_VALIDATION_RULE_RESOLVER;


  public getIssuanceFormSchema<T extends IssuanceCredentialType>(
    type: T,
    onBehalf: boolean = false,
    claims?: readonly ClaimDefinitionDto[]
  ): CredentialIssuanceTypedViewModelSchema<T>{
    return this.getBuilder(type).getSchema(onBehalf, claims);
  }

  /** AD-1: traduce una FieldValidationRule ya resuelta a ValidatorEntry[] (alcance acotado: required + tipo básico). */
  public buildValidatorEntriesFromRule(rule: FieldValidationRule): ValidatorEntryUnion[] {
    const entries: ValidatorEntryUnion[] = [];
    if (rule.required) {
      entries.push({ name: 'required' });
    }
    switch (rule.basicType) {
      case 'date':
        entries.push({ name: 'date' });
        break;
      case 'number':
        entries.push({ name: 'numeric' });
        break;
      case 'text':
      default:
        break;
    }
    return entries;
  }

  /**
   * Punto único de integración del resolver genérico (AD-1). Consumible por `claims-to-schema.mapper.ts`
   * (EUD-71) sin alterar los campos legacy de `common-issuance-schema-fields.ts` (R-2).
   */
  public buildValidatorEntriesForField(input: FieldValidationRuleInput): ValidatorEntryUnion[] {
    const rule = this.fieldValidationRuleResolver.resolve(input);
    return this.buildValidatorEntriesFromRule(rule);
  }

  public formSchemasBuilder<T extends IssuanceCredentialType>(
    credType: T,
    onBehalf: boolean,
    claims?: readonly ClaimDefinitionDto[]
  ): IssuanceViewModelsTuple {
    const rawSchema: CredentialIssuanceViewModelSchema  = this.getIssuanceFormSchema(credType, onBehalf, claims).schema;
    const formViewModel: CredentialIssuanceViewModelSchemaWithId = [];
    const staticSchema: IssuanceStaticViewModel = {};

    for (const field of rawSchema) {
      // id is added to enable the "track" function in the fields @for loop
      // we add NOSONAR since this id is sufficient for the number of fields we manage + the id is not sent to backend
      const fieldWithId: CredentialIssuanceViewModelGroupFieldWithId = { ...field, id: Math.random() * 1000 }; // NOSONAR

      if (this.shouldExtractStatic(fieldWithId, onBehalf)) {
        this.extractStatic(fieldWithId, staticSchema);
        continue;
      }

      formViewModel.push(fieldWithId);
    }

    return [formViewModel, staticSchema];
  }

  private shouldExtractStatic(field: CredentialIssuanceViewModelGroupField, onBehalf: boolean): boolean {
    if (field.display === 'side') return true;
    if (field.display === 'pref_side' && !onBehalf) return true;
    return false;
  }

  private extractStatic(field: CredentialIssuanceViewModelField, staticSchema: IssuanceStaticViewModel): void {
    const getter = field.staticValueGetter;
    if (typeof getter === 'function') {
      const val = getter();
      if (val && typeof val === 'object') {
        Object.assign(staticSchema, val);
      } else {
        console.error(`Could not get static value from field ${field.key ?? field}`);
      }
    }
}

  private getBuilder<T extends IssuanceCredentialType>(type: T): CredentialIssuanceSchemaProvider<T> {
    const b = this.schemaProviders.find(x => x.getSchema().type === type) as CredentialIssuanceSchemaProvider<T> | undefined;
    if(!b) throw new Error(`No schema builder for ${type}`);
    return b;
  }


}
