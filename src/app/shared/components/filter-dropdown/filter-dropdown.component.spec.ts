import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
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
});
