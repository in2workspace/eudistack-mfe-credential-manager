import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilterDropdownComponent } from './filter-dropdown.component';

describe('FilterDropdownComponent', () => {
  let fixture: ComponentFixture<FilterDropdownComponent>;
  let component: FilterDropdownComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule, FilterDropdownComponent],
    });

    fixture = TestBed.createComponent(FilterDropdownComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'filters.credentialType');
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    fixture.detectChanges();
  });

  function clearButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.filter-dropdown-clear');
  }

  it('has no clear button while nothing is selected', () => {
    expect(clearButton()).toBeNull();
  });

  it('shows the count and an accessible clear button when options are selected', () => {
    fixture.componentRef.setInput('selected', ['a', 'b']);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-dropdown-count')?.textContent.trim()).toBe('2');
    expect(clearButton()?.getAttribute('aria-label')).toBeTruthy();
  });

  it('includes the number of selected options in the trigger name', () => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      filters: { credentialType: 'Credential type', labelWithCount: '{{filter}}, {{count}} selected' },
    });
    translate.use('en');
    const trigger = (): string | null =>
      fixture.nativeElement.querySelector('.filter-dropdown-trigger').getAttribute('aria-label');
    fixture.detectChanges();
    expect(trigger()).toBe('Credential type');

    fixture.componentRef.setInput('selected', ['a', 'b']);
    fixture.detectChanges();
    expect(trigger()).toBe('Credential type, 2 selected');
  });

  it('emits an empty selection on clear, without opening the panel', () => {
    const emitted: string[][] = [];
    component.selectionChange.subscribe(value => emitted.push(value));
    fixture.componentRef.setInput('selected', ['a']);
    fixture.detectChanges();

    clearButton()!.click();
    fixture.detectChanges();

    expect(emitted).toEqual([[]]);
    expect(document.querySelector('.filter-dropdown-content')).toBeNull();
  });

  it('clears in footer (Confirm) mode too, with no Confirm step', () => {
    const emitted: string[][] = [];
    component.selectionChange.subscribe(value => emitted.push(value));
    fixture.componentRef.setInput('showFooter', true);
    fixture.componentRef.setInput('selected', ['a']);
    fixture.detectChanges();

    clearButton()!.click();

    expect(emitted).toEqual([[]]);
  });

  describe('panel', () => {
    let emitted: string[][];

    beforeEach(() => {
      emitted = [];
      component.selectionChange.subscribe(value => emitted.push(value));
    });

    function open(): void {
      fixture.nativeElement.querySelector('.filter-dropdown-trigger').click();
      fixture.detectChanges();
    }

    function panel(): HTMLElement | null {
      return document.querySelector('.filter-dropdown-content');
    }

    function checkboxInputs(): HTMLInputElement[] {
      return Array.from(document.querySelectorAll('.filter-dropdown-option input[type="checkbox"]'));
    }

    function optionLabels(): string[] {
      return Array.from(document.querySelectorAll('.filter-dropdown-option')).map(o => o.textContent!.trim());
    }

    function searchInput(): HTMLInputElement | null {
      return document.querySelector('.filter-dropdown-search input');
    }

    function typeSearch(term: string): void {
      const input = searchInput()!;
      input.value = term;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    function triggerButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('.filter-dropdown-trigger');
    }

    function isOpen(): boolean {
      return panel() !== null;
    }

    function footerButton(selector: string): HTMLButtonElement {
      return document.querySelector(`.filter-dropdown-footer ${selector}`) as HTMLButtonElement;
    }

    it('opens from the caret too', () => {
      fixture.nativeElement.querySelector('.filter-dropdown-caret').click();
      fixture.detectChanges();

      expect(panel()).toBeTruthy();
    });

    it('seeds the checkboxes from the applied selection on open', () => {
      fixture.componentRef.setInput('selected', ['b']);
      fixture.detectChanges();
      open();

      expect(checkboxInputs().map(i => i.checked)).toEqual([false, true]);
    });

    it('has no search or footer in live mode', () => {
      open();

      expect(searchInput()).toBeNull();
      expect(document.querySelector('.filter-dropdown-footer')).toBeNull();
      expect(document.querySelector('.filter-dropdown-title-row')).toBeNull();
    });

    it('emits on every toggle in live mode', () => {
      open();

      checkboxInputs()[0].click();
      fixture.detectChanges();
      checkboxInputs()[1].click();
      fixture.detectChanges();
      checkboxInputs()[0].click();
      fixture.detectChanges();

      expect(emitted).toEqual([['a'], ['a', 'b'], ['b']]);
    });

    it('filters options by the search term, case-insensitively', () => {
      fixture.componentRef.setInput('searchable', true);
      fixture.componentRef.setInput('options', [
        { value: 'acme', label: 'Acme Corp' },
        { value: 'glob', label: 'Globex' },
      ]);
      fixture.detectChanges();
      open();

      typeSearch('  GLOB ');
      expect(optionLabels()).toEqual(['Globex']);

      typeSearch('nothing');
      expect(optionLabels()).toEqual([]);
      expect(document.querySelector('.filter-dropdown-no-options')).toBeTruthy();

      typeSearch('');
      expect(optionLabels()).toEqual(['Acme Corp', 'Globex']);
    });

    it('resets the search term every time it opens', () => {
      fixture.componentRef.setInput('searchable', true);
      fixture.detectChanges();
      open();
      typeSearch('a');

      triggerButton().click(); // close
      fixture.detectChanges();
      open();

      expect(searchInput()!.value).toBe('');
      expect(optionLabels()).toEqual(['A', 'B']);
    });

    it('is announced as a dialog popup, named after the filter, and wired to its trigger', () => {
      expect(triggerButton().getAttribute('aria-haspopup')).toBe('dialog');
      expect(triggerButton().getAttribute('aria-expanded')).toBe('false');
      expect(triggerButton().getAttribute('aria-controls')).toBeNull();

      open();

      expect(panel()!.getAttribute('role')).toBe('dialog');
      expect(panel()!.getAttribute('aria-label')).toBe('filters.credentialType');
      expect(triggerButton().getAttribute('aria-expanded')).toBe('true');
      expect(triggerButton().getAttribute('aria-controls')).toBe(panel()!.id);
      expect(document.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();
    });

    it('moves focus into the panel on open and back to the trigger on close', () => {
      open();
      expect(document.activeElement).toBe(checkboxInputs()[0]);

      triggerButton().click();
      fixture.detectChanges();

      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(triggerButton());
    });

    it('focuses the search box first when there is one', () => {
      fixture.componentRef.setInput('searchable', true);
      fixture.detectChanges();
      open();

      expect(document.activeElement).toBe(searchInput());
    });

    it('closes on an outside click', () => {
      open();

      (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
      fixture.detectChanges();

      expect(isOpen()).toBe(false);
    });

    describe('footer mode', () => {
      beforeEach(() => {
        fixture.componentRef.setInput('showFooter', true);
        fixture.componentRef.setInput('selected', ['a']);
        fixture.detectChanges();
        open();
      });

      it('shows the title row with the draft count', () => {
        expect(document.querySelector('.filter-dropdown-title-row .filter-dropdown-count')?.textContent!.trim()).toBe('1');

        checkboxInputs()[0].click();
        fixture.detectChanges();

        expect(document.querySelector('.filter-dropdown-title-row .filter-dropdown-count')).toBeNull();
      });

      it('only emits the draft on Confirm, then closes', () => {
        checkboxInputs()[1].click();
        fixture.detectChanges();
        expect(emitted).toEqual([]);

        footerButton('[color="primary"]').click();
        fixture.detectChanges();

        expect(emitted).toEqual([['a', 'b']]);
        expect(isOpen()).toBe(false);
      });

      it('discards the draft on Close', () => {
        checkboxInputs()[1].click();
        fixture.detectChanges();

        footerButton('.filter-dropdown-close').click();
        fixture.detectChanges();

        expect(emitted).toEqual([]);
        expect(isOpen()).toBe(false);

        open();
        expect(checkboxInputs().map(i => i.checked)).toEqual([true, false]);
      });
    });

    describe('keyboard', () => {
      const KEY_CODES: Record<string, number> = { Tab: 9, Escape: 27, Home: 36, End: 35, ArrowDown: 40 };

      beforeEach(() => {
        fixture.componentRef.setInput('searchable', true);
        fixture.componentRef.setInput('showFooter', true);
        fixture.detectChanges();
        open();
      });

      function press(target: Element, key: string, shiftKey = false): KeyboardEvent {
        const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
        Object.defineProperty(event, 'keyCode', { get: () => KEY_CODES[key] });
        target.dispatchEvent(event);
        fixture.detectChanges();
        return event;
      }

      it('keeps the panel open when tabbing between its controls', () => {
        press(searchInput()!, 'Tab');
        press(checkboxInputs()[0], 'Tab');
        press(footerButton('.filter-dropdown-close'), 'Tab', true);

        expect(isOpen()).toBe(true);
      });

      it('closes the panel and refocuses the trigger when tabbing past the last control', () => {
        const event = press(footerButton('[color="primary"]'), 'Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(triggerButton());

        expect(isOpen()).toBe(false);
      });

      it('closes the panel when shift-tabbing before the first control', () => {
        press(searchInput()!, 'Tab', true);

        expect(isOpen()).toBe(false);
      });

      it('lets Home, End and arrows reach the search box', () => {
        const events = ['Home', 'End', 'ArrowDown'].map(key => press(searchInput()!, key));

        expect(events.map(e => e.defaultPrevented)).toEqual([false, false, false]);
        expect(isOpen()).toBe(true);
      });

      it('closes on Escape, refocusing the trigger', () => {
        press(searchInput()!, 'Escape');

        expect(document.activeElement).toBe(triggerButton());

        expect(isOpen()).toBe(false);
      });
    });
  });
});
