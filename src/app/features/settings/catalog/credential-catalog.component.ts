import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { CredentialCatalogEntry } from './catalog.models';
import { CredentialCatalogService } from './credential-catalog.service';

/**
 * CredentialCatalogComponent (EUD-72, US-02)
 *
 * Lets a tenant administrator pick which credential types their organization may issue.
 * Reads and writes `/admin/v1/credential-catalog` (replace-all semantics).
 *
 * Authorization is deliberately handled here and not left to `settingsGuard`: the guard
 * checks `hasPower('CredentialIssuer','Configure')`, a power the Issuer API never reads,
 * so passing it does not imply the API will accept the caller. `roleType` — resolved by
 * the backend via `GET /api/v1/me` — is the source of truth (see `auth.service.ts`), and
 * the 403 state stays as defence in depth.
 */
@Component({
  selector: 'app-credential-catalog',
  imports: [MatButton, MatSlideToggle, SkeletonLoaderComponent, TranslatePipe],
  templateUrl: './credential-catalog.component.html',
  styleUrl: './credential-catalog.component.scss'
})
export class CredentialCatalogComponent implements OnInit {
  public readonly loading = signal(true);
  public readonly saving = signal(false);
  /** Initial GET failed for a reason other than 403 — the list cannot be rendered. */
  public readonly loadError = signal(false);
  /**
   * PUT failed. Kept separate from `loadError` on purpose: a failed save must NOT replace
   * the list, or the admin would lose every toggle they had just changed.
   */
  public readonly saveError = signal(false);
  /** The API rejected the caller (403). Not reachable through the guard alone. */
  public readonly forbidden = signal(false);
  public readonly entries = signal<CredentialCatalogEntry[]>([]);

  /** Last persisted state, used to tell whether there is anything to save. */
  private readonly baseline = signal<CredentialCatalogEntry[]>([]);

  private readonly authService = inject(AuthService);
  private readonly catalogService = inject(CredentialCatalogService);

  /**
   * Compared as sets of enabled ids rather than positionally: the backend sorts the
   * response by `displayName`, but the UI should not depend on that ordering.
   */
  public readonly hasChanges = computed(() => {
    const current = this.enabledIdsOf(this.entries());
    const original = this.enabledIdsOf(this.baseline());
    if (current.size !== original.size) return true;
    return [...current].some(id => !original.has(id));
  });

  /**
   * EC-01: saving with every toggle off sends an empty set, which makes the backend drop
   * the tenant configuration and re-enable *all* types. The admin must be warned that this
   * does not block issuance.
   */
  public readonly showEmptyWarning = computed(() =>
    this.entries().length > 0 && this.entries().every(e => !e.enabled)
  );

  /** False for the platform-tenant SysAdmin: reads the catalog, cannot save it. */
  public readonly canWrite = computed(() => this.authService.roleType() !== RoleType.SYSADMIN_READONLY);

  public ngOnInit(): void {
    this.load();
  }

  public load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.saveError.set(false);
    this.forbidden.set(false);

    this.catalogService.getCatalog()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.entries.set(list.map(e => ({ ...e })));
          this.baseline.set(list.map(e => ({ ...e })));
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 403) {
            this.forbidden.set(true);
          } else {
            this.loadError.set(true);
          }
        }
      });
  }

  public toggleEntry(entry: CredentialCatalogEntry, enabled: boolean): void {
    this.saveError.set(false);
    this.entries.update(list =>
      list.map(e =>
        e.credentialConfigurationId === entry.credentialConfigurationId ? { ...e, enabled } : e
      )
    );
  }

  public save(): void {
    if (!this.hasChanges() || this.saving() || !this.canWrite()) return;

    const enabledIds = this.entries()
      .filter(e => e.enabled)
      .map(e => e.credentialConfigurationId);

    this.saving.set(true);
    this.saveError.set(false);

    this.catalogService.updateCatalog(enabledIds)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.baseline.set(this.entries().map(e => ({ ...e }))),
        error: () => this.saveError.set(true)
      });
  }

  private enabledIdsOf(list: CredentialCatalogEntry[]): Set<string> {
    return new Set(list.filter(e => e.enabled).map(e => e.credentialConfigurationId));
  }
}
