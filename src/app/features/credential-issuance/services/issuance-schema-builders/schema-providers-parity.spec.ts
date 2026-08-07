import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { CountryService } from 'src/app/shared/services/country.service';
import { ISSUANCE_CREDENTIAL_TYPES_ARRAY } from 'src/app/core/models/entity/lear-credential-issuance';
import { CREDENTIAL_SCHEMA_PROVIDERS } from './issuance-schema-builder';
import { LearCredentialEmployeeSchemaProvider } from './lear-credential-employee-issuance-schema-provider';
import { LearCredentialMachineIssuanceSchemaProvider } from './lear-credential-machine-issuance-schema-provider';

/**
 * `ISSUANCE_CREDENTIAL_TYPES_ARRAY` is the declaration of what this BUILD can draw a form
 * for — not tenant policy, which now lives in the published per-tenant document. It is also
 * the source of the `IssuanceCredentialType` union, which is why it stays a literal constant
 * instead of being derived from the providers at runtime.
 *
 * That leaves one way for it to rot: someone registers a provider in `main.ts` and forgets
 * the constant (the type is then never offered), or removes one and leaves it (the type is
 * offered and `IssuanceSchemaBuilder.getBuilder()` throws when it is selected). This test is
 * the guard against both.
 */
describe('schema providers ↔ ISSUANCE_CREDENTIAL_TYPES_ARRAY', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        // Both providers read these while building their schema; the schema itself is not
        // what this test is about, only the type each one claims.
        { provide: AuthService, useValue: { isSysAdmin: () => false, extractRawMandator: () => ({}) } },
        { provide: CountryService, useValue: { getCountriesAsSelectorOptions: () => [] } },
        // The same registration main.ts performs.
        { provide: CREDENTIAL_SCHEMA_PROVIDERS, useClass: LearCredentialEmployeeSchemaProvider, multi: true },
        { provide: CREDENTIAL_SCHEMA_PROVIDERS, useClass: LearCredentialMachineIssuanceSchemaProvider, multi: true },
      ],
    });
  });

  it('registers exactly one provider for every renderable type, and no others', () => {
    const registered = TestBed.inject(CREDENTIAL_SCHEMA_PROVIDERS).map(provider => provider.getSchema().type);

    expect([...registered].sort()).toEqual([...ISSUANCE_CREDENTIAL_TYPES_ARRAY].sort());
    expect(new Set(registered).size).toBe(registered.length);
  });
});
