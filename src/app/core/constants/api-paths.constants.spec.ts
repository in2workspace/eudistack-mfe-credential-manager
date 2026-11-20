import { API_PATH } from './api-paths.constants';

// EUD-233 task 6 (R-2 guard): the settings spec derives its expected URL from API_PATH.CREDENTIAL_CATALOG
// itself, so it cannot catch a regression of the constant's own value. This test hardcodes the literal
// path on purpose: a merge/rebase that reintroduces the pre-EUD-169 '/admin/v1/credential-catalog'
// route would 404 the whole tenant catalogue read for every tenant (catalogue state 4, ES-08) without
// this failing loudly first.
describe('API_PATH.CREDENTIAL_CATALOG', () => {

  it('points at the post-EUD-169 backoffice route, not the retired /admin one', () => {
    expect(API_PATH.CREDENTIAL_CATALOG).toBe('/api/v1/backoffice/credential-catalog');
  });
});

// EUD-293: the audit API lives next to the page, under `/audit`; the interceptor and `TenantService.auditUrl`
// both derive from these, so their literal values are pinned here.
describe('API_PATH audit paths', () => {

  it('serves the audit API under /audit, at /api/v1/events', () => {
    expect(API_PATH.AUDIT_BASE).toBe('/audit');
    expect(API_PATH.AUDIT_EVENTS).toBe('/api/v1/events');
  });
});
