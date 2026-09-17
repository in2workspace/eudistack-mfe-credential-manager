import {
  DELIVERY_MODE_OPTIONS,
  DELIVERY_RESULT_ORDER,
  DeliveryModeToken,
  WALLET_DELIVERY_MODE_OPTIONS,
  toDeliveryCsv,
} from './lear-credential-issuance';

describe('lear-credential-issuance — delivery vocabulary', () => {

  describe('DELIVERY_MODE_OPTIONS', () => {

    it('offers exactly the three modes, in DELIVERY_RESULT_ORDER', () => {
      expect(DELIVERY_MODE_OPTIONS.map(option => option.value)).toEqual([...DELIVERY_RESULT_ORDER]);
    });
  });

  describe('WALLET_DELIVERY_MODE_OPTIONS', () => {

    it('offers exactly the two wallet modes, ui before email', () => {
      expect(WALLET_DELIVERY_MODE_OPTIONS.map(option => option.value)).toEqual(['ui', 'email']);
    });

    it('never includes direct', () => {
      expect(WALLET_DELIVERY_MODE_OPTIONS.some(option => option.value === 'direct')).toBe(false);
    });
  });

  describe('toDeliveryCsv', () => {

    it('builds a single-token CSV for one mode', () => {
      expect(toDeliveryCsv(['direct'])).toBe('direct');
    });

    it('orders mixed input into direct, ui, email regardless of input order (AD-3)', () => {
      expect(toDeliveryCsv(['email', 'direct', 'ui'])).toBe('direct,ui,email');
    });

    it('dedupes repeated tokens', () => {
      expect(toDeliveryCsv(['ui', 'ui', 'email'])).toBe('ui,email');
    });

    it('emits exactly the three tokens when all three are marked', () => {
      expect(toDeliveryCsv(['ui', 'email', 'direct'])).toBe('direct,ui,email');
    });

    it('declares exactly what was marked, no more and no less', () => {
      expect(toDeliveryCsv(['direct', 'email'])).toBe('direct,email');
    });

    it('throws on an empty iterable instead of returning an empty CSV (ES-01)', () => {
      expect(() => toDeliveryCsv([])).toThrow();
    });

    it('accepts any Iterable<DeliveryModeToken>, not just arrays', () => {
      const modes: Set<DeliveryModeToken> = new Set(['email', 'direct']);

      expect(toDeliveryCsv(modes)).toBe('direct,email');
    });
  });
});
