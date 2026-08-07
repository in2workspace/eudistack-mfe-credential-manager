import {
  FieldValidationRuleResolver,
  ProvisionalFieldValidationRuleResolver,
} from './field-validation-rule.resolver';

describe('ProvisionalFieldValidationRuleResolver', () => {
  let resolver: FieldValidationRuleResolver;

  beforeEach(() => {
    resolver = new ProvisionalFieldValidationRuleResolver();
  });

  describe('AC-06 — provisional set', () => {
    it('marks firstName as required + text', () => {
      expect(resolver.resolve({ key: 'firstName' })).toEqual({
        key: 'firstName',
        required: true,
        basicType: 'text',
      });
    });

    it('propagates basicType date and number when declared', () => {
      expect(resolver.resolve({ key: 'birthDate', basicType: 'date', required: true })).toEqual({
        key: 'birthDate',
        required: true,
        basicType: 'date',
      });
      expect(resolver.resolve({ key: 'amount', basicType: 'number' })).toEqual({
        key: 'amount',
        required: false,
        basicType: 'number',
      });
    });

    it('does not mark a field outside the provisional set as required without an explicit signal', () => {
      expect(resolver.resolve({ key: 'middleName' }).required).toBe(false);
    });
  });

  describe('EC-01 — no basicType declared', () => {
    it('defaults to text', () => {
      expect(resolver.resolve({ key: 'nickname' })).toMatchObject({
        basicType: 'text',
      });
    });

    it('undefined, null and empty string in basicType degrade to text', () => {
      expect(resolver.resolve({ key: 'a', basicType: undefined }).basicType).toBe('text');
      expect(resolver.resolve({ key: 'b', basicType: null as any }).basicType).toBe('text');
      expect(resolver.resolve({ key: 'c', basicType: '' as any }).basicType).toBe('text');
    });

    it('an unknown basicType degrades to text (does not throw)', () => {
      expect(resolver.resolve({ key: 'd', basicType: 'boolean' as any }).basicType).toBe('text');
    });

    it('the type fallback does not affect required', () => {
      expect(resolver.resolve({ key: 'foo', required: true }).required).toBe(true);
      expect(resolver.resolve({ key: 'foo', required: true }).basicType).toBe('text');
    });
  });

  describe('EC-02 — optional field', () => {
    it('explicit required: false does not block (no downstream required validator)', () => {
      expect(resolver.resolve({ key: 'middleName', required: false })).toEqual({
        key: 'middleName',
        required: false,
        basicType: 'text',
      });
    });

    it('a key outside the provisional set -> required: false', () => {
      expect(resolver.resolve({ key: 'optionalNote' })).toMatchObject({
        required: false,
      });
    });

    it('required: false wins explicitly even when the key is in the provisional set', () => {
      expect(resolver.resolve({ key: 'firstName', required: false }).required).toBe(false);
    });
  });
});
