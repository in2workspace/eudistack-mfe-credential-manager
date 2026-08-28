import { CredentialConfigurationDto } from '../models/dto/credential-issuer-metadata.dto';
import { DeliveryOption } from '../models/entity/lear-credential-issuance';

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
 * Typed as `string[]` rather than `DeliveryMode[]` on purpose: `'direct'` is not part of the
 * `DeliveryMode` union yet — the form cannot offer it and the response DTO cannot render its result
 * (EUD-233 owns that). Widening the union here would have the type claim a capability the UI does
 * not have. This keeps the rule correct in advance without pretending the mode already exists.
 */
const BOUND_INCOMPATIBLE_MODES: readonly string[] = ['direct'];

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
  catalogue: readonly DeliveryOption[]
): DeliveryOption[] {
  if (!config || !requiresHolderBinding(config)) {
    return [...catalogue];
  }
  return catalogue.filter(option => !BOUND_INCOMPATIBLE_MODES.includes(option.value));
}
