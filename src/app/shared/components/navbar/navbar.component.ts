import { Component, DestroyRef, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';
import { MatIcon } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private readonly destroyRef = inject(DestroyRef);

  public ngOnInit() {
    this.logoSrc = this.themeService.snapshot?.branding?.logoUrl ?? null;

    // NavbarComponent lives in the root app.component and mounts before
    // checkAuth$() resolves (esp. on a hard page reload), so a one-shot
    // take(1) can capture the still-empty mandator/name and never update.
    // Subscribe for the component's lifetime instead, so the button appears
    // once AuthService actually populates these BehaviorSubjects.
    this.authService.getMandator()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(mandator => {
        if (mandator) {
          this.organization = mandator.organization
        }
      })
    this.authService.getName()
      .pipe(takeUntilDestroyed(this.destroyRef))
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
   * Gates the "Settings" entry of the user menu. Deliberately the same predicate as
   * `settingsGuard` (`PoliciesService.checkSettingsPolicy`) and
   * `SettingsComponent.canSeeCatalog`, so the menu never offers a destination the
   * guard would reject — the discrepancy this used to carry is what kept tenant
   * admins out of Settings (EUD-72 §2.3/§7.2).
   *
   * No separate "role resolved" flag is needed: `roleType()` reports LEAR until
   * `GET /api/v1/me` answers, which already evaluates to false here. The entry
   * therefore appears one round trip after login — invisible in practice, since it
   * lives inside a click-triggered `mat-menu`.
   */
  public readonly canSeeSettings = computed(() => this.authService.roleType() !== RoleType.LEAR);

  //currently not used
  public changeLanguage(languageCode: string): void {
    this.translate.use(languageCode);
    this.selectedLanguage = languageCode;
  }
}
