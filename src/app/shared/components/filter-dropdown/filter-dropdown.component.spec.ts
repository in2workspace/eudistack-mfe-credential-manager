import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatMenuTrigger } from '@angular/material/menu';
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

  it('emits an empty selection on clear, without opening the menu', () => {
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

  describe('menu', () => {
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

    function trigger(): MatMenuTrigger {
      return fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onOpened();
      fixture.detectChanges();

      expect(optionLabels()).toEqual(['A', 'B']);
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
        expect(trigger().menuOpen).toBe(false);
      });

      it('discards the draft on Close', () => {
        checkboxInputs()[1].click();
        fixture.detectChanges();

        footerButton('.filter-dropdown-close').click();
        fixture.detectChanges();

        expect(emitted).toEqual([]);
        expect(trigger().menuOpen).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).draft()).toEqual(['a']);
      });
    });
  });
});
