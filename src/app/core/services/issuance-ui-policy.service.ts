import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_ISSUANCE_UI_POLICY } from '../constants/issuance-ui-policy.constants';
import { policyAllowsConfiguration } from '../helpers/issuance-ui-policy';
import { IssuanceUiPolicy } from '../models/issuance-ui-policy.model';
import { loadIssuanceUiPolicy } from './issuance-ui-policy.loader';
import { TenantService } from './tenant.service';

/**
 * Holds the issuance UI policy of the resolved tenant: which credentials this UI offers a form
 * for, out of everything the issuer says the tenant may issue.
 *
 * `load()` is memoized and called from two places: `main.ts` starts it at bootstrap as a
 * WARM-UP, without awaiting it (after `TenantService.resolve()`, which it needs for the
 * tenant), and `CredentialIssuanceService` — the only screen that consumes it — awaits the
 * same promise. So the normal case costs nothing, and a slow or unreachable document delays
 * that one screen rather than the first paint: a tenant whose policy cannot be loaded still
 * reaches its issued credentials immediately, since listing and reading them go through the
 * metadata untouched by this.
 *
 * FAIL-CLOSED. An unusable document leaves the policy empty and raises `loadFailed()`: the
 * issuance form offers nothing and says why, instead of showing a bare empty selector. The
 * retries live in the loader precisely because that outcome is expensive for the tenant.
 *
 * The resolution of a page load is FINAL. There is no background retry that re-applies a late
 * answer once the bootstrap has settled: a type selector that changes under the user's pointer
 * is worse than a deterministic one (EUD-217 AD-4/EC-03).
 */
@Injectable({ providedIn: 'root' })
export class IssuanceUiPolicyService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  /**
   * Seeded with the fail-closed default, so the service is safe to read before — and
   * without — `load()`. Every failure path leaves this value untouched, so there is exactly
   * one definition of "what happens when the document is unusable".
   */
  private readonly _policy = signal<IssuanceUiPolicy>(DEFAULT_ISSUANCE_UI_POLICY);
  readonly policy = this._policy.asReadonly();

  /**
   * True when the published policy could not be applied. Distinguishes a catalogue that could
   * not be loaded from a tenant whose policy legitimately allows nothing — the same
   * distinction the issuance screen already draws for the metadata (EC-04 vs EC-01).
   */
  private readonly _loadFailed = signal<boolean>(false);
  readonly loadFailed = this._loadFailed.asReadonly();

  /** Memoizes the in-flight/completed load, so concurrent callers share one request. */
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    return this.loadPromise ??= this.doLoad();
  }

  /**
   * Whether the UI may offer `configurationId`.
   *
   * Reads the signal, so consumers that call this from a `computed()` recompute by themselves
   * if the policy lands after they first ran.
   */
  allows(configurationId: string): boolean {
    return policyAllowsConfiguration(this._policy(), configurationId);
  }

  /** Never rejects: an unusable source is a flagged fallback, not a broken bootstrap. */
  private async doLoad(): Promise<void> {
    try {
      const published = await firstValueFrom(
        loadIssuanceUiPolicy(this.http, this.tenantService.tenant()),
      );

      if (published) {
        this._policy.set(published);
        this._loadFailed.set(false);
        return;
      }

      // Readable document that says nothing usable about this tenant: worth distinguishing in
      // the log from a transport failure, because an operator fixes it by editing the
      // document, not by looking at the network.
      console.error(
        `[IssuanceUiPolicy] No usable policy published for tenant "${this.tenantService.tenant()}". Issuance forms are disabled.`,
      );
      this._loadFailed.set(true);
    } catch (err) {
      console.error('[IssuanceUiPolicy] Could not load the published policy. Issuance forms are disabled.', err);
      this._loadFailed.set(true);
    }
  }
}
