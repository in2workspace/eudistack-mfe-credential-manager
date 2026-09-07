import { TestBed } from '@angular/core/testing';
import { HolderKeyStoreService } from './holder-key-store.service';
import { HolderPublicJwk } from '../models/entity/lear-credential-issuance';

describe('HolderKeyStoreService', () => {

  let service: HolderKeyStoreService;

  const jwk: HolderPublicJwk = { kty: 'EC', crv: 'P-256', x: 'x-coord', y: 'y-coord' };
  const otherJwk: HolderPublicJwk = { kty: 'EC', crv: 'P-256', x: 'other-x', y: 'other-y' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HolderKeyStoreService] });
    service = TestBed.inject(HolderKeyStoreService);
  });

  it('returns nothing before anything is stored', () => {
    expect(service.peek()).toBeUndefined();
  });

  it('returns what was stored', () => {
    service.set(jwk);

    expect(service.peek()).toEqual(jwk);
  });

  /**
   * code-review L508: peek() must not drain the store -- a caller that has not yet confirmed
   * whether its request succeeded (an HTTP failure, or a 207 channel error) needs the same key
   * still there for the retry.
   */
  it('does not clear on read, so a pending attempt can read the same key again', () => {
    service.set(jwk);

    expect(service.peek()).toEqual(jwk);
    expect(service.peek()).toEqual(jwk);
  });

  it('keeps only the most recently generated key', () => {
    service.set(jwk);
    service.set(otherJwk);

    expect(service.peek()).toEqual(otherJwk);
  });

  it('clear() discards the stored key', () => {
    service.set(jwk);

    service.clear();

    expect(service.peek()).toBeUndefined();
  });
});
