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

    // AD-1 safe-deploy: provisional implementation until EUD-50/58/59 declare the real catalog.
    // Swapping to a metadata-driven implementation is a change to this assignment, not to the rest of the class.
    private readonly fieldValidationRuleResolver: FieldValidationRuleResolver =
      PROVISIONAL_FIELD_VALIDATION_RULE_RESOLVER;


  public getIssuanceFormSchema<T extends IssuanceCredentialType>(
    type: T,
    onBehalf: boolean = false,
    claims?: readonly ClaimDefinitionDto[]
  ): CredentialIssuanceTypedViewModelSchema<T>{
    return this.getBuilder(type).getSchema(onBehalf, claims);
  }

  /** AD-1: translates an already-resolved FieldValidationRule into ValidatorEntry[] (scope: required + basic type only). */
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
   * Single integration point for the generic resolver (AD-1), for consumers that need the full
   * translation to ValidatorEntry[] (required + basicType). `LearCredentialEmployeeSchemaProvider`
   * already consumes the resolver directly (it only needs `.required`, not the full translation);
   * this method is ready for when a consumer also needs `basicType` (date/number).
   * Does not alter the legacy fields in `common-issuance-schema-fields.ts` (R-2).
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
