import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { CountryService } from 'src/app/shared/services/country.service';
import * as fieldsHelpers from '../../helpers/fields-order-helpers';
import {
  firstNameField,
  lastNameField,
  emailField,
  organizationField,
  organizationIdentifierField,
  serialNumberField,
} from './common-issuance-schema-fields';
import { IssuancePowerComponent } from '../../components/power/issuance-power.component';
import { CredentialIssuanceTypedViewModelSchema } from 'src/app/core/models/entity/lear-credential-issuance';
import { LearCredentialEmployeeSchemaProvider } from './lear-credential-employee-issuance-schema-provider';

describe('LearCredentialEmployeeSchemaProvider', () => {
  let service: LearCredentialEmployeeSchemaProvider;
  let authMock: jest.Mocked<AuthService>;
  let countryMock: jest.Mocked<CountryService>;
  const fakeCountries = [{ label: 'C', value: 'c' }];

  const fakeMandatorRaw: Record<string, string> = {};
  for (const k of fieldsHelpers.employeeMandatorFieldsOrder) {
    fakeMandatorRaw[k] = `val-${k}`;
  }

  beforeEach(() => {
    authMock = {
      extractRawMandator: jest.fn(),
      isSysAdmin: jest.fn(),
    } as any;

    countryMock = {
      getCountriesAsSelectorOptions: jest.fn().mockReturnValue(fakeCountries),
    } as any;

    jest
      .spyOn(fieldsHelpers, 'convertToOrderedArray')
      .mockImplementation((obj: any, order: any[]) =>
        order
          .filter((k: any) => obj[k] != null)
          .map((k: any) => ({ key: k, value: obj[k] }))
      );

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        LearCredentialEmployeeSchemaProvider,
        { provide: AuthService, useValue: authMock },
        { provide: CountryService, useValue: countryMock },
      ],
    });

    service = TestBed.inject(LearCredentialEmployeeSchemaProvider);
  });

  describe('getSchema()', () => {
    let schema: CredentialIssuanceTypedViewModelSchema<'learcredential.employee'>;

    beforeEach(() => {
      schema = service.getSchema();
    });

    it('should include mandatee group with correct fields', () => {
      (authMock.isSysAdmin as jest.Mock).mockReturnValue(false);
      const schema = service.getSchema();

      const mand = schema.schema.find(f => f.key === 'mandatee');
      expect(mand).toBeDefined();
      expect(mand?.type).toBe('group');
      expect(mand?.display).toBe('main');

      const [fn, ln, email, nat] = mand!.groupFields;
      expect(fn).toEqual(firstNameField);
      expect(ln).toEqual(lastNameField);
      expect(email).toEqual(emailField);
    });

    // todo test
    // it('should include mandator group with staticValueGetter and ordered fields', () => {
    //   const mandator = schema.schema.find(f => f.key === 'mandator');
    //   expect(mandator).toBeDefined();
    //   expect(mandator?.display).toBe('pref_side');
    //   expect(typeof mandator?.staticValueGetter).toBe('function');

    //   // quan authService retorna null
    //   authMock.extractRawMandator.mockReturnValue(null);
    //   expect(mandator?.staticValueGetter!()).toBeNull();

    //   // quan authService retorna l'objecte complet
    //   authMock.extractRawMandator.mockReturnValue(fakeMandatorRaw as any);
    //   const staticData = mandator?.staticValueGetter!();
    //   expect(staticData).toHaveProperty('mandator');
    //   expect(staticData!.mandator).toEqual(
    //     fieldsHelpers.employeeMandatorFieldsOrder.map(k => ({ key: k, value: fakeMandatorRaw[k] }))
    //   );

    //   // comprovem l'ordre i contingut de groupFields
    //   const fields = mandator?.groupFields!;
    //   expect(fields[0]).toEqual(firstNameField);
    //   expect(fields[1]).toEqual(lastNameField);
    //   expect(fields[2]).toMatchObject({ ...emailField, key: 'emailAddress' });
    //   expect(fields[3]).toEqual(serialNumberField);
    //   expect(fields[4]).toEqual(organizationField);
    //   expect(fields[5]).toEqual(organizationIdentifierField);

    //   const countryField = fields[6];
    //   expect(countryField).toMatchObject({
    //     key: 'country',
    //     controlType: 'selector',
    //     multiOptions: fakeCountries,
    //     validators: [{ name: 'required' }],
    //   });
    // });

    it('should include ALL powers if user IS sysAdmin', () => {
      (authMock.isSysAdmin as jest.Mock).mockReturnValue(true);
      const schema = service.getSchema();

      const power = schema.schema.find(f => f.key === 'power');
      expect(power).toBeDefined();
      expect(power?.type).toBe('group');
      expect(power?.groupFields).toEqual([]);

      expect(power?.custom).toMatchObject({
        component: IssuancePowerComponent,
        data: [
          {
            action: ['Create', 'Update', 'Delete'],
            function: 'ProductOffering',
            isAdminRequired: false,
          },
          {
            action: ['Execute'],
            function: 'Onboarding',
            isAdminRequired: true,
          },
          {
            action: ['Upload', 'Attest'],
            function: 'Certification',
            isAdminRequired: true,
          },
        ],
      });
    });

    it('should include LIMITED powers if user is NOT sysAdmin (TenantAdmin or LEAR)', () => {
      (authMock.isSysAdmin as jest.Mock).mockReturnValue(false);
      const schema = service.getSchema();

      const power = schema.schema.find(f => f.key === 'power');
      expect(power).toBeDefined();

      expect(power?.custom).toMatchObject({
        component: IssuancePowerComponent,
        data: [
          {
            action: ['Create', 'Update', 'Delete'],
            function: 'ProductOffering',
            isAdminRequired: false,
          }
        ],
      });
    });

    it('should include ALL powers if user is NOT sysAdmin but is acting onBehalf', () => {
      (authMock.isSysAdmin as jest.Mock).mockReturnValue(false);
      const schema = service.getSchema(true);
      const power = schema.schema.find(f => f.key === 'power');
      expect(power).toBeDefined();

      expect(power?.custom).toMatchObject({
        component: IssuancePowerComponent,
        data: [
          {
            action: ['Create', 'Update', 'Delete'],
            function: 'ProductOffering',
            isAdminRequired: false,
          },
          {
            action: ['Execute'],
            function: 'Onboarding',
            isAdminRequired: true,
          },
          {
            action: ['Upload', 'Attest'],
            function: 'Certification',
            isAdminRequired: true,
          },
        ],
      });
    });
  });

  describe('mandatee fields (AD-2)', () => {
    const mandateeGroup = (schema: any[]) => schema.find(f => f.key === 'mandatee');

    it('should derive the mandatee fields from the credential definition claims (AC-02)', () => {
      const claims = [
        { path: ['mandatee', 'firstName'], display: [{ name: 'Nombre del empleado', locale: 'en' }] },
        { path: ['mandatee', 'nickname'], display: [{ name: 'Alias', locale: 'en' }] }
      ];

      const { schema } = service.getSchema(false, claims);

      expect(mandateeGroup(schema).groupFields.map((f: any) => f.key)).toEqual(['firstName', 'nickname']);
      expect(mandateeGroup(schema).groupFields[0].label).toBe('Nombre del empleado');
    });

    it('should keep the provisional validators for known keys (no regression)', () => {
      const claims = [{ path: ['mandatee', 'email'], display: [{ name: 'Correo', locale: 'en' }] }];

      const { schema } = service.getSchema(false, claims);
      const emailControl = mandateeGroup(schema).groupFields[0];

      expect(emailControl.validators).toEqual(expect.arrayContaining([{ name: 'required' }]));
      expect(emailControl.label).toBe('Correo');
    });

    it('should fall back to the provisional employee field set when the definition has no claims (EC-02)', () => {
      const { schema } = service.getSchema(false, []);

      expect(mandateeGroup(schema).groupFields.map((f: any) => f.key))
        .toEqual(['firstName', 'lastName', 'email', 'employeeId']);
    });

    it('should fall back to the provisional set when claims only describe mandator/power', () => {
      const claims = [{ path: ['mandator', 'organization'], display: [] }];

      const { schema } = service.getSchema(false, claims);

      expect(mandateeGroup(schema).groupFields).toHaveLength(4);
    });

    it('should leave mandator and power untouched regardless of the claims', () => {
      const claims = [{ path: ['mandatee', 'firstName'], display: [] }];

      const { schema } = service.getSchema(false, claims);

      expect(schema.find((f: any) => f.key === 'mandator')!.display).toBe('pref_side');
      expect(schema.find((f: any) => f.key === 'power')!.custom).toBeDefined();
    });
  });
});
