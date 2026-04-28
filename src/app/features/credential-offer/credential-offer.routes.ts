import { Routes } from '@angular/router';
import { CredentialOfferStepperComponent } from './credential-offer-stepper/credential-offer-stepper.component';

export default [
  {
    path: '',
    component: CredentialOfferStepperComponent
  },
  {
    path: 'refresh/:token',
    loadComponent: () =>
      import('./credential-offer-refresh/credential-offer-refresh.component').then(
        (m) => m.CredentialOfferRefreshComponent
      )
  }
] as Routes;
