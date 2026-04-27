import { MatSlideToggle } from '@angular/material/slide-toggle';
import { CapitalizePipe } from './../../../../shared/pipes/capitalize.pipe';
import { Component, inject, InjectionToken } from '@angular/core';
import { FunctionActions, groupActionsByFunction } from '../../helpers/credential-details-helpers';
import { TranslatePipe } from '@ngx-translate/core';
import { Power } from 'src/app/core/models/entity/lear-credential';

export const detailsPowerToken = new InjectionToken<Power[]>('DETAILS_POWER');

@Component({
    selector: 'app-details-power',
    imports: [CapitalizePipe, MatSlideToggle, TranslatePipe],
    templateUrl: './details-power.component.html',
    styleUrl: './details-power.component.scss'
})
export class DetailsPowerComponent {
  public readonly powers = inject(detailsPowerToken);
  public readonly domain = this.powers[0]?.domain ?? '';
  public readonly groupedPowers: FunctionActions[] = groupActionsByFunction(this.powers);

}
