import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ValidatedCriteriaComponent, validatedCriteriaToken } from './validated-criteria.component';

describe('ValidatedCriteriaComponent', () => {
  function render(criteria: string[] | null): ComponentFixture<ValidatedCriteriaComponent> {
    TestBed.configureTestingModule({
      imports: [ValidatedCriteriaComponent, TranslateModule.forRoot()],
      providers: [{ provide: validatedCriteriaToken, useValue: criteria }],
    });
    const fixture = TestBed.createComponent(ValidatedCriteriaComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one read-only input per criterion, in order', () => {
    const criteria = ['https://example.org/criteria/1', 'https://example.org/criteria/2'];

    const inputs: HTMLInputElement[] = Array.from(
      render(criteria).nativeElement.querySelectorAll('input.criteria__input')
    );

    expect(inputs.map(input => input.value)).toEqual(criteria);
    expect(inputs.every(input => input.readOnly)).toBe(true);
  });

  it('shows a dash when there are no criteria', () => {
    const element: HTMLElement = render(null).nativeElement;

    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('.no-data')?.textContent?.trim()).toBe('-');
  });
});
