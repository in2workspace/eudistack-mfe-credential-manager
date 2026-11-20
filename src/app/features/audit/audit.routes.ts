import { Routes } from '@angular/router';
import { auditAccessGuard } from './audit-access.guard';

export default [
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./audit-access-denied/audit-access-denied.component').then(m => m.AuditAccessDeniedComponent)
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [auditAccessGuard],
    loadComponent: () => import('./audit.component').then(m => m.AuditComponent)
  },
] as Routes;
