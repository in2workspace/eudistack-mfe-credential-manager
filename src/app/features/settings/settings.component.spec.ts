import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let authService: { roleType: ReturnType<typeof signal<RoleType>> };

  const catalogLink = () => fixture.nativeElement.querySelector('[data-testid="nav-catalog"]');

  beforeEach(async () => {
    authService = { roleType: signal(RoleType.TENANT_ADMIN) };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent,  TranslateModule.forRoot()],
      providers: [{ provide: AuthService, useValue: authService }]
    })
    .overrideComponent(SettingsComponent, {
      set: { imports: [ TranslatePipe ] }
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // Neither section exists yet: the links reached a placeholder (schemes reused the issuance
  // form) or navigated out of Settings altogether (TF pointed at /organization/credentials).
  it('should not offer the unimplemented Schemes and Trust Framework sections', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a[mat-list-item]'));

    expect(links.length).toBe(1);
    expect(links.some(a => a.getAttribute('routerLink') === '/settings/schemes')).toBe(false);
    expect(links.some(a => a.getAttribute('routerLink') === '/organization/credentials')).toBe(false);
  });

  describe('credential catalog nav link (EUD-72)', () => {
    it('should be shown to a tenant admin', () => {
      expect(component.canSeeCatalog()).toBe(true);
      expect(catalogLink()).toBeTruthy();
    });

    // The platform SysAdmin may read the catalog (the screen renders read-only), so the
    // entry point must stay reachable for them.
    it('should be shown to the read-only platform SysAdmin', () => {
      authService.roleType.set(RoleType.SYSADMIN_READONLY);
      fixture.detectChanges();

      expect(component.canSeeCatalog()).toBe(true);
      expect(catalogLink()).toBeTruthy();
    });

    // The Issuer answers 403 to a LEAR on both verbs, so showing the link would be a dead end.
    it('should be hidden from a LEAR', () => {
      authService.roleType.set(RoleType.LEAR);
      fixture.detectChanges();

      expect(component.canSeeCatalog()).toBe(false);
      expect(catalogLink()).toBeNull();
    });
  });
});
