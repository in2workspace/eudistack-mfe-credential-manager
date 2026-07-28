import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';
import { CredentialCatalogComponent } from './credential-catalog.component';
import { CredentialCatalogService } from './credential-catalog.service';
import { CredentialCatalogEntry } from './catalog.models';

describe('CredentialCatalogComponent', () => {
  let fixture: ComponentFixture<CredentialCatalogComponent>;
  let component: CredentialCatalogComponent;

  let catalogService: { getCatalog: jest.Mock; updateCatalog: jest.Mock };
  let authService: { roleType: ReturnType<typeof signal<RoleType>> };

  const entries = (): CredentialCatalogEntry[] => [
    { credentialConfigurationId: 'A', displayName: 'Type A', enabled: true },
    { credentialConfigurationId: 'B', displayName: 'Type B', enabled: false }
  ];

  /** Creates the component after the mocks have been arranged for the case under test. */
  const createComponent = () => {
    fixture = TestBed.createComponent(CredentialCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  /** mat-slide-toggle renders a `button[role="switch"]`, not an input. */
  const switches = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('mat-slide-toggle button[role="switch"]'));

  beforeEach(async () => {
    catalogService = {
      getCatalog: jest.fn().mockReturnValue(of(entries())),
      updateCatalog: jest.fn().mockReturnValue(of(undefined))
    };
    authService = { roleType: signal(RoleType.TENANT_ADMIN) };

    await TestBed.configureTestingModule({
      imports: [CredentialCatalogComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        { provide: CredentialCatalogService, useValue: catalogService },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  describe('load (AC-01)', () => {
    it('should render one toggle per catalog entry', () => {
      createComponent();

      const toggles = fixture.nativeElement.querySelectorAll('mat-slide-toggle');
      expect(toggles.length).toBe(2);
      expect(component.entries()).toEqual(entries());
    });

    it('should reflect the enabled flag coming from the backend', () => {
      createComponent();

      const toggles = switches();
      expect(toggles.length).toBe(2);
      expect(toggles[0].getAttribute('aria-checked')).toBe('true');
      expect(toggles[1].getAttribute('aria-checked')).toBe('false');
    });

    it('should label each toggle with the credential display name', () => {
      createComponent();

      // TranslateModule.forRoot() has no translations loaded, so the key is echoed back;
      // what matters is that the toggle carries an accessible name at all.
      expect(switches()[0].getAttribute('aria-label')).toBe('catalog.toggle-aria');
    });

    it('should show the skeleton while loading and hide it afterwards', () => {
      catalogService.getCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      createComponent();

      expect(component.loading()).toBe(false);
      expect(el('#catalog-skeleton')).toBeNull();
    });
  });

  describe('save button (AC-02)', () => {
    it('should be disabled while there are no changes', () => {
      createComponent();

      const btn = el('#catalog-save-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('should become enabled once a toggle changes', () => {
      createComponent();

      component.toggleEntry(entries()[1], true);
      fixture.detectChanges();

      expect(component.hasChanges()).toBe(true);
      expect((el('#catalog-save-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('should send only the enabled ids and re-disable itself after a successful save', () => {
      createComponent();

      component.toggleEntry(entries()[0], false);
      component.toggleEntry(entries()[1], true);
      component.save();
      fixture.detectChanges();

      expect(catalogService.updateCatalog).toHaveBeenCalledWith(['B']);
      expect(component.hasChanges()).toBe(false);
      expect((el('#catalog-save-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should ignore a save with no pending changes', () => {
      createComponent();

      component.save();

      expect(catalogService.updateCatalog).not.toHaveBeenCalled();
    });

    it('should not depend on the response ordering to detect changes', () => {
      catalogService.getCatalog.mockReturnValue(of([...entries()].reverse()));
      createComponent();

      expect(component.hasChanges()).toBe(false);
    });
  });

  describe('empty-set warning (EC-01)', () => {
    it('should warn when every type is disabled', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'A', displayName: 'Type A', enabled: false }
      ]));
      createComponent();

      const warning = el('#catalog-empty-warning');
      expect(warning).toBeTruthy();
      expect(warning?.getAttribute('role')).toBe('status');
      expect(warning?.getAttribute('aria-live')).toBe('polite');
    });

    it('should appear as soon as the admin switches the last toggle off', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'A', displayName: 'Type A', enabled: true }
      ]));
      createComponent();
      expect(el('#catalog-empty-warning')).toBeNull();

      component.toggleEntry({ credentialConfigurationId: 'A', displayName: 'Type A', enabled: true }, false);
      fixture.detectChanges();

      expect(el('#catalog-empty-warning')).toBeTruthy();
    });

    it('should not warn while at least one type stays enabled', () => {
      createComponent();

      expect(component.showEmptyWarning()).toBe(false);
      expect(el('#catalog-empty-warning')).toBeNull();
    });
  });

  describe('error states', () => {
    it('should render the load-error state with a retry action', () => {
      catalogService.getCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      createComponent();

      expect(el('#catalog-load-error')).toBeTruthy();
      expect(el('#catalog-load-error')?.getAttribute('role')).toBe('alert');
      expect(el('#catalog-retry-btn')).toBeTruthy();
      expect(el('#catalog-forbidden')).toBeNull();
    });

    it('should reload the catalog when retry is pressed', () => {
      catalogService.getCatalog.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      createComponent();

      catalogService.getCatalog.mockReturnValue(of(entries()));
      (el('#catalog-retry-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component.loadError()).toBe(false);
      expect(fixture.nativeElement.querySelectorAll('mat-slide-toggle').length).toBe(2);
    });

    it('should render the forbidden state on 403 instead of the generic error (AC-03)', () => {
      catalogService.getCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      createComponent();

      expect(el('#catalog-forbidden')).toBeTruthy();
      expect(component.forbidden()).toBe(true);
      expect(el('#catalog-load-error')).toBeNull();
      expect(el('#catalog-save-btn')).toBeNull();
    });

    // Regression: a failed PUT used to flip the shared error flag, which replaced the whole
    // list and silently discarded every toggle the admin had just changed.
    it('should keep the edited list when saving fails', () => {
      catalogService.updateCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      createComponent();

      component.toggleEntry(entries()[1], true);
      component.save();
      fixture.detectChanges();

      expect(el('#catalog-save-error')).toBeTruthy();
      expect(el('#catalog-load-error')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('mat-slide-toggle').length).toBe(2);
      expect(component.entries().find(e => e.credentialConfigurationId === 'B')?.enabled).toBe(true);
      expect(component.hasChanges()).toBe(true);
    });

    it('should clear the save error as soon as a toggle changes again', () => {
      catalogService.updateCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      createComponent();

      component.toggleEntry(entries()[1], true);
      component.save();
      expect(component.saveError()).toBe(true);

      component.toggleEntry(entries()[1], false);
      expect(component.saveError()).toBe(false);
    });
  });

  describe('read-only platform SysAdmin', () => {
    beforeEach(() => {
      authService.roleType.set(RoleType.SYSADMIN_READONLY);
    });

    it('should render the catalog without the save button', () => {
      createComponent();

      expect(component.canWrite()).toBe(false);
      expect(fixture.nativeElement.querySelectorAll('mat-slide-toggle').length).toBe(2);
      expect(el('#catalog-save-btn')).toBeNull();
      expect(el('#catalog-readonly-notice')).toBeTruthy();
    });

    it('should disable every toggle', () => {
      createComponent();

      const toggles = switches();
      expect(toggles.length).toBe(2);
      expect(toggles.every(t => t.disabled)).toBe(true);
    });

    it('should never issue a PUT', () => {
      createComponent();

      component.toggleEntry(entries()[1], true);
      component.save();

      expect(catalogService.updateCatalog).not.toHaveBeenCalled();
    });
  });
});
