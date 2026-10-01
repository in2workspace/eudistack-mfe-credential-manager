import { Component, inject, InjectionToken } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export const validatedCriteriaToken = new InjectionToken<string[]>('VALIDATED_CRITERIA_DATA');

/**
 * Renders `gx:validatedCriteria` as one read-only input per criterion: the list can
 * be long and its URIs too wide for the drawer, so each one scrolls on its own and
 * can be selected and copied.
 */
@Component({
    selector: 'app-validated-criteria',
    imports: [TranslatePipe],
    templateUrl: './validated-criteria.component.html',
    styleUrl: './validated-criteria.component.scss'
})
export class ValidatedCriteriaComponent {
  public readonly criteria: string[] = inject(validatedCriteriaToken) ?? [];
}
