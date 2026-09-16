import { TestBed } from '@angular/core/testing';
import { IssuanceHolderKeyService } from './issuance-holder-key.service';
import { KeyGeneratorService } from './key-generator.service';
import { HolderPrivateKeyStore } from 'src/app/core/services/holder-private-key-store.service';
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';
import { HolderKeyGenerationError } from 'src/app/core/models/entity/holder-key-generation-error';

describe('IssuanceHolderKeyService', () => {
  let service: IssuanceHolderKeyService;
  let keyGenerator: KeyGeneratorService;
  let privateKeyStore: HolderPrivateKeyStore;
  let holderKeyStore: HolderKeyStoreService;

  const CONFIG_ID = 'learcredential.machine.w3c.3';
  const SUBMISSION_ID = 'submission-1';

  const mockPublicJwk = { kty: 'EC' as const, crv: 'P-256' as const, x: 'x-coord', y: 'y-coord' };
  const mockPrivateHex = '0xdeadbeef';
  const mockDidKey = 'did:key:zTest';

  /** Fills KeyGeneratorService's state as if generateP256() had run its full WebCrypto pipeline. */
  function stubSuccessfulGeneration(): jest.SpyInstance {
    return jest.spyOn(keyGenerator, 'generateP256').mockImplementation(async () => {
      keyGenerator.updateState('desmosPrivateKeyValue', mockPrivateHex);
      keyGenerator.updateState('desmosDidKeyValue', mockDidKey);
      // Only reachable via the private setPublicJwk(), so this reaches into the same state signal.
      (keyGenerator as any).setPublicJwk(mockPublicJwk);
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IssuanceHolderKeyService, KeyGeneratorService, HolderPrivateKeyStore, HolderKeyStoreService],
    });

    service = TestBed.inject(IssuanceHolderKeyService);
    keyGenerator = TestBed.inject(KeyGeneratorService);
    privateKeyStore = TestBed.inject(HolderPrivateKeyStore);
    holderKeyStore = TestBed.inject(HolderKeyStoreService);
  });

  afterEach(() => jest.restoreAllMocks());

  // ES-09's console.error is asserted on explicitly in its own describe block; everywhere else it
  // is just expected noise from the failure path and would otherwise clutter the test output.
  function silenceConsoleError(): jest.SpyInstance {
    return jest.spyOn(console, 'error').mockImplementation(() => {});
  }

  describe('generateForSubmission() success', () => {
    it('returns a HolderBinding with the did:key and public JWK (mandatee.id consumer)', async () => {
      stubSuccessfulGeneration();

      const binding = await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID);

      expect(binding).toEqual({ didKey: mockDidKey, publicJwk: mockPublicJwk });
    });

    it('writes the public JWK to HolderKeyStoreService (holder_key.jwk consumer)', async () => {
      stubSuccessfulGeneration();

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID);

      expect(holderKeyStore.peek()).toEqual(mockPublicJwk);
    });

    it('seals the private hex into HolderPrivateKeyStore, sealed to this exact attempt (store consumer)', async () => {
      stubSuccessfulGeneration();

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID);

      const entry = privateKeyStore.take();
      expect(entry).toEqual({
        privateKeyHex: mockPrivateHex,
        credentialConfigurationId: CONFIG_ID,
        submissionId: SUBMISSION_ID,
      });
    });

    it('clears KeyGeneratorService state in the same tick the promise resolves (NFR-S-EUD168-04(a))', async () => {
      stubSuccessfulGeneration();
      const clearStateSpy = jest.spyOn(keyGenerator, 'clearState');

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID);

      expect(clearStateSpy).toHaveBeenCalledTimes(1);
      expect(keyGenerator.getState()()).toBeUndefined();
    });
  });

  describe('generateForSubmission() failure (ES-09, AD-15)', () => {
    function stubFailedGeneration(cause: Error): jest.SpyInstance {
      return jest.spyOn(keyGenerator, 'generateP256').mockRejectedValue(cause);
    }

    it('throws a typed HolderKeyGenerationError, never the raw cause', async () => {
      silenceConsoleError();
      stubFailedGeneration(new DOMException('no crypto', 'NotSupportedError'));

      await expect(service.generateForSubmission(CONFIG_ID, SUBMISSION_ID))
        .rejects.toBeInstanceOf(HolderKeyGenerationError);
    });

    it('preserves the original cause on the thrown error, without exposing it as ES-04\'s surface', async () => {
      silenceConsoleError();
      const cause = new DOMException('no crypto', 'NotSupportedError');
      stubFailedGeneration(cause);

      try {
        await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID);
        fail('expected generateForSubmission to reject');
      } catch (error) {
        expect((error as Error).cause).toBe(cause);
      }
    });

    it('emits exactly one console.error with the four closed AD-15 fields, nothing else', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      stubFailedGeneration(new DOMException('no crypto', 'NotSupportedError'));

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID).catch(() => {});

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [loggedArg] = errorSpy.mock.calls[0];
      expect(loggedArg).toEqual({
        event: 'holder_key_generation_failed',
        credentialConfigurationId: CONFIG_ID,
        submissionId: SUBMISSION_ID,
        cause: 'NotSupportedError',
      });
    });

    it('never logs key material, form data, the response body, or the stack (R-7, AD-15)', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      stubFailedGeneration(new DOMException('no crypto', 'NotSupportedError'));

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID).catch(() => {});

      const [loggedArg] = errorSpy.mock.calls[0];
      expect(Object.keys(loggedArg).sort()).toEqual(
        ['cause', 'credentialConfigurationId', 'event', 'submissionId'].sort()
      );
    });

    it('still clears KeyGeneratorService state on failure (defense in depth)', async () => {
      silenceConsoleError();
      const clearStateSpy = jest.spyOn(keyGenerator, 'clearState');
      stubFailedGeneration(new Error('boom'));

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID).catch(() => {});

      expect(clearStateSpy).toHaveBeenCalledTimes(1);
    });

    it('never seals a private-key entry on failure', async () => {
      silenceConsoleError();
      stubFailedGeneration(new Error('boom'));

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID).catch(() => {});

      expect(privateKeyStore.take()).toBeUndefined();
    });

    it('handles a non-Error rejection with a stable "UnknownError" cause discriminant', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(keyGenerator, 'generateP256').mockRejectedValue('not an Error instance');

      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID).catch(() => {});

      const [loggedArg] = errorSpy.mock.calls[0];
      expect(loggedArg.cause).toBe('UnknownError');
    });
  });

  describe('clear()', () => {
    it('clears the generator state, the sealed private entry, and the public JWK store', async () => {
      stubSuccessfulGeneration();
      await service.generateForSubmission(CONFIG_ID, SUBMISSION_ID);
      // Re-seed the private store post-generation, since generateForSubmission's own take() in the
      // test above already drained it in a different test -- here we assert clear()'s own effect.
      privateKeyStore.set({ privateKeyHex: mockPrivateHex, credentialConfigurationId: CONFIG_ID, submissionId: SUBMISSION_ID });

      service.clear();

      expect(keyGenerator.getState()()).toBeUndefined();
      expect(privateKeyStore.take()).toBeUndefined();
      expect(holderKeyStore.peek()).toBeUndefined();
    });
  });
});
