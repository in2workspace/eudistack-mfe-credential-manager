import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { LocalizedDatePipe } from 'src/app/shared/pipes/localized-date.pipe';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { AuditErrorMessage, toAuditErrorMessage } from './helpers/audit-error.helpers';
import {
  actorKindKey, actorLabel, eventTypeKey, reasonKey, resourceLabel, resultKey
} from './helpers/audit-labels.helpers';
import {
  AUDIT_MAX_PERIOD_DAYS, defaultAuditPeriod, oldestAuditDateValue, periodFromDates, toDateInputValue,
  validateAuditPeriod
} from './helpers/audit-period.helpers';
import { AuditEvent, AuditPeriod } from './models/audit-event.model';
import { AuditEventsService } from './services/audit-events.service';

/**
 * Basic query of the tenant's audit (EUD-293, PRD EUD-331 0.2): the events of the last 30 days, newest
 * first, with another period to choose and the next page while the API reports more.
 *
 * It decides nothing about scope, limits or volume: the audit API does, and its errors are shown here
 * (the error interceptor stays out of `/audit`). Access is `auditAccessGuard`'s.
 */
@Component({
  selector: 'app-audit',
  imports: [LocalizedDatePipe, MatButton, SkeletonLoaderComponent, TranslatePipe],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss'
})
export class AuditComponent implements OnInit {
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly events = signal<AuditEvent[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<AuditErrorMessage | null>(null);
  /** A query has finished at least once: before that there is nothing to call empty. */
  protected readonly searched = signal(false);

  protected readonly maxPeriodDays = AUDIT_MAX_PERIOD_DAYS;
  protected readonly todayValue = toDateInputValue(new Date());
  protected readonly oldestValue = oldestAuditDateValue(new Date());
  protected readonly periodError = computed(() => {
    const now = new Date();
    const period = periodFromDates(this.fromDate(), this.toDate(), now);
    return period ? validateAuditPeriod(period, now) : 'invalid';
  });

  protected readonly eventTypeKey = eventTypeKey;
  protected readonly resultKey = resultKey;
  protected readonly reasonKey = reasonKey;
  protected readonly actorKindKey = actorKindKey;
  protected readonly actorLabel = actorLabel;
  protected readonly resourceLabel = resourceLabel;

  private readonly auditEvents = inject(AuditEventsService);
  private readonly authService = inject(AuthService);
  private readonly fromInput = viewChild<ElementRef<HTMLInputElement>>('fromInput');

  /**
   * The period of the listing on screen. The API's cursor belongs to it, so every next page is asked
   * with these very instants and not with ones recomputed from the date fields.
   */
  private activePeriod: AuditPeriod | null = null;

  public ngOnInit(): void {
    const period = defaultAuditPeriod(new Date());
    this.fromDate.set(toDateInputValue(period.from));
    this.toDate.set(toDateInputValue(period.to));
    void this.load(period);
  }

  protected onDateChange(field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (field === 'from' ? this.fromDate : this.toDate).set(value);
  }

  protected consult(): void {
    const now = new Date();
    const period = periodFromDates(this.fromDate(), this.toDate(), now);
    if (!period || validateAuditPeriod(period, now) || this.loading()) {
      return;
    }
    void this.load(period);
  }

  protected changePeriod(): void {
    this.fromInput()?.nativeElement.focus();
  }

  protected login(): void {
    this.authService.login();
  }

  /** The next page is added to the rows already shown: there is no way back to a page that was replaced. */
  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    const period = this.activePeriod;
    if (!cursor || !period || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(this.auditEvents.list(period, cursor));
      this.events.update(shown => [...shown, ...page.events]);
      this.nextCursor.set(page.next_cursor);
    } catch (error) {
      this.error.set(toAuditErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async load(period: AuditPeriod): Promise<void> {
    this.activePeriod = period;
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(this.auditEvents.list(period));
      this.events.set(page.events);
      this.nextCursor.set(page.next_cursor);
    } catch (error) {
      this.events.set([]);
      this.nextCursor.set(null);
      this.error.set(toAuditErrorMessage(error));
    } finally {
      this.loading.set(false);
      this.searched.set(true);
    }
  }
}
