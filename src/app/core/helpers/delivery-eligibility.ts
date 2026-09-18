import { CredentialConfigurationDto } from '../models/dto/credential-issuer-metadata.dto';
import { DeliveryModeOption } from '../models/entity/lear-credential-issuance';

/**
 * Whether a credential type is cryptographically bound to a holder key.
 *
 * `proof_types_supported` is the single signal behind that question (ADR-110, EUD-168): it is the
 * field obliging the wallet to send a signed key proof, and the key the issuer builds `cnf` from
 * comes out of that proof. Absent, there is no key to bind.
 *
 * Read this rather than `cryptographic_binding_methods_supported`, which describes how key material
 * is represented and not whether it is required. Deriving it from the published metadata is the
 * point: the issuer decides the same way from the same field, so the form cannot offer a mode
 * issuance would reject.
 */
export function requiresHolderBinding(config: CredentialConfigurationDto | undefined): boolean {
  const proofTypes = config?.proof_types_supported;
  return !!proofTypes && Object.keys(proofTypes).length > 0;
}

/**
 * Delivery modes that cannot carry a holder binding, because they involve no wallet and therefore no
 * OID4VCI proof-of-possession.
 *
 * Typed as `string[]` rather than `DeliveryModeToken[]`: this set is only ever compared against
 * catalogues that already exclude `'direct'` by construction (`WALLET_DELIVERY_MODE_OPTIONS`, EUD-233
 * AD-9) -- the two callers left after EUD-233 (states 2 and 4 of the tenant delivery catalogue) never
 * pass a catalogue this set would need to narrow further. It stays here, unwidened, as the rule this
 * function would still apply correctly if a caller ever did.
 */
const BOUND_INCOMPATIBLE_MODES: ReadonlySet<string> = new Set(['direct']);

/**
 * Narrows the delivery options the form may offer for a given credential configuration.
 *
 * Direct delivery has no wallet and therefore no proof-of-possession, so a bound type cannot be
 * delivered that way. Every other mode is always offerable.
 *
 * Returns the catalogue untouched when the configuration is unknown — an unresolved configuration is
 * not evidence that a mode is forbidden, and issuance validates the same rule server-side anyway.
 */
export function resolveOfferableDeliveryOptions(
  config: CredentialConfigurationDto | undefined,
  catalogue: readonly DeliveryModeOption[]
): DeliveryModeOption[] {
  if (!config || !requiresHolderBinding(config)) {
    return [...catalogue];
  }
  return catalogue.filter(option => !BOUND_INCOMPATIBLE_MODES.has(option.value));
}
