import { AUDIT_EVENT_TYPES, AUDIT_REASONS, AUDIT_RESULTS } from './constants/audit-catalogue.constants';

type Dictionary = { [key: string]: string | Dictionary };

const load = (language: string): Dictionary =>
  jest.requireActual<Dictionary>(`src/assets/i18n/${language}.json`);

const flatten = (dictionary: Dictionary, prefix = ''): Record<string, string> =>
  Object.entries(dictionary).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...flat, [path]: value } : { ...flat, ...flatten(value, path) };
  }, {});

// A one-word code ("Revocation", "Denied", "Timeout") is also its English name; a code in CamelCase never is.
const isCompound = (code: string): boolean => /[a-z][A-Z]/.test(code);

// FR-07: the section shows catalogue types, results and reasons by their translated name, in Spanish and in
// English, and never by the catalogue code. These specs keep the catalogue constants and the files in step.
describe.each(['es', 'en'])('audit translations (%s)', language => {
  const texts = flatten(load(language));

  it.each(AUDIT_EVENT_TYPES)('translates the event type %s', type => {
    const text = texts[`audit.eventType.${type}`];

    expect(text).toBeTruthy();
    expect(!isCompound(type) || text !== type).toBe(true);
  });

  it.each(AUDIT_RESULTS)('translates the result %s', result => {
    const text = texts[`audit.result.${result}`];

    expect(text).toBeTruthy();
    expect(!isCompound(result) || text !== result).toBe(true);
  });

  it.each(AUDIT_REASONS)('translates the reason %s', reason => {
    const text = texts[`audit.reason.${reason}`];

    expect(text).toBeTruthy();
    expect(!isCompound(reason) || text !== reason).toBe(true);
  });

  it('has a generic text for a code of a newer catalogue', () => {
    expect(texts['audit.eventType.unknown']).toBeTruthy();
    expect(texts['audit.result.unknown']).toBeTruthy();
    expect(texts['audit.reason.unknown']).toBeTruthy();
  });

  it('translates the menu entry and every message of the PRD error table', () => {
    [
      'navbar.menu.audit',
      'audit.empty',
      'audit.footer',
      'audit.error.period_archived',
      'audit.error.bad_request',
      'audit.error.no_access',
      'audit.error.session_expired',
      'audit.error.rate_limited',
      'audit.error.generic',
    ].forEach(key => expect(texts[key]).toBeTruthy());
  });

  it('tells how many seconds to wait in the rate-limit message', () => {
    expect(texts['audit.error.rate_limited']).toContain('{{seconds}}');
  });

  it('explains the period limits with the oldest day', () => {
    expect(texts['audit.period.hint']).toContain('{{days}}');
    expect(texts['audit.period.hint']).toContain('{{oldest}}');
  });
});

describe('audit translations, both languages', () => {
  it('have the same keys', () => {
    const spanish = Object.keys(flatten(load('es'))).filter(key => key.startsWith('audit.')).sort();
    const english = Object.keys(flatten(load('en'))).filter(key => key.startsWith('audit.')).sort();

    expect(spanish).toEqual(english);
  });

  it('use the same interpolation parameters in each text', () => {
    const spanish = flatten(load('es'));
    const english = flatten(load('en'));
    const parameters = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();

    Object.keys(spanish).filter(key => key.startsWith('audit.')).forEach(key => {
      expect(parameters(spanish[key])).toEqual(parameters(english[key]));
    });
  });
});
