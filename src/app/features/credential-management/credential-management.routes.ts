import { Routes } from '@angular/router';
import { CredentialManagementComponent } from './credential-management.component';
import { CredentialDetailsComponent } from '../credential-details/credential-details.component';
import { ArchivedCredentialsComponent } from './archived-credentials/archived-credentials.component';

export default [
  {
    path: '',
    component: CredentialManagementComponent,
  },
  {
    path: 'archived',
    component: ArchivedCredentialsComponent,
  },
  {
    path: 'details/:id',
    component: CredentialDetailsComponent,
  },
] as Routes;
