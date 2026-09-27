import { TestBed } from '@angular/core/testing';
import { HolderKeyStoreService, HolderPublicKeyEntry } from './holder-key-store.service';
import { HolderPublicJwk } from '../models/entity/lear-credential-issuance';

describe('HolderKeyStoreService', () => {

  let service: HolderKeyStoreService;

  const jwk: HolderPublicJwk = { kty: 'EC', crv: 'P-256', x: 'x-coord', y: 'y-coord' };
  const otherJwk: HolderPublicJwk = { kty: 'EC', crv: 'P-256', x: 'other-x', y: 'other-y' };
  const entry: HolderPublicKeyEntry = { publicJwk: jwk, credentialConfigurationId: 'config-1', submissionId: 'submission-1' };
  const otherEntry: HolderPublicKeyEntry = { publicJwk: otherJwk, credentialConfigurationId: 'config-2', submissionId: 'submission-2' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HolderKeyStoreService] });
    service = TestBed.inject(HolderKeyStoreService);
  });

  it('returns nothing before anything is stored', () => {
    expect(service.peek()).toBeUndefined();
  });

  it('returns what was stored, sealed', () => {
    service.set(entry);

    expect(service.peek()).toEqual(entry);
  });

  /**
   * code-review L508: peek() must not drain the store -- a caller that has not yet confirmed
   * whether its request succeeded (an HTTP failure, or a 207 channel error) needs the same key
   * still there for the retry.
   */
  it('does not clear on read, so a pending attempt can read the same key again', () => {
    service.set(entry);

    expect(service.peek()).toEqual(entry);
    expect(service.peek()).toEqual(entry);
  });

  it('keeps only the most recently generated entry', () => {
    service.set(entry);
    service.set(otherEntry);

    expect(service.peek()).toEqual(otherEntry);
  });

  it('clear() discards the stored entry', () => {
    service.set(entry);

    service.clear();

    expect(service.peek()).toBeUndefined();
  });
});
