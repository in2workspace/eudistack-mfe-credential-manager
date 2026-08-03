import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { Observable, of, switchMap, take, map } from 'rxjs';
import { TmfAction, TmfFunction } from '../models/entity/lear-credential';
import { RoleType } from '../models/enums/auth-rol-type.enum';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';

@Injectable({
  providedIn: 'root'
})
export class PoliciesService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogWrapperService);
  private readonly translate = inject(TranslateService);

  private executePolicy(tmfFunction: TmfFunction, action: TmfAction, redirectUrl: string, authFlag: boolean = false): Observable<boolean> {
    if (this.authService.isSysAdmin() || this.authService.hasPower(tmfFunction, action)) {
      return of(true);
    }
    return this.denyAndRedirect(redirectUrl, authFlag);
  }

  /** Shows the "Access Denied" dialog, then redirects and resolves to false. */
  private denyAndRedirect(redirectUrl: string, authFlag: boolean): Observable<boolean> {
    console.error('Access denied by policy.');
    const errorTitle = this.translate.instant(`error.policy.title`);
    const errorMessage = this.translate.instant(`error.policy.message`);

    const dialogRef = this.dialog.openErrorInfoDialog(DialogComponent, errorMessage, errorTitle);
    return dialogRef.afterClosed().pipe(
      take(1),
      switchMap(() => { if (authFlag) { this.authService.logout(); } return of(null); }),
      switchMap(() => this.router.navigate([redirectUrl])),
      map(() => false)
    );
  }

  public checkOnboardingPolicy(): Observable<boolean> {
    return this.executePolicy('Onboarding', 'Execute', '/home', true);
  }

  /**
   * Gates `/settings`. Asks the backend who the caller is (`GET /api/v1/me` via
   * `resolveRole$()`) instead of checking a TMF power, because the Issuer API
   * resolves administrators from `Onboarding/Execute` + `admin_organization_id`
   * (TenantAdmin) or `System/Administration` (SysAdmin) and **never reads
   * `CredentialIssuer/Configure`** — the power this guard used to require.
   *
   * That mismatch locked genuine tenant admins out of Settings (and therefore
   * out of the credential catalog) while letting a LEAR holding the unused power
   * through to a screen the API would answer with 403. See EUD-72 §2.3/§7.2.
   *
   * `roleType() !== LEAR` is the same predicate as `SettingsComponent.canSeeCatalog`
   * and the navbar entry, so menu, guard and API now agree. `isSysAdmin()` stays as
   * a token-based fallback for the case where `/me` fails and defaults to LEAR.
   */
  public checkSettingsPolicy(): Observable<boolean> {
    return this.authService.resolveRole$().pipe(
      switchMap(role =>
        role !== RoleType.LEAR || this.authService.isSysAdmin()
          ? of(true)
          : this.denyAndRedirect('/organization/credentials', false)
      )
    );
  }
}
