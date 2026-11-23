import {
  DELIVERY_MODE_OPTIONS,
  DELIVERY_RESULT_ORDER,
  WALLET_DELIVERY_MODE_OPTIONS,
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
});
