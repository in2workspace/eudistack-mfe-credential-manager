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
    <!-- One bordered chip, three parts: the menu trigger (label + count), a
         separate clear button (a button can't be nested inside another) and
         the caret, which opens the menu like the trigger does. -->
    <div class="filter-dropdown-chip" [class.filter-dropdown-chip--active]="selected().length > 0">
      <button
        type="button"
        class="filter-dropdown-trigger"
        [matMenuTriggerFor]="menu"
        #menuTriggerRef="matMenuTrigger"
        (menuOpened)="onOpened()"
        [attr.aria-label]="label() | translate">
        <span class="filter-dropdown-trigger-label">{{ label() | translate }}</span>
        @if (selected().length > 0) {
          <span class="filter-dropdown-count">{{ selected().length }}</span>
        }
      </button>
      @if (selected().length > 0) {
        <button
          type="button"
          class="filter-dropdown-clear"
          [attr.aria-label]="'filters.clearFilter' | translate: { filter: (label() | translate) }"
          (click)="clear()">
          <mat-icon>close</mat-icon>
        </button>
      }
      <mat-icon class="filter-dropdown-caret" aria-hidden="true" (click)="menuTriggerRef.openMenu()">arrow_drop_down</mat-icon>
    </div>

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
    .filter-dropdown-chip {
      display: inline-flex;
      align-items: center;
      height: 32px;
      padding-right: 6px;
      box-sizing: border-box;
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--border-default, #D1D5DB);
      background: var(--surface-card, #FFFFFF);
      white-space: nowrap;

      &:hover, &--active {
        border-color: var(--primary-color);
      }

      &:has(.filter-dropdown-trigger:focus-visible) {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
    }

    // Borderless: the chip draws the box. Its left padding makes the whole
    // left part of the chip clickable.
    .filter-dropdown-trigger {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 100%;
      padding: 0 0 0 12px;
      border: none;
      border-radius: var(--radius-md, 8px) 0 0 var(--radius-md, 8px);
      background: transparent;
      color: var(--text-primary, #1A1A2E);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;

      &:focus-visible {
        outline: none; // drawn on the chip instead
      }
    }

    // 6px after the count (4px gap + 2px inside this 20px target around the
    // 16px icon); the caret pulls in so only a hairline separates them.
    .filter-dropdown-clear {
      position: relative;
      z-index: 1; // above the caret, which overlaps its right edge (see below)
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-left: 4px;
      padding: 0;
      border: none;
      border-radius: var(--radius-full, 9999px);
      background: transparent;
      color: var(--text-secondary, #6B7280);
      cursor: pointer;

      mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }

      &:hover {
        background: var(--action-secondary, #F3F4F6);
        color: var(--text-primary, #1A1A2E);
      }

      &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
      }
    }

    .filter-dropdown-caret {
      margin-left: 4px;
      color: var(--text-secondary, #6B7280);
      cursor: pointer;
    }

    // The glyph has ~7px of empty space on its left: this leaves ~2px of
    // visible gap after the clear button's own 2px.
    .filter-dropdown-clear + .filter-dropdown-caret {
      margin-left: -7px;
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
      --mdc-outlined-text-field-container-shape: var(--radius-lg, 16px);

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

      // MatCheckbox's own box: fixed 2px, no token to override.
      ::ng-deep .mdc-checkbox__background {
        border-radius: var(--radius-sm, 4px);
      }
    }

    // The menu panel lives in the CDK overlay, outside this component —
    // Material caps it at 280px, which would clip the wide (organization) mode.
    ::ng-deep .mat-mdc-menu-panel.filter-dropdown-panel {
      max-width: none;
      --mat-menu-container-shape: var(--radius-md, 8px);
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

  /** Clear button on the chip: empties this filter right away, in both modes (no Confirm step). */
  protected clear(): void {
    this.draft.set([]);
    this.selectionChange.emit([]);
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
