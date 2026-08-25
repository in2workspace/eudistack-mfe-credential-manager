import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IssuanceResultDialogComponent, IssuanceResultDialogData } from './issuance-result-dialog.component';

describe('IssuanceResultDialogComponent', () => {
  let mockDialogRef: jest.Mocked<MatDialogRef<IssuanceResultDialogComponent>>;

  function setup(data: IssuanceResultDialogData): IssuanceResultDialogComponent {
    mockDialogRef = { close: jest.fn() } as unknown as jest.Mocked<MatDialogRef<IssuanceResultDialogComponent>>;

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        IssuanceResultDialogComponent,
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        // The `ui` box renders CredentialOfferQrComponent, which pulls TenantService and with it
        // HttpClient. Only the rendering tests below reach it, but the TestBed is shared.
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    return TestBed.inject(IssuanceResultDialogComponent);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.resetAllMocks();
  });

  describe('box order', () => {
    it('should render direct first, then ui, then email, whatever order they were selected in', () => {
      const component = setup({ deliveryModes: ['email', 'ui', 'direct'] });
      expect(component.orderedModes).toEqual(['direct', 'ui', 'email']);
    });

    it('should only list the selected modes', () => {
      const component = setup({ deliveryModes: ['email', 'direct'] });
      expect(component.orderedModes).toEqual(['direct', 'email']);
    });

    it('should ignore anything that is not a known mode', () => {
      const component = setup({ deliveryModes: ['ui', 'carrier-pigeon' as never] });
      expect(component.orderedModes).toEqual(['ui']);
    });
  });

  describe('both-wallet-channels note', () => {
    it('should show when ui and email are both selected', () => {
      const component = setup({ deliveryModes: ['ui', 'email'] });
      expect(component.showBothWalletChannelsNote).toBe(true);
    });

    it('should not show for ui alone', () => {
      const component = setup({ deliveryModes: ['direct', 'ui'] });
      expect(component.showBothWalletChannelsNote).toBe(false);
    });

    it('should not show for email alone', () => {
      const component = setup({ deliveryModes: ['direct', 'email'] });
      expect(component.showBothWalletChannelsNote).toBe(false);
    });
  });

  describe('per-mode delivery results (EUD-33 AC-06)', () => {
    it('should report a mode as failed when the backend said so', () => {
      const component = setup({
        deliveryModes: ['email'],
        deliveryResults: [{ mode: 'email', status: 'failed', error: 'SMTP unavailable' }],
      });

      expect(component.hasFailed('email')).toBe(true);
      expect(component.errorOf('email')).toBe('SMTP unavailable');
      expect(component.hasAnyFailure).toBe(true);
    });

    it('should not report a mode as failed when it dispatched', () => {
      const component = setup({
        deliveryModes: ['email', 'ui'],
        deliveryResults: [
          { mode: 'email', status: 'failed', error: 'SMTP unavailable' },
          { mode: 'ui', status: 'dispatched' },
        ],
      });

      expect(component.hasFailed('email')).toBe(true);
      expect(component.hasFailed('ui')).toBe(false);
    });

    it('should treat a mode the backend said nothing about as not failed', () => {
      // An older backend, or a failure that never reached the delivery stage: the boxes keep their
      // previous rendering rather than inventing a verdict.
      const component = setup({ deliveryModes: ['email', 'ui'] });

      expect(component.hasFailed('email')).toBe(false);
      expect(component.hasAnyFailure).toBe(false);
    });

    it('should suppress the both-channels note when one of the channels failed', () => {
      // The note warns about a race to redeem one offer. With a failed channel there is no race,
      // and the note would contradict the failure rendered right above it.
      const component = setup({
        deliveryModes: ['ui', 'email'],
        deliveryResults: [
          { mode: 'email', status: 'failed', error: 'SMTP unavailable' },
          { mode: 'ui', status: 'dispatched' },
        ],
      });

      expect(component.showBothWalletChannelsNote).toBe(false);
    });

    it('should move the key out of a failed direct box, since there is no credential to pair it with', () => {
      const component = setup({
        deliveryModes: ['direct', 'email'],
        privateKey: 'deadbeef',
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'email', status: 'dispatched' },
        ],
      });

      expect(component.keyInsideDirectBox).toBe(false);
      expect(component.keyInOwnBox).toBe(true);
    });

    it('should still hand over the key when the whole issuance failed', () => {
      // The key exists nowhere but this dialog. Closing without showing it destroys the only copy of
      // the key the dispatched credential is bound to.
      const component = setup({
        deliveryModes: ['direct', 'email'],
        privateKey: 'deadbeef',
        failed: true,
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'email', status: 'dispatched' },
        ],
      });

      expect(component.failed).toBe(true);
      expect(component.keyInOwnBox).toBe(true);
    });

    it('should not flag the dialog as failed for a partial success', () => {
      const component = setup({
        deliveryModes: ['direct', 'email'],
        credentialToken: 'eyJ...',
        deliveryResults: [
          { mode: 'direct', status: 'delivered' },
          { mode: 'email', status: 'failed', error: 'SMTP unavailable' },
        ],
      });

      expect(component.failed).toBe(false);
      expect(component.hasAnyFailure).toBe(true);
    });
  });

  it('close() should call dialogRef.close()', () => {
    const component = setup({ deliveryModes: ['direct'] });
    component.close();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should keep the token and key it was given, so the boxes can render them', () => {
    const component = setup({
      deliveryModes: ['direct'],
      credentialToken: 'eyJ.token',
      privateKey: '0xdeadbeef',
    });

    expect(component.data.credentialToken).toBe('eyJ.token');
    expect(component.data.privateKey).toBe('0xdeadbeef');
  });

  // The key belongs to the credential, not to a delivery channel: a type with no cryptographic
  // binding method binds to it whichever way the credential travelled, so it cannot live inside
  // the `direct` box.
  describe('holder key box', () => {
    const render = (data: IssuanceResultDialogData): HTMLElement => {
      setup(data);
      const fixture = TestBed.createComponent(IssuanceResultDialogComponent);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('should render the key for a wallet-only issuance, not just for direct', () => {
      const el = render({ deliveryModes: ['email'], privateKey: '0xdeadbeef' });
      expect(el.querySelector('[data-mode="holderKey"]')).not.toBeNull();
    });

    it('should render the key alongside the QR when the credential travels as an offer', () => {
      const el = render({
        deliveryModes: ['ui'],
        privateKey: '0xdeadbeef',
        credentialOfferUri: 'openid-credential-offer://abc'
      });
      expect(el.querySelector('[data-mode="holderKey"]')).not.toBeNull();
    });

    it('should put the key inside the direct box, next to the credential it unlocks', () => {
      const el = render({
        deliveryModes: ['direct'],
        credentialToken: 'eyJ.token',
        privateKey: '0xdeadbeef'
      });

      expect(el.querySelector('[data-mode="holderKey"]')).toBeNull();
      expect(el.querySelectorAll('[data-mode="direct"] app-copyable-field')).toHaveLength(2);
    });

    it('should keep the key in the direct box when wallet channels are selected too', () => {
      const el = render({
        deliveryModes: ['direct', 'email'],
        credentialToken: 'eyJ.token',
        privateKey: '0xdeadbeef'
      });

      expect(el.querySelector('[data-mode="holderKey"]')).toBeNull();
      expect(el.querySelectorAll('[data-mode="direct"] app-copyable-field')).toHaveLength(2);
    });

    it('should render no key box when the credential binds to none', () => {
      const el = render({ deliveryModes: ['direct'], credentialToken: 'eyJ.token' });
      expect(el.querySelector('[data-mode="holderKey"]')).toBeNull();
    });
  });
});
