import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';
import { TenantService } from 'src/app/core/services/tenant.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialCatalogComponent } from './credential-catalog.component';
import { CredentialCatalogService } from './credential-catalog.service';
import { CredentialCatalogEntry } from './catalog.models';

describe('CredentialCatalogComponent', () => {
  let fixture: ComponentFixture<CredentialCatalogComponent>;
  let component: CredentialCatalogComponent;

  let catalogService: { getCatalog: jest.Mock; updateCatalog: jest.Mock };
  let authService: { roleType: ReturnType<typeof signal<RoleType>> };
  let dialog: { openErrorInfoDialog: jest.Mock };
  // 'sandbox' sees every credential type, so the cases that are not about tenant visibility
  // are unaffected by it.
  let tenantService: { tenant: ReturnType<typeof signal<string>> };

  // Two distinct lineages, so both survive version filtering and the cases below still see
  // the two rows they were written against.
  const ID_A = 'learcredential.employee.w3c.1';
  const ID_B = 'learcredential.machine.w3c.1';

  const entries = (): CredentialCatalogEntry[] => [
    { credentialConfigurationId: ID_A, displayName: 'Type A', enabled: true },
    { credentialConfigurationId: ID_B, displayName: 'Type B', enabled: false }
  ];

  /** Creates the component after the mocks have been arranged for the case under test. */
  const createComponent = () => {
    fixture = TestBed.createComponent(CredentialCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  const texts = (selector: string): string[] =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll(selector))
      .map(e => e.textContent?.trim() ?? '');

  /** mat-slide-toggle renders a `button[role="switch"]`, not an input. */
  const switches = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('mat-slide-toggle button[role="switch"]'));

  beforeEach(async () => {
    catalogService = {
      getCatalog: jest.fn().mockReturnValue(of(entries())),
      updateCatalog: jest.fn().mockReturnValue(of(undefined))
    };
    authService = { roleType: signal(RoleType.TENANT_ADMIN) };
    dialog = { openErrorInfoDialog: jest.fn() };
    tenantService = { tenant: signal('sandbox') };

    await TestBed.configureTestingModule({
      imports: [CredentialCatalogComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        { provide: CredentialCatalogService, useValue: catalogService },
        { provide: AuthService, useValue: authService },
        { provide: DialogWrapperService, useValue: dialog },
        { provide: TenantService, useValue: tenantService }
      ]
    }).compileComponents();
  });

  // `globalThis.confirm` is spied on by the unsaved-changes cases; jest is not configured
  // with `restoreMocks`, so it would otherwise leak into the rest of the file.
  afterEach(() => {
    jest.restoreAllMocks();
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

  describe('latest version only', () => {
    const versioned: CredentialCatalogEntry[] = [
      { credentialConfigurationId: 'learcredential.employee.w3c.1', displayName: 'Employee W3C v1', enabled: true },
      { credentialConfigurationId: 'learcredential.employee.w3c.2', displayName: 'Employee W3C v2', enabled: false },
      { credentialConfigurationId: 'learcredential.employee.sd.1', displayName: 'Employee SD-JWT v1', enabled: false }
    ];

    const labels = (): string[] => texts('.catalog__label');

    it('should render only the newest version of each type and format', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      createComponent();

      // sd.1 survives: a different format is a different thing to version, not a variant.
      expect(labels()).toEqual(['Employee W3C v2', 'Employee SD-JWT v1']);
    });

    it('should keep the superseded versions out of the list but inside the payload', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      createComponent();

      expect(component.visibleEntries().length).toBe(2);
      expect(component.entries().length).toBe(3);
    });

    /**
     * The PUT replaces the whole enabled set. Hiding w3c.1 must not drop it from the payload,
     * or opening this screen and saving anything would silently disable it for the tenant.
     */
    it('should preserve a hidden enabled version when saving', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      createComponent();

      component.toggleEntry(versioned[1], true);
      component.save();

      expect(catalogService.updateCatalog).toHaveBeenCalledWith([
        'learcredential.employee.w3c.1',
        'learcredential.employee.w3c.2'
      ]);
    });

    it('should not warn about an empty set while a hidden version stays enabled', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      createComponent();

      // Every visible toggle is off, yet the payload is non-empty, so the backend will not reset.
      expect(component.visibleEntries().every(e => !e.enabled)).toBe(true);
      expect(component.showEmptyWarning()).toBe(false);
    });

    /**
     * The rest of the file relies on untranslated keys being echoed back, which is enough to
     * assert a label exists. These cases assert the format and version actually reach the
     * interpolation, so they need real strings.
     */
    const withTranslations = () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', {
        catalog: {
          version: 'v{{version}}',
          'toggle-aria': 'Enable {{name}}, format {{format}}, version {{version}}, for this tenant'
        },
        credentialIssuance: { format: { w3cVcDm: 'W3C VC Data Model v2.0', sdJwt: 'SD-JWT VC' } }
      }, true);
      translate.use('en');
    };

    it('should show the format and the version of each row', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      withTranslations();
      createComponent();

      expect(texts('.catalog__format')).toEqual(['W3C VC Data Model v2.0', 'SD-JWT VC']);
      expect(texts('.catalog__version')).toEqual(['v2', 'v1']);
    });

    it('should read the format and version off the configuration id', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      createComponent();

      expect(component.visibleEntries().map(r => [r.formatFamily, r.formatLabelKey, r.version])).toEqual([
        ['w3c', 'credentialIssuance.format.w3cVcDm', 2],
        ['sd', 'credentialIssuance.format.sdJwt', 1]
      ]);
    });

    it('should show an unmapped format token raw instead of dropping the row', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'learcredential.employee.brandnew.1', displayName: 'Employee', enabled: true }
      ]));
      withTranslations();
      createComponent();

      expect(component.visibleEntries()[0].formatLabelKey).toBeNull();
      expect(texts('.catalog__format')).toEqual(['brandnew']);
    });

    // Two formats of one type can share a display name, so the name alone is not a usable
    // accessible name; the format and version have to be in there too.
    it('should name each toggle by format and version as well', () => {
      catalogService.getCatalog.mockReturnValue(of(versioned));
      withTranslations();
      createComponent();

      expect(switches()[0].getAttribute('aria-label'))
        .toBe('Enable Employee W3C v2, format W3C VC Data Model v2.0, version 2, for this tenant');
      expect(switches()[1].getAttribute('aria-label'))
        .toBe('Enable Employee SD-JWT v1, format SD-JWT VC, version 1, for this tenant');
    });

    it('should compare versions numerically', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'learcredential.employee.w3c.9', displayName: 'v9', enabled: false },
        { credentialConfigurationId: 'learcredential.employee.w3c.10', displayName: 'v10', enabled: false }
      ]));
      createComponent();

      expect(labels()).toEqual(['v10']);
    });

    it('should hide entries whose id carries no version', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'learcredential.employee.w3c.1', displayName: 'Versioned', enabled: true },
        { credentialConfigurationId: 'LEAR_CREDENTIAL_EMPLOYEE', displayName: 'Legacy', enabled: true }
      ]));
      createComponent();

      expect(labels()).toEqual(['Versioned']);
    });

    // Otherwise the admin gets a blank list with no explanation of what went wrong.
    it('should fall back to the not-configured state when nothing is renderable', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'LEAR_CREDENTIAL_EMPLOYEE', displayName: 'Legacy', enabled: true }
      ]));
      createComponent();

      expect(component.notConfigured()).toBe(true);
      expect(el('#catalog-not-configured')).toBeTruthy();
      expect(dialog.openErrorInfoDialog).toHaveBeenCalledTimes(1);
    });
  });

  describe('tenant visibility', () => {
    const registry: CredentialCatalogEntry[] = [
      { credentialConfigurationId: 'learcredential.employee.w3c.1', displayName: 'Employee', enabled: true },
      { credentialConfigurationId: 'doctorid.sd.1', displayName: 'Doctor ID', enabled: true },
      { credentialConfigurationId: 'gx.labelcredential.w3c.2', displayName: 'Gaia-X Label', enabled: true }
    ];

    const namesFor = (tenant: string): string[] => {
      catalogService.getCatalog.mockReturnValue(of(registry));
      tenantService.tenant.set(tenant);
      createComponent();
      return texts('.catalog__label');
    };

    it('should show every type to sandbox', () => {
      expect(namesFor('sandbox')).toEqual(['Employee', 'Doctor ID', 'Gaia-X Label']);
    });

    it('should show every type to platform', () => {
      expect(namesFor('platform')).toEqual(['Employee', 'Doctor ID', 'Gaia-X Label']);
    });

    it('should show doctor id only to cgcom', () => {
      expect(namesFor('cgcom')).toEqual(['Employee', 'Doctor ID']);
    });

    it('should show the label only to dome', () => {
      expect(namesFor('dome')).toEqual(['Employee', 'Gaia-X Label']);
    });

    it('should hide both restricted types from any other tenant', () => {
      expect(namesFor('kpmg')).toEqual(['Employee']);
    });

    it('should hide restricted types when the tenant did not resolve', () => {
      expect(namesFor('')).toEqual(['Employee']);
    });

    /**
     * Same rule as the version filter: hiding is presentation. Dropping a restricted type
     * from the payload would disable it for the tenant, and the PUT replaces the whole set.
     */
    it('should keep a hidden restricted type enabled in the payload', () => {
      catalogService.getCatalog.mockReturnValue(of(registry));
      tenantService.tenant.set('kpmg');
      createComponent();

      component.toggleEntry(registry[0], false);
      component.save();

      expect(catalogService.updateCatalog).toHaveBeenCalledWith(['doctorid.sd.1', 'gx.labelcredential.w3c.2']);
    });

    it('should fall back to the not-configured state when every type is restricted away', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'doctorid.sd.1', displayName: 'Doctor ID', enabled: true }
      ]));
      tenantService.tenant.set('kpmg');
      createComponent();

      expect(component.notConfigured()).toBe(true);
      expect(el('#catalog-not-configured')).toBeTruthy();
    });

    it('should combine with the version filter', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: 'gx.labelcredential.w3c.1', displayName: 'Label v1', enabled: true },
        { credentialConfigurationId: 'gx.labelcredential.w3c.2', displayName: 'Label v2', enabled: false },
        { credentialConfigurationId: 'doctorid.sd.1', displayName: 'Doctor ID', enabled: true }
      ]));
      tenantService.tenant.set('dome');
      createComponent();

      // Label survives the tenant filter and only its newest version is offered; doctor id does not.
      expect(texts('.catalog__label')).toEqual(['Label v2']);
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

      expect(catalogService.updateCatalog).toHaveBeenCalledWith([ID_B]);
      expect(component.hasChanges()).toBe(false);
      expect((el('#catalog-save-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    // The PUT response carries no body and the backend may store something other than what
    // was sent, so the persisted state has to be re-read instead of assumed.
    it('should re-read the catalog after a successful save', () => {
      createComponent();
      expect(catalogService.getCatalog).toHaveBeenCalledTimes(1);

      const persisted: CredentialCatalogEntry[] = [
        { credentialConfigurationId: ID_A, displayName: 'Type A', enabled: false },
        { credentialConfigurationId: ID_B, displayName: 'Type B', enabled: true }
      ];
      catalogService.getCatalog.mockReturnValue(of(persisted));

      component.toggleEntry(entries()[0], false);
      component.toggleEntry(entries()[1], true);
      component.save();
      fixture.detectChanges();

      expect(catalogService.getCatalog).toHaveBeenCalledTimes(2);
      expect(component.entries()).toEqual(persisted);
      expect(switches()[0].getAttribute('aria-checked')).toBe('false');
      expect(switches()[1].getAttribute('aria-checked')).toBe('true');
      expect(component.hasChanges()).toBe(false);
    });

    it('should not re-read the catalog when there is nothing to save', () => {
      createComponent();

      component.save();

      expect(catalogService.getCatalog).toHaveBeenCalledTimes(1);
    });

    it('should keep the toggles disabled until the reload settles', () => {
      createComponent();

      const reload = new Subject<CredentialCatalogEntry[]>();
      catalogService.getCatalog.mockReturnValue(reload);

      component.toggleEntry(entries()[1], true);
      component.save();
      fixture.detectChanges();

      expect(component.saving()).toBe(true);
      expect(switches().every(t => t.disabled)).toBe(true);

      reload.next(entries());
      reload.complete();
      fixture.detectChanges();

      expect(component.saving()).toBe(false);
      expect(switches().every(t => t.disabled)).toBe(false);
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
        { credentialConfigurationId: ID_A, displayName: 'Type A', enabled: false }
      ]));
      createComponent();

      // Assertive rather than polite: the warning now explains why saving is refused.
      const warning = el('#catalog-empty-warning');
      expect(warning).toBeTruthy();
      expect(warning?.getAttribute('role')).toBe('alert');
      expect(warning?.getAttribute('aria-live')).toBe('assertive');
    });

    it('should appear as soon as the admin switches the last toggle off', () => {
      catalogService.getCatalog.mockReturnValue(of([
        { credentialConfigurationId: ID_A, displayName: 'Type A', enabled: true }
      ]));
      createComponent();
      expect(el('#catalog-empty-warning')).toBeNull();

      component.toggleEntry({ credentialConfigurationId: ID_A, displayName: 'Type A', enabled: true }, false);
      fixture.detectChanges();

      expect(el('#catalog-empty-warning')).toBeTruthy();
    });

    it('should not warn while at least one type stays enabled', () => {
      createComponent();

      expect(component.showEmptyWarning()).toBe(false);
      expect(el('#catalog-empty-warning')).toBeNull();
    });

    // Saving an empty set makes the backend drop the tenant configuration, which re-enables
    // every type — the opposite of what the admin just asked for. The PUT is refused instead.
    it('should block the save button once the last toggle goes off', () => {
      createComponent();

      component.toggleEntry(entries()[0], false);
      fixture.detectChanges();

      expect(component.hasChanges()).toBe(true);
      expect(component.canSave()).toBe(false);
      expect((el('#catalog-save-btn') as HTMLButtonElement).disabled).toBe(true);
      expect(el('#catalog-empty-warning')).toBeTruthy();
    });

    it('should never PUT an empty set', () => {
      createComponent();

      component.toggleEntry(entries()[0], false);
      component.save();

      expect(catalogService.updateCatalog).not.toHaveBeenCalled();
    });

    it('should unblock the save button as soon as a type is re-enabled', () => {
      createComponent();

      component.toggleEntry(entries()[0], false);
      component.toggleEntry(entries()[1], true);
      fixture.detectChanges();

      expect(component.canSave()).toBe(true);
      expect((el('#catalog-save-btn') as HTMLButtonElement).disabled).toBe(false);
      expect(el('#catalog-empty-warning')).toBeNull();
    });
  });

  describe('unsaved changes', () => {
    it('should let the admin leave while nothing has been touched', () => {
      const confirmSpy = jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
      createComponent();

      expect(component.canDeactivate()).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('should ask for confirmation when leaving with pending toggles', () => {
      const confirmSpy = jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
      createComponent();

      component.toggleEntry(entries()[1], true);

      expect(component.canDeactivate()).toBe(true);
      expect(confirmSpy).toHaveBeenCalled();
    });

    it('should keep the admin on the page when they cancel the confirmation', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(false);
      createComponent();

      component.toggleEntry(entries()[1], true);

      expect(component.canDeactivate()).toBe(false);
    });

    it('should stop tracking changes after a successful save', () => {
      const confirmSpy = jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
      createComponent();

      component.toggleEntry(entries()[1], true);
      component.save();

      expect(component.canDeactivate()).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('no credential type configured', () => {
    const expectNotConfigured = () => {
      expect(component.notConfigured()).toBe(true);
      expect(el('#catalog-not-configured')).toBeTruthy();
      expect(el('#catalog-load-error')).toBeNull();
      expect(dialog.openErrorInfoDialog).toHaveBeenCalledTimes(1);
      expect(dialog.openErrorInfoDialog.mock.calls[0][1]).toBe('catalog.error.not-configured.description');
      expect(dialog.openErrorInfoDialog.mock.calls[0][2]).toBe('catalog.error.not-configured.title');
    };

    it('should warn through a dialog when the backend returns an empty list', () => {
      catalogService.getCatalog.mockReturnValue(of([]));
      createComponent();

      expectNotConfigured();
    });

    it('should warn through a dialog on 404 instead of the generic load error', () => {
      catalogService.getCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      createComponent();

      expectNotConfigured();
    });

    it('should recover when a retry finds the catalog', () => {
      catalogService.getCatalog.mockReturnValueOnce(of([]));
      createComponent();

      catalogService.getCatalog.mockReturnValue(of(entries()));
      (el('#catalog-retry-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component.notConfigured()).toBe(false);
      expect(fixture.nativeElement.querySelectorAll('mat-slide-toggle').length).toBe(2);
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
      expect(component.entries().find(e => e.credentialConfigurationId === ID_B)?.enabled).toBe(true);
      expect(component.hasChanges()).toBe(true);
    });

    it('should not report a save error when only the post-save reload fails', () => {
      createComponent();

      catalogService.getCatalog.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.toggleEntry(entries()[1], true);
      component.save();
      fixture.detectChanges();

      expect(catalogService.updateCatalog).toHaveBeenCalledTimes(1);
      expect(component.saveError()).toBe(false);
      expect(el('#catalog-save-error')).toBeNull();
      expect(el('#catalog-load-error')).toBeTruthy();
      expect(el('#catalog-retry-btn')).toBeTruthy();
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
