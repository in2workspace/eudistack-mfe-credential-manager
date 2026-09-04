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
    expect(service.take()).toBeUndefined();
  });

  it('returns what was stored', () => {
    service.set(jwk);

    expect(service.take()).toEqual(jwk);
  });

  /**
   * The behaviour the store exists for. It is root-provided and therefore outlives the issuance
   * form, so a key left behind would be attached to the next credential issued — binding it to a key
   * that belongs to an earlier one, silently and unrecoverably.
   */
  it('clears on read, so a key cannot be reused by a later issuance', () => {
    service.set(jwk);

    expect(service.take()).toEqual(jwk);
    expect(service.take()).toBeUndefined();
  });

  it('keeps only the most recently generated key', () => {
    service.set(jwk);
    service.set(otherJwk);

    expect(service.take()).toEqual(otherJwk);
  });

  it('clear() discards without reading', () => {
    service.set(jwk);

    service.clear();

    expect(service.take()).toBeUndefined();
  });
});
