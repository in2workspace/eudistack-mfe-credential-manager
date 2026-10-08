import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { FilterOption } from 'src/app/core/models/entity/lear-credential-management';

/** Below the chip, left-aligned; flips to right-aligned and/or above when there is no room. */
const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

let nextPanelId = 0;

/**
 * Anchored checkbox-dropdown filter. The panel is a non-modal dialog in a CDK overlay, not a
 * MatMenu: it holds a search box, checkboxes and buttons, none of which are menu items, so
 * screen readers must not announce it as a menu. It behaves like a popover: it opens below
 * the chip, takes focus, and closes on Escape, an outside click or tabbing out of it, giving
 * focus back to the chip.
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
    FormsModule,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './filter-dropdown.component.html',
  styleUrl: './filter-dropdown.component.scss',
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

  protected readonly panelId = `filter-dropdown-panel-${nextPanelId++}`;
  protected readonly panelPositions = PANEL_POSITIONS;
  protected readonly isOpen = signal(false);
  protected readonly draft = signal<string[]>([]);
  protected readonly searchTerm = signal('');

  protected readonly filteredOptions = computed<FilterOption[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.options();
    return this.options().filter(o => o.label.toLowerCase().includes(term));
  });

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly overlay = viewChild.required(CdkConnectedOverlay);

  protected open(): void {
    if (this.isOpen()) return;
    this.draft.set([...this.selected()]);
    this.searchTerm.set('');
    this.isOpen.set(true);
  }

  protected toggleOpen(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Closes the panel and hands focus back to the chip, as leaving any popover does. */
  protected close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.trigger().nativeElement.focus();
  }

  /** The overlay detached on its own (e.g. its scroll strategy closed it): keep the state in sync. */
  protected onDetached(): void {
    this.isOpen.set(false);
  }

  /** Moves focus into the panel once it is on screen: the search box, else the first checkbox. */
  protected onAttached(): void {
    this.overlay().overlayRef.overlayElement
      .querySelector<HTMLElement>('input, button:not([disabled])')
      ?.focus();
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

  /** Escape reaches the overlay's own keydown stream wherever focus is inside the panel. */
  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  /**
   * The panel sits at the end of the page, outside the document's tab order around the chip,
   * so Tab out of its first or last control closes it instead of wandering off.
   */
  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && this.leavesPanel(event)) {
      event.preventDefault();
      this.close();
    }
  }

  protected confirm(): void {
    this.selectionChange.emit(this.draft());
    this.close();
  }

  protected cancel(): void {
    this.draft.set([...this.selected()]);
    this.close();
  }

  private leavesPanel(event: KeyboardEvent): boolean {
    const controls = (event.currentTarget as HTMLElement).querySelectorAll('input, button:not([disabled])');
    return event.target === controls[event.shiftKey ? 0 : controls.length - 1];
  }
}
