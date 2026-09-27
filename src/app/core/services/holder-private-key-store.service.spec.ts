import { TestBed } from '@angular/core/testing';
import { HolderPrivateKeyEntry, HolderPrivateKeyStore } from './holder-private-key-store.service';

describe('HolderPrivateKeyStore', () => {

  let service: HolderPrivateKeyStore;

  const entry: HolderPrivateKeyEntry = {
    privateKeyHex: 'deadbeef',
    credentialConfigurationId: 'learcredential.machine.sd.1',
    submissionId: 'submission-1',
  };

  const otherEntry: HolderPrivateKeyEntry = {
    privateKeyHex: 'c0ffee',
    credentialConfigurationId: 'learcredential.machine.w3c.3',
    submissionId: 'submission-2',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HolderPrivateKeyStore] });
    service = TestBed.inject(HolderPrivateKeyStore);
  });

  it('returns undefined when nothing has been stored', () => {
    expect(service.take()).toBeUndefined();
  });

  it('returns the exact sealed entry that was stored', () => {
    service.set(entry);

    expect(service.take()).toEqual(entry);
  });

  it('clears the slot on take(), so a second read returns undefined', () => {
    service.set(entry);

    service.take();

    expect(service.take()).toBeUndefined();
  });

  it('keeps only the most recently set entry (clear-then-set semantics)', () => {
    service.set(entry);
    service.set(otherEntry);

    expect(service.take()).toEqual(otherEntry);
  });

  it('clear() discards the stored entry without needing take()', () => {
    service.set(entry);

    service.clear();

    expect(service.take()).toBeUndefined();
  });
});
