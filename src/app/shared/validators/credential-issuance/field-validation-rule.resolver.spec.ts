import {
  FieldValidationRuleResolver,
  ProvisionalFieldValidationRuleResolver,
} from './field-validation-rule.resolver';

describe('ProvisionalFieldValidationRuleResolver', () => {
  let resolver: FieldValidationRuleResolver;

  beforeEach(() => {
    resolver = new ProvisionalFieldValidationRuleResolver();
  });

  describe('AC-06 — conjunto provisional', () => {
    it('marca firstName como required + text', () => {
      expect(resolver.resolve({ key: 'firstName' })).toEqual({
        key: 'firstName',
        required: true,
        basicType: 'text',
      });
    });

    it('propaga basicType date y number cuando se declara', () => {
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

    it('no marca required un campo fuera del conjunto provisional sin señal explícita', () => {
      expect(resolver.resolve({ key: 'middleName' }).required).toBe(false);
    });
  });

  describe('EC-01 — sin basicType declarado', () => {
    it('defaultea a text', () => {
      expect(resolver.resolve({ key: 'nickname' })).toMatchObject({
        basicType: 'text',
      });
    });

    it('undefined, null y cadena vacía en basicType degradan a text', () => {
      expect(resolver.resolve({ key: 'a', basicType: undefined }).basicType).toBe('text');
      expect(resolver.resolve({ key: 'b', basicType: null as any }).basicType).toBe('text');
      expect(resolver.resolve({ key: 'c', basicType: '' as any }).basicType).toBe('text');
    });

    it('un basicType desconocido degrada a text (no lanza error)', () => {
      expect(resolver.resolve({ key: 'd', basicType: 'boolean' as any }).basicType).toBe('text');
    });

    it('el fallback de tipo no arrastra required', () => {
      expect(resolver.resolve({ key: 'foo', required: true }).required).toBe(true);
      expect(resolver.resolve({ key: 'foo', required: true }).basicType).toBe('text');
    });
  });

  describe('EC-02 — campo opcional', () => {
    it('required: false explícito no bloquea (sin validador required downstream)', () => {
      expect(resolver.resolve({ key: 'middleName', required: false })).toEqual({
        key: 'middleName',
        required: false,
        basicType: 'text',
      });
    });

    it('clave fuera del conjunto provisional → required: false', () => {
      expect(resolver.resolve({ key: 'optionalNote' })).toMatchObject({
        required: false,
      });
    });

    it('required: false gana explícitamente aunque la clave esté en el conjunto provisional', () => {
      expect(resolver.resolve({ key: 'firstName', required: false }).required).toBe(false);
    });
  });
});
