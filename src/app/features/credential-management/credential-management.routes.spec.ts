import routes from './credential-management.routes';
import { CredentialManagementComponent } from './credential-management.component';

describe('Credential Management Routes', () => {
  it('serves the credential list at the feature root', () => {
    expect(routes).toHaveLength(1);

    const rootRoute = routes.find(r => r.path === '');
    expect(rootRoute).toBeTruthy();
    expect(rootRoute!.component).toBe(CredentialManagementComponent);
  });

  it('no longer exposes a standalone details page — the drawer replaced it', () => {
    expect(routes.some(r => r.path?.startsWith('details'))).toBe(false);
  });
});
