import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ClipboardService {
  private clearTimer?: ReturnType<typeof setTimeout>;

  async copy(value: string, ttlMs?: number): Promise<void> {
    await navigator.clipboard.writeText(value);

    if (this.clearTimer !== undefined) {
      clearTimeout(this.clearTimer);
    }

    if (ttlMs === undefined) {
      this.clearTimer = undefined;
      return;
    }

    this.clearTimer = setTimeout(() => {
      this.clearTimer = undefined;

      navigator.clipboard.writeText('').catch((error) => {
        console.warn('Clipboard clear failed:', error);
      });
    }, ttlMs);
  }
}