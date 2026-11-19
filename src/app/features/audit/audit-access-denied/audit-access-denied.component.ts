import { Component } from '@angular/core';
import { MatAnchor } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Notice for whoever reaches `/audit` without the power to read the audit (EUD-293, FR-01).
 * It makes no request: the section is never queried for them.
 */
@Component({
  selector: 'app-audit-access-denied',
  imports: [MatAnchor, RouterLink, TranslatePipe],
  templateUrl: './audit-access-denied.component.html',
  styleUrl: './audit-access-denied.component.scss'
})
export class AuditAccessDeniedComponent {}
