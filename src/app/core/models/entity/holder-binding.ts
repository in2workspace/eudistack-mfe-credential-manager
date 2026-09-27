import { HolderPublicJwk } from './lear-credential-issuance';

/**
 * The two public products of a generated holder key pair -- the ones that travel in the issuance
 * request (EUD-233 AD-6). The private half never joins this type: it is sealed into
 * `HolderPrivateKeyStore` and nowhere else.
 */
export interface HolderBinding {
  didKey: string;
  publicJwk: HolderPublicJwk;
}
