import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { DELIVERY_MODE_OPTIONS, DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';

interface DeliveryOutcomeEntry {
  mode: DeliveryModeToken;
  outcome: ChannelOutcome;
  labelKey: string;
}

/**
 * Per-channel delivery result, in the Story's fixed presentation order (EUD-233 AD-10:
 * `DELIVERY_RESULT_ORDER`), never the iteration order of an outcomes map -- a channel's position
 * must not depend on which one happened to fail (EC-07).
 *
 * One component, two hosts (AD-8): `DirectCredentialResultDialogComponent` (Task 22) and the
 * extended `CredentialOfferDialogComponent` (Task 24) both render this instead of each keeping
 * its own copy of the ordering and the delivered/failed presentation.
 *
 * Renders only the modes the caller actually requested -- `outcomes` already comes from
 * `resolveChannelOutcomes(responses, requestedModes)`, which has exactly one entry per requested
 * mode, so there is nothing to filter here beyond restoring the fixed order (AC-03.1, AC-03.2,
 * AC-04, AC-09). `'missing'` renders the same as `'failed'`: both mean "nothing arrived on this
 * channel", and the Operator has no use for the distinction between the two absence causes.
 */
@Component({
  selector: 'app-delivery-outcome-list',
  imports: [MatIcon, TranslatePipe],
  templateUrl: './delivery-outcome-list.component.html',
  styleUrl: './delivery-outcome-list.component.scss'
})
export class DeliveryOutcomeListComponent {
  public readonly outcomes = input.required<ReadonlyMap<DeliveryModeToken, ChannelOutcome>>();

  protected readonly orderedEntries = computed<DeliveryOutcomeEntry[]>(() => {
    const outcomes = this.outcomes();
    return DELIVERY_MODE_OPTIONS
      .filter(option => outcomes.has(option.value))
      .map(option => ({ mode: option.value, outcome: outcomes.get(option.value)!, labelKey: option.labelKey }));
  });

  protected isDelivered(outcome: ChannelOutcome): boolean {
    return outcome === 'delivered';
  }
}
