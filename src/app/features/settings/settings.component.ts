import { Component, computed, inject } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet, RouterLink,  RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
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
   * 403 on both verbs. `roleType` mirrors the backend's own verdict (`GET /api/v1/me`), so
   * it is the only reliable signal here — `settingsGuard` checks a power the API ignores.
   *
   * The platform-tenant SysAdmin (`SYSADMIN_READONLY`) does see the link: reads are allowed,
   * and the screen renders in read-only mode.
   */
  public readonly canSeeCatalog = computed(() => this.authService.roleType() !== RoleType.LEAR);
}
