/**
 * The closed list of credential types that bind to a holder key supplied in the issuance request,
 * despite declaring no `proof_types_supported` — the scoped exception to ADR-110 (EUD-168, AD-8).
 *
 * ADR-110 makes `proof_types_supported` the single signal of holder binding, so an unbound type has
 * no channel through which a holder key could arrive and can carry no `cnf`. For the machine
 * LEARCredential that is premature: the machine does own a key pair, it simply has no wallet with
 * which to prove possession. Those types therefore keep `cnf_required` and take their key from the
 * request body — in every delivery mode, since with `proof_types_supported` withdrawn no key proof
 * reaches the wallet flow either.
 *
 * <h2>Why a hardcoded list here too</h2>
 *
 * This mirrors `HolderBindingExemption` in `eudistack-core-issuer`
 * (`shared/domain/model/dto/credential/profile/HolderBindingExemption.java`). Duplicating two string
 * literals across repositories is a real cost and the drift is real — but the alternatives are
 * worse. The published metadata cannot express it: after migration these profiles publish exactly
 * what `gx.labelcredential.w3c.2` publishes (neither binding field), and that one must never be sent
 * a holder key. Deriving it would need `cnf_required` in the discovery document, which EUD-215
 * removed on purpose — the OIDF conformance suite flags every non-OID4VCI parameter there.
 *
 * Matched by family prefix rather than exact id, mirroring the Java side, so a version bump of
 * either machine credential needs no code change on either repository. The mitigation against drift
 * is the test that pins these prefixes: changing them has to be deliberate.
 *
 * <h2>Retirement</h2>
 * When machines get a wallet of their own, these types recover `proof_types_supported`, stop being
 * eligible for direct delivery, and derive `cnf` from the key proof again. Retiring the exception
 * means emptying this list and its Java counterpart, and deleting the key generation it gates.
 */
const HOLDER_KEY_REQUIRED_CONFIGURATION_ID_PREFIXES: readonly string[] = [
  'learcredential.machine.sd.',
  'learcredential.machine.w3c.',
];

/**
 * Whether the issuance request for this credential type must carry a `holder_key`.
 *
 * An unknown configuration answers `false`: the Issuer rejects a missing key loudly at intake, so
 * guessing here would only generate a private key for a credential that is not bound to it — which
 * is worse than the 400, because nothing downstream would ever reveal the mistake.
 */
export function requiresRequestHolderKey(credentialConfigurationId: string | undefined): boolean {
  return !!credentialConfigurationId
    && HOLDER_KEY_REQUIRED_CONFIGURATION_ID_PREFIXES.some(prefix =>
      credentialConfigurationId.startsWith(prefix));
}

/** Exposed for the test that pins the prefixes; not part of the runtime contract. */
export const EXEMPT_CONFIGURATION_ID_PREFIXES_FOR_TEST = HOLDER_KEY_REQUIRED_CONFIGURATION_ID_PREFIXES;
