import { requiresHolderBinding, resolveOfferableDeliveryOptions } from './delivery-eligibility';
import { CredentialConfigurationDto } from '../models/dto/credential-issuer-metadata.dto';
import { DeliveryOption } from '../models/entity/lear-credential-issuance';

describe('delivery-eligibility', () => {

  const bound: CredentialConfigurationDto = {
    format: 'jwt_vc_json',
    proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['ES256'] } },
  };

  const unbound: CredentialConfigurationDto = { format: 'jwt_vc_json' };

  // The catalogue as it stands on main. 'direct' is deliberately absent from the DeliveryMode union
  // (EUD-233 owns it), so it is cast in only where a test needs to prove the filter would catch it.
  const walletOnlyCatalogue: DeliveryOption[] = [
    { value: 'email', labelKey: 'credentialIssuance.delivery.email' },
    { value: 'ui', labelKey: 'credentialIssuance.delivery.qrCode' },
  ];

  const catalogueWithDirect: DeliveryOption[] = [
    ...walletOnlyCatalogue,
    { value: 'direct' as DeliveryOption['value'], labelKey: 'credentialIssuance.delivery.direct' },
  ];

  describe('requiresHolderBinding', () => {

    it('is true when proof_types_supported is present and non-empty', () => {
      expect(requiresHolderBinding(bound)).toBe(true);
    });

    it('is false when proof_types_supported is absent', () => {
      expect(requiresHolderBinding(unbound)).toBe(false);
    });

    it('treats an empty proof_types_supported as absent', () => {
      // ADR-110 asks for absence to be declared by removing the key, but an issuer that publishes the
      // empty form must not be read as demanding a proof it never asks for.
      expect(requiresHolderBinding({ format: 'jwt_vc_json', proof_types_supported: {} })).toBe(false);
    });

    it('is false for an unknown configuration', () => {
      expect(requiresHolderBinding(undefined)).toBe(false);
    });

    it('ignores cryptographic_binding_methods_supported', () => {
      // That field describes how key material is represented, not whether it is required. Reading it
      // as an obligation is the confusion ADR-110 removes.
      const misleading = {
        format: 'jwt_vc_json',
        cryptographic_binding_methods_supported: ['did:key'],
      } as CredentialConfigurationDto;

      expect(requiresHolderBinding(misleading)).toBe(false);
    });
  });

  describe('resolveOfferableDeliveryOptions', () => {

    it('offers every mode for an unbound type', () => {
      expect(resolveOfferableDeliveryOptions(unbound, catalogueWithDirect))
        .toEqual(catalogueWithDirect);
    });

    it('withholds direct delivery for a bound type', () => {
      const offered = resolveOfferableDeliveryOptions(bound, catalogueWithDirect);

      expect(offered.map(o => o.value)).toEqual(['email', 'ui']);
    });

    it('leaves the wallet modes untouched for a bound type', () => {
      // email and ui never require narrowing: they carry a wallet, and therefore a key proof.
      expect(resolveOfferableDeliveryOptions(bound, walletOnlyCatalogue))
        .toEqual(walletOnlyCatalogue);
    });

    it('returns the catalogue untouched for an unknown configuration', () => {
      // An unresolved configuration is not evidence that a mode is forbidden, and issuance validates
      // the same rule server-side anyway.
      expect(resolveOfferableDeliveryOptions(undefined, catalogueWithDirect))
        .toEqual(catalogueWithDirect);
    });

    it('does not mutate the catalogue it is given', () => {
      const original = [...catalogueWithDirect];

      resolveOfferableDeliveryOptions(bound, catalogueWithDirect);

      expect(catalogueWithDirect).toEqual(original);
    });
  });
});
