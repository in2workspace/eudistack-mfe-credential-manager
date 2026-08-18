import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_ISSUANCE_UI_POLICY } from '../constants/issuance-ui-policy.constants';
import { policyAllowsConfiguration } from '../helpers/issuance-ui-policy';
import { IssuanceUiPolicy } from '../models/issuance-ui-policy.model';
import { loadIssuanceUiPolicy } from './issuance-ui-policy.loader';
import { TenantService } from './tenant.service';
import { ToastService } from './toast.service';

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
 * issuance form offers nothing and says why, instead of showing a bare empty selector, and
 * the operator gets one explanatory notice per session. The retries live in the loader
 * precisely because that outcome is expensive for the tenant.
 *
 * The resolution of a page load is FINAL. There is no background retry that re-applies a late
 * answer once the bootstrap has settled: a type selector that changes under the user's pointer
 * is worse than a deterministic one (EUD-217 AD-4/EC-03).
 */
@Injectable({ providedIn: 'root' })
export class IssuanceUiPolicyService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  /**
   * sessionStorage key for "the operator has already been told about this".
   *
   * Scoped to the session and not to the page load on purpose: the OIDC round trip is a full
   * page reload, so a per-load notice announced the same failure again right after login.
   * Versioned so a future change of what is stored does not need to read an old entry.
   */
  private static readonly NOTICE_KEY = 'eudistack_issuance_policy_notice_v1';

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
    this.loadPromise ??= this.doLoad();
    return this.loadPromise;
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
      this.failClosed();
    } catch (err) {
      console.error('[IssuanceUiPolicy] Could not load the published policy. Issuance forms are disabled.', err);
      this.failClosed();
    }
  }

  private failClosed(): void {
    this._loadFailed.set(true);
    this.announceOncePerSession();
  }

  /**
   * Tells the operator what is actually going on, once.
   *
   * The failure has a real consequence — no new credential can be issued — and it is not
   * something the user caused or can fix, so it earns one clear explanation rather than a
   * generic error on every page load. The issuance screen keeps its own message for whoever
   * walks into the form later in the session.
   *
   * `translate.get` rather than `instant`: this runs while the theme (and with it the
   * language bundle) may still be loading, and `instant` would print the key.
   */
  private announceOncePerSession(): void {
    try {
      if (sessionStorage.getItem(IssuanceUiPolicyService.NOTICE_KEY)) {
        return;
      }
      sessionStorage.setItem(IssuanceUiPolicyService.NOTICE_KEY, '1');
    } catch {
      // sessionStorage unavailable (private browsing quota, etc.): announce anyway. Falling
      // silent would be worse than repeating it on a later page load.
    }

    this.translate
      .get('error.issuance_catalog_unavailable')
      .subscribe((message: string) => this.toast.warning(message));
  }
}
