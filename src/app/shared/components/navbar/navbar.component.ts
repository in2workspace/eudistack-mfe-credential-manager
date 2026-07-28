import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { MatIcon } from '@angular/material/icon';
import { take } from 'rxjs';
import {MatMenuModule} from '@angular/material/menu';
import {MatButtonModule} from '@angular/material/button';
import { ThemeService } from 'src/app/core/services/theme.service';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss'],
    imports: [RouterLink, MatIcon, MatMenuModule, MatButtonModule, TranslatePipe]
})
export class NavbarComponent implements OnInit {
  public userName: string = '';
  public organization: string = '';
  public selectedLanguage = 'en';
  public isMenuOpen:boolean = false;
  public logoSrc: string | null = null;

  private readonly themeService = inject(ThemeService);

  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);

  public ngOnInit() {
    this.logoSrc = this.themeService.snapshot?.branding?.logoUrl ?? null;

    this.authService.getMandator()
      .pipe(take(1))
      .subscribe(mandator => {
        if (mandator) {
          this.organization = mandator.organization
        }
      })
    this.authService.getName()
      .pipe(take(1))
      .subscribe(name => {
        if (name) {
          this.userName = name;
        }
      });
  }

  public logout() {
    this.authService.logout();
  }

  /**
   * Gates the "Settings" entry of the user menu.
   *
   * KNOWN DISCREPANCY (documented in EUD-72, kept as-is on purpose — realignment pending
   * its own ticket):
   *  1. The Issuer API never reads the `CredentialIssuer/Configure` power. Backend roles come
   *     from `Onboarding/Execute` + `admin_organization_id` (TenantAdmin) or
   *     `System/Administration` (SysAdmin) — see `AccessTokenServiceImpl.resolveRole()`.
   *     Passing this check therefore says nothing about what the API will allow.
   *  2. This check is stricter than `settingsGuard`, which also accepts `isSysAdmin()`. A pure
   *     SysAdmin cannot see this entry yet can reach `/settings` by URL.
   *
   * Screens inside `/settings` that the API actually gates by role must not rely on this;
   * they read `AuthService.roleType()` (backed by `GET /api/v1/me`) instead — see
   * `SettingsComponent.canSeeCatalog` and `CredentialCatalogComponent`.
   */
  public isCredentialIssuerAndConfigure():boolean {
    if(this.authService.hasPower('CredentialIssuer', 'Configure')) return true;
    return false;
  }

  //currently not used
  public changeLanguage(languageCode: string): void {
    this.translate.use(languageCode);
    this.selectedLanguage = languageCode;
  }
}
