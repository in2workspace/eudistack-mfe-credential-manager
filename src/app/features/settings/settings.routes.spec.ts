import { Route } from '@angular/router';
import settingsRoutes from './settings.routes';

describe('settings.routes', () => {
  const children = (settingsRoutes[0].children ?? []) as Route[];

  // EUD-72 §8 O-4: without this, /settings renders the sidenav over an empty pane.
  it('redirects the empty path to catalog', () => {
    const fallback = children.find(r => r.path === '');

    expect(fallback).toBeDefined();
    expect(fallback?.redirectTo).toBe('catalog');
    expect(fallback?.pathMatch).toBe('full');
  });

  it('keeps the schemes and catalog children reachable', () => {
    expect(children.map(r => r.path)).toEqual(expect.arrayContaining(['schemes', 'catalog']));
  });
});
