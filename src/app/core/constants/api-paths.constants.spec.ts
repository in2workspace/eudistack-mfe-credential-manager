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
