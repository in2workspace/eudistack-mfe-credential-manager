import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { KeyGeneratorComponent } from './key-generator.component';
import { KeyGeneratorService } from '../../services/key-generator.service';
import { signal, WritableSignal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { KeyState } from 'src/app/core/models/entity/lear-credential-issuance';
import { FormGroup } from '@angular/forms';
import { CredentialIssuanceService } from '../../services/credential-issuance.service';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';

describe('KeyGeneratorComponent', () => {
  let component: KeyGeneratorComponent;
  let fixture: ComponentFixture<KeyGeneratorComponent>;
  let mockService: Partial<KeyGeneratorService>;
  let rawStateSignal: WritableSignal<KeyState | undefined>;
  let displayedSignal: WritableSignal<Partial<KeyState> | undefined>;
  let mockIssuanceService: Partial<CredentialIssuanceService>;

  beforeEach(async () => {
    rawStateSignal = signal(undefined);
    displayedSignal = signal({ desmosPrivateKeyValue: undefined });
    mockIssuanceService = {
      updateAlertMessages: jest.fn()
    };

    mockService = {
      getState: () => rawStateSignal,
      displayedKeys$: displayedSignal,
      generateP256: jest.fn().mockResolvedValue(undefined),
      clearState: jest.fn(),
    };

    // Stub updateMessages on the prototype to avoid NG0950 "required Input"
    Object.defineProperty(
      KeyGeneratorComponent.prototype,
      'updateMessages',
      {
        configurable: true,
        writable: true,
        value: (_msgs: string[]) => {}
      }
    );

    await TestBed
      .configureTestingModule({
        imports: [KeyGeneratorComponent, TranslateModule.forRoot()]
      })
      .overrideComponent(KeyGeneratorComponent, {
        set: {
          providers: [
            { provide: KeyGeneratorService, useValue: mockService },
            { provide: CredentialIssuanceService, useValue: mockIssuanceService }
          ]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(KeyGeneratorComponent);
    component = fixture.componentInstance;
    jest.spyOn((component as any), 'updateAlertMessages');
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('initially keyState$ and displayedKeys$ come from the service', () => {
    expect(component.keyState$()).toBeUndefined();
    expect(component.displayedKeys$()).toEqual({ desmosPrivateKeyValue: undefined });
  });

  it('ngOnInit should call updateAlertMessages', () => {
    const spy = jest
      .spyOn(component as any, 'updateAlertMessages')
      .mockImplementation(() => {});
    (component as any).ngOnInit();
    expect(spy).toHaveBeenCalled();
  });

  it('updateAlertMessages should delegate to issuance.updateAlertMessages service', () => {
    const msgs = ['error.form.no_key'];
    (component as any).updateAlertMessages(msgs);
    expect((mockIssuanceService.updateAlertMessages as jest.Mock)).toHaveBeenCalledWith(msgs);
  });

  it('generateKeys should call generateP256 and patch the form with the didKey', async () => {
    const fakeState: KeyState = {
      desmosDidKeyValue: 'DID-123',
      desmosPrivateKeyValue: 'PRIV'
    };
    rawStateSignal.set(fakeState);

    const fakeForm = { patchValue: jest.fn() } as unknown as FormGroup<any>;
    Object.defineProperty(component, 'form', {
      configurable: true,
      value: () => fakeForm
    });

    // Stub updateAlertMessages to avoid NG0950
    jest.spyOn(component as any, 'updateAlertMessages').mockImplementation(() => {});

    await component.generateKeys();

    expect(mockService.generateP256).toHaveBeenCalled();
    expect(fakeForm.patchValue).toHaveBeenCalledWith({ didKey: 'DID-123' });
  });

  /** EUD-168 AD-12/AC-17: the public half is the only thing that leaves the widget. */
  it('generateKeys should hand the public JWK to HolderKeyStoreService', async () => {
    const publicJwk = { kty: 'EC' as const, crv: 'P-256' as const, x: 'x-coord', y: 'y-coord' };
    const fakeState: KeyState = {
      desmosDidKeyValue: 'DID-123',
      desmosPrivateKeyValue: 'PRIV',
      desmosPublicJwk: publicJwk
    };
    rawStateSignal.set(fakeState);

    const fakeForm = { patchValue: jest.fn() } as unknown as FormGroup<any>;
    Object.defineProperty(component, 'form', { configurable: true, value: () => fakeForm });
    jest.spyOn(component as any, 'updateAlertMessages').mockImplementation(() => {});

    const holderKeyStore = TestBed.inject(HolderKeyStoreService);
    const setSpy = jest.spyOn(holderKeyStore, 'set');

    await component.generateKeys();

    expect(setSpy).toHaveBeenCalledWith(publicJwk);
  });

it('generateKeys should only update alert message if it is first time', async () => {
  component.ngOnInit();
  expect((component as any).updateAlertMessages).toHaveBeenCalledTimes(1);

  const fakeForm = { patchValue: jest.fn() } as unknown as FormGroup<any>;
  Object.defineProperty(component, 'form', { configurable: true, value: () => fakeForm });

  await component.generateKeys();

  expect((component as any).updateAlertMessages).toHaveBeenCalledTimes(2);
});

it('generateKeys should NOT update alert message if it is NOT the first time', async () => {
  component.ngOnInit();
  const fakeForm = { patchValue: jest.fn() } as unknown as FormGroup<any>;
  Object.defineProperty(component, 'form', { configurable: true, value: () => fakeForm });

  rawStateSignal.set({ desmosDidKeyValue: 'X', desmosPrivateKeyValue: 'Y' });

  await component.generateKeys();

  expect((component as any).updateAlertMessages).toHaveBeenCalledTimes(1);
});



  it('copyToClipboard should write to the clipboard and reset copiedKey after 2 seconds', fakeAsync(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true
    });
    const writeSpy = jest.spyOn(navigator.clipboard, 'writeText');

    component.copyToClipboard('test-key');

    expect(writeSpy).toHaveBeenCalledWith('test-key');
    expect(component.copiedKey).toBe('test-key');

    tick(2000);
    expect(component.copiedKey).toBe('');

    // Drain the independent 60s clipboard-clear timer too (AC-19 / NFR-S-EUD168-04), or fakeAsync
    // fails the test with a pending-timer error.
    tick(58000);
    expect(writeSpy).toHaveBeenCalledWith('');
  }));

  it('resetCopiedKey should clear copiedKey', () => {
    component.copiedKey = 'xxx';
    (component as any).resetCopiedKey();
    expect(component.copiedKey).toBe('');
  });

  it('copying again before the clipboard-clear timer fires restarts it instead of stacking', fakeAsync(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true
    });
    const writeSpy = jest.spyOn(navigator.clipboard, 'writeText');

    component.copyToClipboard('first-key');
    tick(30000); // halfway to the first timer's 60s deadline
    component.copyToClipboard('second-key');
    tick(30000); // 60s since the first copy, but only 30s since the second -- must not have cleared
    expect(writeSpy).not.toHaveBeenCalledWith('');

    tick(30000); // 60s since the second copy
    expect(writeSpy).toHaveBeenCalledWith('');
    expect(writeSpy).toHaveBeenCalledTimes(3); // 'first-key', 'second-key', ''
  }));

  /**
   * code-review FE-1: destroying the component must not leave the clipboard holding the key until
   * the 60s timer eventually fires on its own -- the dominant path is the Operator copying the key
   * and immediately leaving the form to paste it into the machine.
   */
  it('ngOnDestroy clears the service state, the holder key store, and the clipboard immediately', fakeAsync(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true
    });
    const writeSpy = jest.spyOn(navigator.clipboard, 'writeText');
    const holderKeyStore = TestBed.inject(HolderKeyStoreService);
    const clearSpy = jest.spyOn(holderKeyStore, 'clear');

    component.copyToClipboard('test-key');
    component.ngOnDestroy();

    expect(mockService.clearState).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith('');
    expect(writeSpy).toHaveBeenCalledTimes(2); // 'test-key', then the immediate clear on destroy

    // The cancelled timer must not fire a second, redundant clear.
    tick(60000);
    expect(writeSpy).toHaveBeenCalledTimes(2);
  }));

  it('ngOnDestroy without a pending copy does not touch the clipboard', () => {
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
