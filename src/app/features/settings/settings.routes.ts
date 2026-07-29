import { Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { CredentialIssuanceComponent } from '../credential-issuance/components/credential-issuance/credential-issuance.component';

export default [
  { path: '', component: SettingsComponent,
    children: [
        // Without this, /settings renders the sidenav over an empty content pane
        // (EUD-72 §8 O-4). Catalog rather than schemes: schemes is a placeholder
        // reusing the issuance form, and everyone past settingsGuard is non-LEAR,
        // so the catalog link is always available to them.
        { path: '', pathMatch: 'full', redirectTo: 'catalog' },
        { path: 'schemes', component: CredentialIssuanceComponent },
        // Credential catalog (EUD-72). No guard of its own: children inherit the
        // parent's canActivate from app.routes.ts. The API additionally enforces
        // tenant-admin, which settingsGuard does not — the component handles 403.
        {
          path: 'catalog',
          loadComponent: () =>
            import('./catalog/credential-catalog.component').then(
              m => m.CredentialCatalogComponent
            )
        },
      ]
   },
] as Routes;

