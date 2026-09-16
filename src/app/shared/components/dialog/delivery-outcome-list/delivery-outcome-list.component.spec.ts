import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DeliveryOutcomeListComponent } from './delivery-outcome-list.component';
import { DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';

/**
 * Post-release PO polish (2026-09-16/17): one bordered box per requested mode, green on delivery
 * and red on failure, with mode-specific body copy -- replaces the previous flat `<ul>` list.
 * Ordering (EC-07) and the "only render what was requested" behavior are unchanged, so this spec
 * covers just what changed: markup, per-mode styling class, and per-mode/per-outcome text.
 */
describe('DeliveryOutcomeListComponent', () => {
  let fixture: ComponentFixture<DeliveryOutcomeListComponent>;

  function setup(outcomes: ReadonlyMap<DeliveryModeToken, ChannelOutcome>) {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), DeliveryOutcomeListComponent],
    });
    fixture = TestBed.createComponent(DeliveryOutcomeListComponent);
    fixture.componentRef.setInput('outcomes', outcomes);
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
});
