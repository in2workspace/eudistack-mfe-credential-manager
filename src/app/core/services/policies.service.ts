import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { Observable, filter, map, of, switchMap, take } from 'rxjs';
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

  /**
   * Waits for AuthService's initial authentication check to complete.
   */
  private waitForAuthCheck(): Observable<boolean> {
    return this.authService.authCheckComplete$.pipe(
      filter((complete) => complete),
      take(1)
    );
  }

  /**
   * Waits for authentication initialization before evaluating TMF powers.
   */
  private executePolicy(
    tmfFunction: TmfFunction,
    action: TmfAction,
    redirectUrl: string,
    authFlag: boolean = false
  ): Observable<boolean> {
    return this.waitForAuthCheck().pipe(
      switchMap(() => {
        if (
          this.authService.isSysAdmin() ||
          this.authService.hasPower(tmfFunction, action)
        ) {
          return of(true);
        }

        return this.denyAndRedirect(redirectUrl, authFlag);
      })
    );
  }

  /**
   * Shows the access-denied dialog, redirects and resolves to false.
   */
  private denyAndRedirect(
    redirectUrl: string,
    authFlag: boolean
  ): Observable<boolean> {
    console.error('User with required permissions was not found.');

    const errorTitle = this.translate.instant('error.policy.title');
    const errorMessage = this.translate.instant('error.policy.message');

    const dialogRef = this.dialog.openErrorInfoDialog(
      DialogComponent,
      errorMessage,
      errorTitle
    );

    return dialogRef.afterClosed().pipe(
      take(1),
      switchMap(() => {
        if (authFlag) {
          this.authService.logout();
        }

        return this.router.navigate([redirectUrl]);
      }),
      map(() => false)
    );
  }

  public checkOnboardingPolicy(): Observable<boolean> {
    return this.executePolicy('Onboarding', 'Execute', '/home', true);
  }

  /**
   * Gates `/settings`.
   *
   * Waits for the initial authentication check and then asks the backend for
   * the resolved role instead of checking CredentialIssuer/Configure.
   */
  public checkSettingsPolicy(): Observable<boolean> {
    return this.waitForAuthCheck().pipe(
      switchMap(() => this.authService.resolveRole$()),
      switchMap((role) => {
        if (
          role !== RoleType.LEAR ||
          this.authService.isSysAdmin()
        ) {
          return of(true);
        }

        return this.denyAndRedirect(
          '/organization/credentials',
          false
        );
      })
    );
  }
}