import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { CountryService, Country } from './country.service';

describe('CountryService', () => {
  let service: CountryService;
  const translateMock: Partial<TranslateService> = {
    currentLang: 'es',
    instant: jest.fn((key: string | string[]) => {
      if (key === 'countries.spain') return 'España';
      if (key === 'countries.sweden') return 'Suecia';
      if (key === 'countries.germany') return 'Alemania';
      if (key === 'countries.france') return 'Francia';
      if (typeof key === 'string') return key;
      return key;
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateMock }],
    });
    service = TestBed.inject(CountryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should map countries to translation labels on construction', () => {
    // Indirectly tests the private mapCountriesToTranslationLabel()
    const countries = service.getCountries();

    // Sanity: list should not be empty
    expect(countries.length).toBeGreaterThan(0);

    // Every country name should have the "countries." prefix
    countries.forEach(c => {
      expect(c.name.startsWith('countries.')).toBe(true);
    });

    // A couple of concrete examples derived from the provided COUNTRIES
    expect(service.findCountryByIsoCode('ES')?.name).toBe('countries.spain');
    expect(service.findCountryByIsoCode('GB')?.name).toBe('countries.unitedKingdom'); // original was "unitedKingdom"
  });

  it('should return the list of countries (already mapped)', () => {
    const list = service.getCountries();
    // Pick a few to assert exact shape
    expect(list).toEqual(
      expect.arrayContaining<Country>([
        { name: 'countries.spain', phoneCode: '34', isoCountryCode: 'ES' },
        { name: 'countries.germany', phoneCode: '49', isoCountryCode: 'DE' },
        { name: 'countries.france', phoneCode: '33', isoCountryCode: 'FR' },
      ])
    );
  });

  it('should return a new sorted list by name without mutating the original', () => {
    const originalRef = service.getCountries(); // This is the internal array
    const sorted = service.getSortedCountries();

    // Should be a new array instance
    expect(sorted).not.toBe(originalRef);

    // Should be sorted ascending by name
    const names = sorted.map(c => c.name);
    const sortedNamesCopy = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNamesCopy);

    // Original reference should remain the same (no in-place mutation)
    expect(service.getCountries()).toBe(originalRef);
  });

  it('should return the correct country for a given ISO country code', () => {
    const result = service.findCountryByIsoCode('ES');
    expect(result).toEqual<Country>({
      name: 'countries.spain',
      phoneCode: '34',
      isoCountryCode: 'ES',
    });
  });

  it('should return undefined for an invalid ISO country code', () => {
    const result = service.findCountryByIsoCode('INVALID');
    expect(result).toBeUndefined();
  });

  it('should find a country by its translation key name, case-insensitive', () => {
    // The service now stores names as "countries.xxx"
    const result = service.findCountryByName('CoUnTrIeS.SpAiN');
    expect(result).toEqual<Country>({
      name: 'countries.spain',
      phoneCode: '34',
      isoCountryCode: 'ES',
    });
  });

  it('should return the correct translation-key name for a valid ISO country code', () => {
    const result = service.resolveCountryNameFromIsoCode('ES');
    expect(result).toBe('countries.spain');
  });

  it('should return an empty string for an invalid ISO country code when fetching name', () => {
    const result = service.resolveCountryNameFromIsoCode('INVALID');
    expect(result).toBe('');
  });

  it('should return the correct phone code for a valid ISO country code', () => {
    const result = service.resolveCountryPhoneFromIsoCode('ES');
    expect(result).toBe('34');
  });

  it('should return an empty string for an invalid ISO country code when fetching phone code', () => {
    const result = service.resolveCountryPhoneFromIsoCode('INVALID');
    expect(result).toBe('');
  });

  it('should return countries as selector options with translation-key labels', () => {
    const options = service.getCountriesAsSelectorOptions();

    // Each option should have a translation-key label and the ISO country code as value
    options.forEach(opt => {
      expect(opt.label.startsWith('countries.')).toBe(true);
      expect(typeof opt.value).toBe('string');
      expect(opt.value.length).toBeGreaterThan(0);
    });

    // A concrete example for ES
    expect(options).toEqual(
      expect.arrayContaining([
        { label: 'countries.spain', value: 'ES' },
      ])
    );
  });

  it('should sort selector options by translated label instead of the english key', () => {
    const options = service.getCountriesAsSelectorOptions();
    const spainIndex = options.findIndex(option => option.value === 'ES');
    const swedenIndex = options.findIndex(option => option.value === 'SE');

    expect(spainIndex).toBeGreaterThanOrEqual(0);
    expect(swedenIndex).toBeGreaterThanOrEqual(0);
    expect(spainIndex).toBeLessThan(swedenIndex);
  });
});
