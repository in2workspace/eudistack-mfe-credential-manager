import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { CanComponentDeactivate, CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { guardUnloadWhileUnsaved, UnsavedChangesService } from 'src/app/shared/services/unsaved-changes.service';
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
export class CredentialCatalogComponent implements OnInit, CanComponentDeactivate {
  public readonly loading = signal(true);
  public readonly saving = signal(false);
  /** Initial GET failed for a reason other than 403/404 — the list cannot be rendered. */
  public readonly loadError = signal(false);
  /**
   * PUT failed. Kept separate from `loadError` on purpose: a failed save must NOT replace
   * the list, or the admin would lose every toggle they had just changed.
   */
  public readonly saveError = signal(false);
  /** The API rejected the caller (403). Not reachable through the guard alone. */
  public readonly forbidden = signal(false);
  /** The tenant has no credential type configured at all (404, or an empty list). */
  public readonly notConfigured = signal(false);
  public readonly entries = signal<CredentialCatalogEntry[]>([]);

  /** Last persisted state, used to tell whether there is anything to save. */
  private readonly baseline = signal<CredentialCatalogEntry[]>([]);

  private readonly authService = inject(AuthService);
  private readonly catalogService = inject(CredentialCatalogService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly translate = inject(TranslateService);
  private readonly unsavedChanges = inject(UnsavedChangesService);

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
   * the tenant configuration and re-enable *all* types — the opposite of what switching
   * everything off looks like. Saving is blocked instead (see `canSave`), and this warns why.
   */
  public readonly showEmptyWarning = computed(() =>
    this.entries().length > 0 && this.entries().every(e => !e.enabled)
  );

  /** False for the platform-tenant SysAdmin: reads the catalog, cannot save it. */
  public readonly canWrite = computed(() => this.authService.roleType() !== RoleType.SYSADMIN_READONLY);

  public readonly canSave = computed(() =>
    this.canWrite() && this.hasChanges() && !this.saving() && !this.showEmptyWarning()
  );

  public constructor() {
    guardUnloadWhileUnsaved(() => this.hasChanges());
  }

  public ngOnInit(): void {
    this.load();
  }

  /** Router guard hook: pending toggles are only in memory until the PUT succeeds. */
  public canDeactivate(): CanDeactivateType {
    return this.unsavedChanges.canDeactivate(this.hasChanges());
  }

  public load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.saveError.set(false);
    this.forbidden.set(false);
    this.notConfigured.set(false);

    this.catalogService.getCatalog()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.applyCatalog(list),
        error: (error: HttpErrorResponse) => this.applyLoadError(error)
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
    if (!this.canSave()) return;

    const enabledIds = this.entries()
      .filter(e => e.enabled)
      .map(e => e.credentialConfigurationId);

    this.saving.set(true);
    this.saveError.set(false);

    /**
     * Tells a failed PUT apart from a failed reload: the first must keep the edited toggles
     * so nothing is lost, the second must not claim the save failed — it did not.
     */
    let persisted = false;

    this.catalogService.updateCatalog(enabledIds)
      .pipe(
        tap(() => { persisted = true; }),
        // The response never echoes the stored set, so re-reading is the only way for the
        // list to show what was actually persisted.
        switchMap(() => this.catalogService.getCatalog()),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: (list) => this.applyCatalog(list),
        error: (error: HttpErrorResponse) => {
          if (persisted) {
            // Saved, but the state on screen can no longer be trusted: fall back to the
            // load-error state, which offers a retry, instead of showing a stale list.
            this.applyLoadError(error);
          } else {
            this.saveError.set(true);
          }
        }
      });
  }

  private applyCatalog(list: CredentialCatalogEntry[]): void {
    // An empty registry is not an empty selection: there is nothing for the admin to act on,
    // and no toggle can bring the screen back. Treated exactly like the 404.
    if (list.length === 0) {
      this.applyNotConfigured();
      return;
    }

    this.notConfigured.set(false);
    this.entries.set(list.map(e => ({ ...e })));
    this.baseline.set(list.map(e => ({ ...e })));
  }

  private applyLoadError(error: HttpErrorResponse): void {
    if (error.status === 403) {
      this.forbidden.set(true);
    } else if (error.status === 404) {
      this.applyNotConfigured();
    } else {
      this.loadError.set(true);
    }
  }

  /** Nothing to configure: the admin cannot fix this themselves, so point them at support. */
  private applyNotConfigured(): void {
    this.entries.set([]);
    this.baseline.set([]);
    this.notConfigured.set(true);
    this.dialog.openErrorInfoDialog(
      DialogComponent,
      this.translate.instant('catalog.error.not-configured.description'),
      this.translate.instant('catalog.error.not-configured.title')
    );
  }

  private enabledIdsOf(list: CredentialCatalogEntry[]): Set<string> {
    return new Set(list.filter(e => e.enabled).map(e => e.credentialConfigurationId));
  }
}
