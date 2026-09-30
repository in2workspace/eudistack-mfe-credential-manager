import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

// jsdom has no layout, so no ResizeObserver either; a no-op stands in for it.
globalThis.ResizeObserver ??= class {
  observe(): void {
    // no-op: jsdom never resizes anything
  }
  unobserve(): void {
    // no-op: nothing is ever observed
  }
  disconnect(): void {
    // no-op: nothing is ever observed
  }
};
