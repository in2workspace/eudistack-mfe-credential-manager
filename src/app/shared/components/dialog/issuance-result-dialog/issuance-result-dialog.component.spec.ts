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

    it('should treat a mode the backend said nothing about as working, in a successful issuance', () => {
      // The issuer only answers 200 when something was delivered, so silence there is not a verdict
      // to invent -- it is an older backend saying nothing about any mode.
      const component = setup({ deliveryModes: ['email', 'ui'] });

      expect(component.outcomeOf('email')).toBe('ok');
      expect(component.hasAnyFailure).toBe(false);
    });

    it('should treat a mode the backend said nothing about as unconfirmed, inside a failure', () => {
      // A timeout or a proxy error can hide a dispatch that did happen. Rendering the success branch
      // here is what made a box announce an email that may never have gone out.
      const component = setup({ deliveryModes: ['email', 'ui'], failed: true });

      expect(component.outcomeOf('email')).toBe('unconfirmed');
      expect(component.outcomeOf('ui')).toBe('unconfirmed');
      expect(component.hasFailed('email')).toBe(false);
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

    it('should hand over the key alone when direct failed but a wallet channel dispatched', () => {
      // The holder will still redeem a credential bound to this key through the email.
      const component = setup({
        deliveryModes: ['direct', 'email'],
        privateKey: 'deadbeef',
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'email', status: 'dispatched' },
        ],
      });

      expect(component.showsToken).toBe(false);
      expect(component.showsKey).toBe(true);
      expect(component.handoverTitleKey).toBe('credentialIssuance.issuance-result-dialog.handover.key');
    });

    it('should withhold the key when every declared channel failed', () => {
      // Nothing was delivered and nothing can be redeemed, so the key unlocks nothing: re-issuing
      // generates a new one. Asking the Operator to keep this one would be busywork.
      const component = setup({
        deliveryModes: ['direct', 'ui', 'email'],
        privateKey: 'deadbeef',
        failed: true,
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'ui', status: 'failed', error: 'offer not created' },
          { mode: 'email', status: 'failed', error: 'SMTP unavailable' },
        ],
      });

      expect(component.showsKey).toBe(false);
      expect(component.handoverTitleKey).toBeNull();
    });

    it('should withhold the key when a QR channel dispatched but no offer reached the dialog', () => {
      // Dispatched or not, with no URI there is nothing to show and nobody can redeem anything.
      const component = setup({
        deliveryModes: ['direct', 'ui'],
        privateKey: 'deadbeef',
        failed: true,
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'ui', status: 'dispatched' },
        ],
      });

      expect(component.showsKey).toBe(false);
    });

    it('should hand the key over with the unconfirmed warning when nothing could be confirmed', () => {
      // Not knowing is not the same as knowing it failed: a key withheld from a delivery that did go
      // out is unrecoverable, so this is the one case where it is shown without a working channel.
      const component = setup({
        deliveryModes: ['direct', 'email'],
        privateKey: 'deadbeef',
        failed: true,
      });

      expect(component.deliveryUnconfirmed).toBe(true);
      expect(component.showsKey).toBe(true);
      expect(component.handoverNoteKey)
        .toBe('credentialIssuance.issuance-result-dialog.handoverNoteUnconfirmed');
    });

    it('should keep the plain warning when a channel did work', () => {
      const component = setup({
        deliveryModes: ['direct', 'email'],
        privateKey: 'deadbeef',
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'email', status: 'dispatched' },
        ],
      });

      expect(component.deliveryUnconfirmed).toBe(false);
      expect(component.handoverNoteKey).toBe('credentialIssuance.issuance-result-dialog.handoverNote');
    });

    it('should give a failed direct delivery a status box of its own', () => {
      // Failed, it reports rather than hands over -- exactly like a failed wallet channel, so it
      // goes back into the status loop instead of into the hand-over box.
      const component = setup({
        deliveryModes: ['direct', 'email'],
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'email', status: 'dispatched' },
        ],
      });

      expect(component.statusModes).toEqual(['direct', 'email']);
      expect(component.handoverTitleKey).toBeNull();
    });

    it('should keep a delivered direct out of the status loop', () => {
      const component = setup({
        deliveryModes: ['direct', 'email'],
        credentialToken: 'eyJ...',
        deliveryResults: [
          { mode: 'direct', status: 'delivered' },
          { mode: 'email', status: 'dispatched' },
        ],
      });

      expect(component.statusModes).toEqual(['email']);
    });

    it('should still hand over the key when the whole issuance failed but a channel dispatched', () => {
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
      expect(component.handoverTitleKey).toBe('credentialIssuance.issuance-result-dialog.handover.key');
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

  // One box for everything that exists nowhere else. The credential token and the key are both
  // shown once and destroyed on close, so they share a box and a warning; the wallet channels are
  // notifications about a credential travelling elsewhere and get a box each.
  describe('hand-over box', () => {
    const HANDOVER = 'credentialIssuance.issuance-result-dialog.handover.';

    const render = (data: IssuanceResultDialogData): HTMLElement => {
      setup(data);
      const fixture = TestBed.createComponent(IssuanceResultDialogComponent);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('should hand the key over for a wallet-only issuance, not just for direct', () => {
      const el = render({ deliveryModes: ['email'], privateKey: '0xdeadbeef' });
      expect(el.querySelectorAll('[data-mode="handover"] app-copyable-field')).toHaveLength(1);
    });

    it('should hand the key over alongside the QR when the credential travels as an offer', () => {
      const el = render({
        deliveryModes: ['ui'],
        privateKey: '0xdeadbeef',
        credentialOfferUri: 'openid-credential-offer://abc'
      });
      expect(el.querySelector('[data-mode="handover"]')).not.toBeNull();
    });

    it('should put the credential and the key in the same box when both exist', () => {
      const el = render({
        deliveryModes: ['direct'],
        credentialToken: 'eyJ.token',
        privateKey: '0xdeadbeef'
      });

      expect(el.querySelectorAll('[data-mode="handover"] app-copyable-field')).toHaveLength(2);
      expect(el.querySelector('[data-mode="direct"]')).toBeNull();
    });

    it('should keep them in the same box when wallet channels are selected too', () => {
      const el = render({
        deliveryModes: ['direct', 'email'],
        credentialToken: 'eyJ.token',
        privateKey: '0xdeadbeef'
      });

      expect(el.querySelectorAll('[data-mode="handover"] app-copyable-field')).toHaveLength(2);
      expect(el.querySelectorAll('[data-mode="email"]')).toHaveLength(1);
    });

    it('should render the QR inside a failed issuance when the offer reached the dialog', () => {
      // direct is decisive, so this is a 5xx -- but the wallet channel dispatched and its offer is
      // redeemable. Denying the QR here was denying something that works.
      const el = render({
        deliveryModes: ['direct', 'ui'],
        credentialOfferUri: 'openid-credential-offer://abc',
        failed: true,
        deliveryResults: [
          { mode: 'direct', status: 'failed', error: 'QTSP down' },
          { mode: 'ui', status: 'dispatched' },
        ],
      });

      const qrBox = el.querySelector('[data-mode="ui"]');
      expect(qrBox?.querySelector('app-credential-offer-qr')).not.toBeNull();
      expect(qrBox?.querySelector('.mode-failed')).toBeNull();
      expect(qrBox?.querySelector('.offer-missing')).toBeNull();
    });

    it('should not announce a delivery it could not confirm', () => {
      const el = render({ deliveryModes: ['email'], privateKey: '0xdeadbeef', failed: true });

      const emailBox = el.querySelector('[data-mode="email"]');
      expect(emailBox?.querySelector('.mode-unconfirmed')).not.toBeNull();
      expect(emailBox?.querySelector('.email-sent')).toBeNull();
    });

    it('should render nothing to take away for a wallet-only issuance that binds no key', () => {
      const el = render({
        deliveryModes: ['ui', 'email'],
        credentialOfferUri: 'openid-credential-offer://abc'
      });
      expect(el.querySelector('[data-mode="handover"]')).toBeNull();
    });

    it('should title the box "credential and key" when it carries both', () => {
      const component = setup({
        deliveryModes: ['direct'],
        credentialToken: 'eyJ.token',
        privateKey: '0xdeadbeef'
      });
      expect(component.handoverTitleKey).toBe(`${HANDOVER}credentialAndKey`);
    });

    it('should title the box "credential" when the type binds no key', () => {
      const component = setup({ deliveryModes: ['direct'], credentialToken: 'eyJ.token' });
      expect(component.handoverTitleKey).toBe(`${HANDOVER}credential`);
    });

    it('should title the box "key" when there is no credential to go with it', () => {
      const component = setup({ deliveryModes: ['email'], privateKey: '0xdeadbeef' });
      expect(component.handoverTitleKey).toBe(`${HANDOVER}key`);
    });

    it('should not tell the Operator to save something that never arrived', () => {
      // Direct ran but the response carried no token, and the type binds no key: the box exists to
      // report that, and there is nothing in it to copy.
      const component = setup({ deliveryModes: ['direct'] });

      expect(component.handoverTitleKey).toBe(`${HANDOVER}credential`);
      expect(component.hasSavableContent).toBe(false);
    });
  });
});
