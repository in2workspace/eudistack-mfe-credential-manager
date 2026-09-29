import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { FilterOption } from 'src/app/core/models/entity/lear-credential-management';

/**
 * Anchored checkbox-dropdown filter (US — credential-management dashboard revamp,
 * AC-2.2/2.3). Built on MatMenu rather than a raw CDK Overlay: it already is an
 * anchored, backdrop-less popover that closes on outside click, which is the
 * pattern most list-filter UIs (Linear, Notion, Airtable) use — no need to
 * hand-roll overlay positioning for the same result.
 *
 * Two modes, selected by `showFooter`:
 * - false (Type / Credential status): every checkbox toggle emits immediately
 *   (live filtering) — there is no Confirm button, so applying on close would be
 *   indistinguishable from an accidental outside click.
 * - true (Organization): toggles only mutate a local draft; Confirm emits it and
 *   closes, Close discards the draft and reverts to the last applied selection.
 */
@Component({
  selector: 'app-filter-dropdown',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatMenuModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  template: `
    <button
      type="button"
      class="filter-dropdown-trigger"
      [class.filter-dropdown-trigger--active]="selected().length > 0"
      [matMenuTriggerFor]="menu"
      #menuTriggerRef="matMenuTrigger"
      (menuOpened)="onOpened()"
      [attr.aria-label]="label() | translate">
      <span class="filter-dropdown-trigger-label">{{ label() | translate }}</span>
      @if (selected().length > 0) {
        <span class="filter-dropdown-count">{{ selected().length }}</span>
      }
      <mat-icon class="filter-dropdown-caret">arrow_drop_down</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="filter-dropdown-panel" [hasBackdrop]="true">
      <div class="filter-dropdown-content"
           [class.filter-dropdown-content--wide]="showFooter()"
           (click)="$event.stopPropagation()">
        @if (searchable()) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-dropdown-search">
            <input
              matInput
              [placeholder]="searchPlaceholder() | translate"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              (click)="$event.stopPropagation()">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        }

        <!-- Footer mode only: live-filtering dropdowns show their options directly. -->
        @if (showFooter()) {
          <div class="filter-dropdown-title-row">
            <span class="filter-dropdown-title">{{ 'filters.selectAnOption' | translate }}</span>
            @if (draft().length > 0) {
              <span class="filter-dropdown-count">{{ draft().length }}</span>
            }
          </div>
        }

        <div class="filter-dropdown-options">
          @for (option of filteredOptions(); track option.value) {
            <mat-checkbox
              class="filter-dropdown-option"
              [checked]="draft().includes(option.value)"
              (change)="toggle(option.value)">
              {{ option.label }}
            </mat-checkbox>
          }
          @if (filteredOptions().length === 0) {
            <span class="filter-dropdown-no-options">{{ 'filters.noOptions' | translate }}</span>
          }
        </div>

        @if (showFooter()) {
          <div class="filter-dropdown-footer">
            <button type="button" class="filter-dropdown-close" (click)="cancel(menuTriggerRef)">
              {{ 'filters.close' | translate }}
            </button>
            <button type="button" mat-flat-button color="primary" (click)="confirm(menuTriggerRef)">
              {{ 'filters.confirm' | translate }}
            </button>
          </div>
        }
      </div>
    </mat-menu>
  `,
  styles: [`
    .filter-dropdown-trigger {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 32px;
      padding: 0 6px 0 12px;
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--border-default, #D1D5DB);
      background: var(--surface-card, #FFFFFF);
      color: var(--text-primary, #1A1A2E);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
      white-space: nowrap;

      &:hover, &--active {
        border-color: var(--primary-color);
      }

      &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
    }

    .filter-dropdown-caret {
      color: var(--text-secondary, #6B7280);
    }

    .filter-dropdown-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      // border-box: a single digit fits inside 18×18, so it renders as a
      // circle; only 2+ digits stretch it into a pill.
      box-sizing: border-box;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 999px;
      line-height: 1;
      background: var(--secondary-color, #6B7280);
      color: var(--secondary-contrast-color, #fff);
      font-size: 0.7rem;
      font-weight: 700;
    }

    .filter-dropdown-content {
      display: flex;
      flex-direction: column;
      width: 260px;
      padding: 12px;
      box-sizing: border-box;

      // Organization: as wide as its longest name, up to the 50-character
      // maximum (ch in the option labels' font) plus the checkbox; anything
      // longer wraps instead of scrolling sideways.
      &--wide {
        width: max-content;
        min-width: 260px;
        max-width: min(calc(50ch + 64px), calc(100vw - 32px));
        font-size: var(--mat-checkbox-label-text-size, 0.875rem);
      }
    }

    .filter-dropdown-search {
      width: 100%;

      mat-icon[matSuffix] {
        color: var(--text-secondary, #6B7280);
        margin-left: 4px;
      }
    }

    .filter-dropdown-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 4px 0 8px;
    }

    .filter-dropdown-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary, #6B7280);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .filter-dropdown-options {
      display: flex;
      flex-direction: column;
      max-height: 260px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .filter-dropdown-option {
      display: block;
      padding: 2px 0;
      overflow-wrap: anywhere;
    }

    // The menu panel lives in the CDK overlay, outside this component —
    // Material caps it at 280px, which would clip the wide (organization) mode.
    ::ng-deep .mat-mdc-menu-panel.filter-dropdown-panel {
      max-width: none;
    }

    .filter-dropdown-no-options {
      color: var(--text-disabled, #9CA3AF);
      font-size: 0.85rem;
      padding: 4px 0;
    }

    .filter-dropdown-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border-default, #D1D5DB);
    }

    .filter-dropdown-close {
      background: var(--surface-card, #fff);
      color: var(--primary-color);
      border: none;
      padding: 0 12px;
      font: inherit;
      cursor: pointer;
      border-radius: 4px;

      &:hover {
        background: var(--action-secondary, #F3F4F6);
      }
    }
  `],
})
export class FilterDropdownComponent {
  public readonly label = input.required<string>();
  public readonly options = input.required<FilterOption[]>();
  /** Currently applied selection, controlled by the parent. */
  public readonly selected = input<string[]>([]);
  public readonly searchable = input(false);
  public readonly searchPlaceholder = input('');
  /** true = Organization mode (search + Close/Confirm + count badge). false = live filtering (Type/Status). */
  public readonly showFooter = input(false);
  /** Live mode: emitted on every toggle. Footer mode: emitted only on Confirm. */
  public readonly selectionChange = output<string[]>();

  protected readonly draft = signal<string[]>([]);
  protected readonly searchTerm = signal('');

  protected readonly filteredOptions = computed<FilterOption[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.options();
    return this.options().filter(o => o.label.toLowerCase().includes(term));
  });

  protected onOpened(): void {
    this.draft.set([...this.selected()]);
    this.searchTerm.set('');
  }

  protected toggle(value: string): void {
    const current = new Set(this.draft());
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    this.draft.set([...current]);

    if (!this.showFooter()) {
      this.selectionChange.emit(this.draft());
    }
  }

  protected confirm(trigger: MatMenuTrigger): void {
    this.selectionChange.emit(this.draft());
    trigger.closeMenu();
  }

  protected cancel(trigger: MatMenuTrigger): void {
    this.draft.set([...this.selected()]);
    trigger.closeMenu();
  }
}
