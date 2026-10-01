import { formatDate, registerLocaleData } from '@angular/common';
import localeCa from '@angular/common/locales/ca';
import localeEs from '@angular/common/locales/es';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

registerLocaleData(localeCa);
registerLocaleData(localeEs);

export type LocalizedDateFormat = 'date' | 'time';

const DATE_FORMATS: Record<string, string> = {
  en: 'MMM d, y',
  es: 'd MMM y',
  ca: 'd LLL y',
};

/** Formats a date in the active language, following it when the language changes. */
@Pipe({
  name: 'localizedDate',
  standalone: true,
  pure: false,
})
export class LocalizedDatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private lastKey?: string;
  private lastResult: string | null = null;

  public transform(value: string | number | Date | null | undefined, format: LocalizedDateFormat = 'date'): string | null {
    if (value === null || value === undefined || value === '') return null;
    const lang = this.activeLanguage();
    const key = `${String(value)}|${format}|${lang}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastResult = format === 'time' ? formatDate(value, 'shortTime', lang) : this.formatDay(value, lang);
    }
    return this.lastResult;
  }

  private formatDay(value: string | number | Date, lang: string): string {
    const formatted = formatDate(value, DATE_FORMATS[lang], lang);
    // Catalan short month names end with a dot ("gen."), dropped to read "5 gen 2026".
    return lang === 'ca' ? formatted.replace('.', '') : formatted;
  }

  private activeLanguage(): string {
    const lang = this.translate.currentLang || this.translate.defaultLang;
    return lang && lang in DATE_FORMATS ? lang : 'en';
  }
}
