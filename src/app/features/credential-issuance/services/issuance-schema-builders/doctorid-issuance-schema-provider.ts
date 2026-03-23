import { Injectable } from "@angular/core";
import { CredentialIssuanceTypedViewModelSchema, CredentialIssuanceSchemaProvider } from "src/app/core/models/entity/lear-credential-issuance";
import { emailField, firstNameField, lastNameField } from "./common-issuance-schema-fields";
import { nameValidatorEntries } from "src/app/shared/validators/credential-issuance/validators-entries";

@Injectable({ providedIn: 'root' })
export class DoctorIdIssuanceSchemaProvider implements CredentialIssuanceSchemaProvider<'doctorid'> {

  public getSchema(): CredentialIssuanceTypedViewModelSchema<'doctorid'> {
    return {
      type: 'doctorid',
      schema: [
        {
          key: 'doctorData',
          classes: 'mandatee',
          type: 'group',
          display: 'main',
          groupFields: [
            { ...firstNameField },
            { ...lastNameField },
            { key: 'registrationNumber', type: 'control', controlType: 'text', validators: [{ name: 'required' }, { name: 'minLength', args: [3] }, { name: 'maxLength', args: [20] }] },
            { key: 'nationalId', type: 'control', controlType: 'text', validators: [{ name: 'required' }, { name: 'minLength', args: [5] }, { name: 'maxLength', args: [20] }] },
            { key: 'provincialBoard', type: 'control', controlType: 'text', validators: [...nameValidatorEntries] },
            { key: 'specialty', type: 'control', controlType: 'text', validators: [...nameValidatorEntries] },
            { ...emailField },
            { key: 'country', type: 'control', controlType: 'text', validators: [{ name: 'required' }, { name: 'minLength', args: [2] }, { name: 'maxLength', args: [3] }] },
          ],
        },
      ]
    };
  }
}
