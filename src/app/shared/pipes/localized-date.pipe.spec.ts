import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocalizedDatePipe } from './localized-date.pipe';

describe('LocalizedDatePipe', () => {
  const date = new Date(2026, 0, 5, 15, 4);
  let pipe: LocalizedDatePipe;
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    translate = TestBed.inject(TranslateService);
    pipe = TestBed.runInInjectionContext(() => new LocalizedDatePipe());
  });

  it.each([
    ['en', 'Jan 5, 2026'],
    ['es', '5 ene 2026'],
    ['ca', '5 gen 2026'],
  ])('formats the day in %s', (lang, expected) => {
    translate.use(lang);

    expect(pipe.transform(date)).toBe(expected);
  });

  it.each([
    ['en', '3:04 PM'],
    ['es', '15:04'],
  ])('formats the time in %s', (lang, expected) => {
    translate.use(lang);

    expect(pipe.transform(date, 'time')).toBe(expected);
  });

  it('follows a language change', () => {
    translate.use('en');
    expect(pipe.transform(date)).toBe('Jan 5, 2026');

    translate.use('ca');
    expect(pipe.transform(date)).toBe('5 gen 2026');
  });

  it('falls back to English for a language without date formats', () => {
    translate.use('fr');

    expect(pipe.transform(date)).toBe('Jan 5, 2026');
  });

  it('returns null for a missing date', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform('')).toBeNull();
  });
});
