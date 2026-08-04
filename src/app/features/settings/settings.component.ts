import { Component, computed, inject } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet, RouterLink,  RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
    selector: 'app-settings',
    imports: [TranslatePipe, MatIcon, MatSidenavModule, RouterModule, MatDividerModule, RouterOutlet, RouterLink, MatListModule],
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  opened = true;

  private readonly authService = inject(AuthService);

  /**
   * Credential catalog is a tenant-admin screen (EUD-72): the Issuer rejects a LEAR with
   * 403 on both verbs. Shares `AuthService.canAccessSettings()` with `settingsGuard` and
   * the navbar entry, so this sidenav offers exactly what the guard admits — everyone who
   * got this far can reach the catalog, which is also where `/settings` redirects.
   *
   * The platform-tenant SysAdmin (`SYSADMIN_READONLY`) does see the link: reads are allowed,
   * and the screen renders in read-only mode. So does a SysAdmin known only from the ID
   * token because `/me` failed; the catalog's own 403 state covers them.
   */
  // ! TODO: Disable this temporary override once the backend `/admin` route is available
  public readonly canSeeCatalog = computed(() => false);
  // public readonly canSeeCatalog = computed(() => this.authService.canAccessSettings());
}
