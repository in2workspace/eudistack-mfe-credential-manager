import { Routes } from '@angular/router';
import { AutoLoginPartialRoutesGuard } from 'angular-auth-oidc-client';
import { basicGuard, settingsGuard } from './core/guards/accessLevel.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { TenantNotFoundComponent } from './features/tenant-not-found/tenant-not-found.component';

export const routes: Routes = [
  { path: 'tenant-not-found', component: TenantNotFoundComponent },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    canActivate: [tenantGuard],
    loadChildren: () => import('./features/home/home.routes').then(m => m.default)
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.default),
    canActivate: [tenantGuard, AutoLoginPartialRoutesGuard, settingsGuard],
  },
  {
    path: 'organization/credentials',
    canActivate: [tenantGuard],
    canActivateChild: [AutoLoginPartialRoutesGuard, basicGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/credential-management/credential-management.routes').then(m => m.default)
      },
      {
        path: 'details',
        loadChildren: () => import('./features/credential-details/credential-details.routes').then(m => m.default)
      },
      {
        path: 'create',
        loadChildren: () => import('./features/credential-issuance/credential-issuance.routes').then(m => m.default)
      },
      {
        path: 'create-on-behalf',
        loadChildren: () => import('./features/credential-issuance/credential-issuance.routes').then(m => m.default)
      },
    ],
  },
  {
    path: 'credential-offer',
    canActivate: [tenantGuard],
    loadChildren: () =>
      import('./features/credential-offer/credential-offer.routes').then(
        (m) => m.default
      ),
  },
  { path: '**', redirectTo: 'home' }
];
