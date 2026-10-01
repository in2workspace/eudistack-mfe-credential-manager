import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IssuedCredentialSummary } from 'src/app/core/models/entity/lear-credential-issuance';

/**
 * The post-issuance header both result surfaces share: what was created, and -- for a machine
 * credential -- the identifiers the Operator typed, echoed back so they can confirm at a glance
 * that the credential belongs to the system they meant.
 *
 * The key warning is gated on `hasKeySection`, not on the credential type: it exists because this
 * surface is about to hand over a private key that cannot be retrieved later, which is exactly what
 * that flag means. Tying it to the type instead would drift the day another type takes a key.
 */
@Component({
  selector: 'app-issued-credential-summary',
  imports: [TranslatePipe],
  templateUrl: './issued-credential-summary.component.html',
  styleUrl: './issued-credential-summary.component.scss'
})
export class IssuedCredentialSummaryComponent {
  public readonly summary = input<IssuedCredentialSummary>();
  public readonly hasKeySection = input(false);

  protected readonly subtitleKey = computed<string>(() => {
    const type = this.summary()?.credentialType;
    return type ? 'credentialIssuance.result.subtitle.' + type : '';
  });

  /**
   * The block echoes the machine identifiers the Operator typed, so it only opens when there are
   * any. An employee credential has none and gets no block at all -- and neither does a machine
   * whose optional identifiers were both left blank, which would otherwise render a lone type row.
   */
  protected readonly details = computed<{ labelKey: string; value: string }[]>(() => {
    const summary = this.summary();
    const machineRows = [
      { labelKey: 'credentialIssuance.domain', value: summary?.domain ?? '' },
      { labelKey: 'credentialIssuance.ipAddress', value: summary?.ipAddress ?? '' }
    ].filter(row => !!row.value);

    if (machineRows.length === 0) {
      return [];
    }
    return [
      { labelKey: 'credentialIssuance.result.credentialType', value: summary?.typeLabel ?? '' },
      ...machineRows
    ].filter(row => !!row.value);
  });
}
