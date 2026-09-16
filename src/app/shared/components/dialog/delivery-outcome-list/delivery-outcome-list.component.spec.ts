import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { DeliveryOutcomeListComponent } from './delivery-outcome-list.component';
import { DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';
import { TenantService } from 'src/app/core/services/tenant.service';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';

/**
 * Post-release PO polish (2026-09-16/17): one bordered box per requested mode, green on delivery
 * and red on failure, with mode-specific body copy -- replaces the previous flat `<ul>` list.
 * Ordering (EC-07) and the "only render what was requested" behavior are unchanged, so this spec
 * covers just what changed: markup, per-mode styling class, and per-mode/per-outcome text.
 */
describe('DeliveryOutcomeListComponent', () => {
  let fixture: ComponentFixture<DeliveryOutcomeListComponent>;

  function setup(
    outcomes: ReadonlyMap<DeliveryModeToken, ChannelOutcome>,
    extraInputs: { signedCredential?: string; credentialOfferUri?: string } = {}
  ) {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), DeliveryOutcomeListComponent],
      providers: [
        // Only instantiated when credentialOfferUri is set (CredentialOfferQrComponent).
        { provide: TenantService, useValue: { walletUrl: jest.fn(() => 'https://wallet.example'), defaultWalletUrl: jest.fn(() => null) } },
      ],
    });
    fixture = TestBed.createComponent(DeliveryOutcomeListComponent);
    fixture.componentRef.setInput('outcomes', outcomes);
    if (extraInputs.signedCredential !== undefined) {
      fixture.componentRef.setInput('signedCredential', extraInputs.signedCredential);
    }
    if (extraInputs.credentialOfferUri !== undefined) {
      fixture.componentRef.setInput('credentialOfferUri', extraInputs.credentialOfferUri);
    }
    fixture.detectChanges();
  }

  function boxes(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.delivery-outcome-list__box'));
  }

  it('renders one box per requested mode, in the fixed direct -> ui -> email order (EC-07)', () => {
    setup(new Map([['email', 'delivered'], ['direct', 'delivered'], ['ui', 'failed']]));

    const titles = boxes().map(box => box.querySelector('.delivery-outcome-list__title')?.textContent?.trim());
    expect(titles).toEqual([
      'credentialIssuance.delivery.direct',
      'credentialIssuance.delivery.qrCode',
      'credentialIssuance.delivery.email',
    ]);
  });

  it('renders only the modes present in outcomes, nothing else', () => {
    setup(new Map([['ui', 'delivered']]));

    expect(boxes().length).toBe(1);
  });

  it('marks a delivered box green and a failed one red via BEM modifier classes', () => {
    setup(new Map([['direct', 'delivered'], ['email', 'failed']]));

    const [directBox, emailBox] = boxes();
    expect(directBox.classList.contains('delivery-outcome-list__box--delivered')).toBe(true);
    expect(directBox.classList.contains('delivery-outcome-list__box--failed')).toBe(false);
    expect(emailBox.classList.contains('delivery-outcome-list__box--failed')).toBe(true);
    expect(emailBox.classList.contains('delivery-outcome-list__box--delivered')).toBe(false);
  });

  it("'missing' renders the same as 'failed' -- no distinction the Operator can act on", () => {
    setup(new Map([['ui', 'missing']]));

    const [box] = boxes();
    expect(box.classList.contains('delivery-outcome-list__box--failed')).toBe(true);
    expect(box.textContent).toContain('credentialIssuance.deliveryOutcome.ui.failed');
  });

  describe('per-mode, per-outcome body copy', () => {
    const cases: Array<[DeliveryModeToken, ChannelOutcome, string]> = [
      ['direct', 'delivered', 'credentialIssuance.deliveryOutcome.direct.delivered'],
      ['direct', 'failed', 'credentialIssuance.deliveryOutcome.direct.failed'],
      ['ui', 'delivered', 'credentialIssuance.deliveryOutcome.ui.delivered'],
      ['ui', 'failed', 'credentialIssuance.deliveryOutcome.ui.failed'],
      ['email', 'delivered', 'credentialIssuance.deliveryOutcome.email.delivered'],
      ['email', 'failed', 'credentialIssuance.deliveryOutcome.email.failed'],
    ];

    for (const [mode, outcome, expectedKey] of cases) {
      it(`renders ${expectedKey} for mode='${mode}', outcome='${outcome}'`, () => {
        setup(new Map([[mode, outcome]]));

        expect(boxes()[0].textContent).toContain(expectedKey);
      });
    }
  });

  /**
   * Post-release PO polish (2026-09-17): the `direct`/`ui` boxes embed the real artifact instead of
   * a generic "delivered" line, so it is not duplicated above this list by the host anymore.
   */
  describe('embedded artifacts (2026-09-17 polish)', () => {
    it("embeds the signed credential in the 'direct' box when delivered and provided, instead of the generic text", () => {
      setup(new Map([['direct', 'delivered']]), { signedCredential: 'signed-jwt-value' });

      const [box] = boxes();
      expect(box.querySelector('app-copyable-field')).toBeTruthy();
      expect(box.textContent).not.toContain('credentialIssuance.deliveryOutcome.direct.delivered');
    });

    it("embeds the QR in the 'ui' box when delivered and provided, instead of the generic text", () => {
      setup(new Map([['ui', 'delivered']]), { credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fexample.com%2Foffer' });

      const [box] = boxes();
      expect(box.querySelector('app-credential-offer-qr')).toBeTruthy();
      expect(box.textContent).not.toContain('credentialIssuance.deliveryOutcome.ui.delivered');
    });

    it("falls back to the generic text when 'direct' is delivered but no signedCredential is provided", () => {
      setup(new Map([['direct', 'delivered']]));

      const [box] = boxes();
      expect(box.querySelector('app-copyable-field')).toBeFalsy();
      expect(box.textContent).toContain('credentialIssuance.deliveryOutcome.direct.delivered');
    });

    it("falls back to the generic text when 'ui' is delivered but no credentialOfferUri is provided", () => {
      setup(new Map([['ui', 'delivered']]));

      const [box] = boxes();
      expect(box.querySelector('app-credential-offer-qr')).toBeFalsy();
      expect(box.textContent).toContain('credentialIssuance.deliveryOutcome.ui.delivered');
    });

    it("never embeds the credential in a failed 'direct' box, even if somehow provided", () => {
      setup(new Map([['direct', 'failed']]), { signedCredential: 'signed-jwt-value' });

      const [box] = boxes();
      expect(box.querySelector('app-copyable-field')).toBeFalsy();
      expect(box.textContent).toContain('credentialIssuance.deliveryOutcome.direct.failed');
    });

    it("bubbles the embedded copyable-field's copied/copyFailed events", () => {
      setup(new Map([['direct', 'delivered']]), { signedCredential: 'signed-jwt-value' });

      const credentialCopied = jest.fn();
      const credentialCopyFailed = jest.fn();
      fixture.componentInstance.credentialCopied.subscribe(credentialCopied);
      fixture.componentInstance.credentialCopyFailed.subscribe(credentialCopyFailed);

      const copyableField = fixture.debugElement.query(By.directive(CopyableFieldComponent)).componentInstance as CopyableFieldComponent;
      copyableField.copied.emit();
      copyableField.copyFailed.emit();

      expect(credentialCopied).toHaveBeenCalled();
      expect(credentialCopyFailed).toHaveBeenCalled();
    });
  });
});
