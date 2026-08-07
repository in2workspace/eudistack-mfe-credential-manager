import { IssuanceUiPolicy } from '../models/issuance-ui-policy.model';

/**
 * Where the published policy lives: same origin, same CloudFront distribution as the app
 * itself, under the shared per-tenant assets prefix that `custom-domain.json` already uses.
 *
 * Absolute (not `assets/...`): this app is served under `--base-href=/issuer/`, and the
 * tenant assets are published at the ROOT of the distribution by `platform-assets`'s
 * `s3 sync tenants/ s3://<bucket>/assets/tenants/`. A relative path would resolve to
 * `/issuer/assets/...`, which is the app's own bundle.
 */
export const ISSUANCE_UI_POLICY_URL = '/assets/tenants/issuance-ui.json';

/**
 * Wait budget per attempt before giving up on one try.
 *
 * 800 ms is the platform-wide bootstrap budget (EUD-217 NFR-S-217-01), already implemented by
 * mfe-login for its own theme fetch. It is a ceiling that should never be reached here: the
 * document is sub-KB, same-origin and served with `max-age=300`.
 */
export const ISSUANCE_UI_POLICY_TIMEOUT_MS = 800;

/**
 * Retries before the policy is declared unavailable, mirroring `TenantService`'s handling of
 * the sibling `custom-domain.json`.
 *
 * They exist because this policy is fail-closed: a transient blip on the assets distribution
 * would otherwise cost a tenant its whole issuance screen for the session. Worst case is
 * ~3.3 s of bootstrap (3 attempts of 800 ms plus 300/600 ms backoff), paid only when the
 * document is genuinely unreachable.
 */
export const ISSUANCE_UI_POLICY_RETRY_COUNT = 2;
export const ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS = 300;

/**
 * The policy applied when the document cannot be used: unreachable after retries, timed out,
 * malformed, or with nothing to say about this tenant.
 *
 * EMPTY, i.e. fail-closed — nothing is offered. It is paired with
 * `IssuanceUiPolicyService.loadFailed()`, so the screen can tell "this tenant issues nothing
 * from the UI" (an empty policy the document actually declares) from "the catalogue could not
 * be loaded" (this), and shows an error instead of a bare empty selector.
 *
 * The alternative — falling back to everything this build can render — would let a tenant see
 * a form for a credential its policy withholds, precisely when the platform is least able to
 * notice. A blank screen with an explanation is the better failure.
 */
export const DEFAULT_ISSUANCE_UI_POLICY: IssuanceUiPolicy = Object.freeze({
  allowedCredentials: Object.freeze([]),
});
