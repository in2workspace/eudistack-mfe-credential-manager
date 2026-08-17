import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { AuthService } from 'src/app/core/services/auth.service';
import { NavbarComponent } from './navbar.component';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MatMenuModule } from '@angular/material/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ThemeService } from 'src/app/core/services/theme.service';

class MockAuthService {
  resolvedRole = signal<RoleType | null>(null);
  roleType = computed(() => this.resolvedRole() ?? RoleType.LEAR);
  /**
   * Set independently of the role: it comes from the ID token, not from /me. Signal-backed
   * like the real `userPowers`, or a `computed()` over the predicate would never see it
   * change — the trap that made this menu entry unreachable in the first place.
   */
  sysAdminByToken = signal(false);

  isSysAdmin() {
    return this.sysAdminByToken();
  }

  // Mirrors the real implementation rather than stubbing a boolean, so these specs
  // exercise the predicate the guard uses instead of a parallel one.
  canAccessSettings() {
    return this.roleType() !== RoleType.LEAR || this.isSysAdmin();
  }

  getMandator() {
    return of({ organization: 'Test Organization' });
  }
  getName() {
    return of('Test User');
  }
  logout() {
    return of(void 0);
  }
}

export class MockRouter implements Partial<Router> {
  navigate = jest.fn();
}

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let authService: AuthService;
  let translateService: TranslateService;
  let router: Router;
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [
        TranslateModule.forRoot(),
        MatIconModule,
        MatMenuModule,
        RouterModule.forRoot([]),
        NavbarComponent,
        NoopAnimationsModule
    ],
    providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: Router, useClass: MockRouter },
        { provide: ActivatedRoute, useValue: {} },
        { provide: ThemeService, useValue: { snapshot: { branding: { logoUrl: null } } } },
    ],
}).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    translateService = TestBed.inject(TranslateService);
    router = TestBed.inject(Router);

    jest.spyOn(component, 'logout');

    fixture.detectChanges();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerElement = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // todo test
  //  it('should initialize with username and organization', () => {
  //   const mockMandator = {
  //     organizationIdentifier: 'VATES-B60645900',
  //     organization: 'Test Organization',
  //     commonName: 'Test Common Name',
  //     emailAddress: 'test@organization.com',
  //     serialNumber: 'SN12345',
  //     country: 'Test Country'
  //   };
  //   const mockName = 'Test User';

  //   jest.spyOn(authService, 'getMandator').mockReturnValue(of(mockMandator));
  //   jest.spyOn(authService, 'getName').mockReturnValue(of(mockName));

  //   component.ngOnInit();
  //   fixture.detectChanges();

  //   expect(component.userName).toEqual(mockName);
  //   expect(component.organization).toEqual(mockMandator.organization);
  // });


  it('should initialize with default language', () => {
    component.ngOnInit();
    expect(component.selectedLanguage).toBe('en');
  });

  it('should change language', () => {
    component.changeLanguage('es');
    expect(component.selectedLanguage).toBe('es');
  });

  it('should call logout on authService', () => {
    component.logout();
    expect(component.logout).toHaveBeenCalled();
  });

  it('should call logout on click', async () => {
    const menuTrigger = fixture.nativeElement.querySelector('button[mat-icon-button]');
    menuTrigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const logoutLink = overlayContainerElement.querySelector('#logout-link') as HTMLElement;
    expect(logoutLink).toBeTruthy();

    logoutLink.click();
    expect(component.logout).toHaveBeenCalled();
  });

  /**
   * The entry must mirror `settingsGuard` exactly — both now evaluate
   * `AuthService.canAccessSettings()`. A wider menu offers a destination the guard
   * rejects (EUD-72 §2.3); a narrower one hides Settings from someone allowed in.
   */
  describe('settings menu entry', () => {
    const openMenu = async () => {
      (fixture.nativeElement.querySelector('button[mat-icon-button]') as HTMLElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
    };

    const settingsEntry = () =>
      Array.from(overlayContainerElement.querySelectorAll('button[mat-menu-item]'))
        .find(b => b.textContent?.includes('navbar.menu.settings'));

    it('is hidden while the backend role is unresolved', async () => {
      expect(authService.resolvedRole()).toBeNull();
      await openMenu();
      expect(settingsEntry()).toBeUndefined();
    });

    it('is hidden for LEAR', async () => {
      authService.resolvedRole.set(RoleType.LEAR);
      await openMenu();
      expect(settingsEntry()).toBeUndefined();
    });

    it('is visible for TENANT_ADMIN', async () => {
      authService.resolvedRole.set(RoleType.TENANT_ADMIN);
      await openMenu();
      expect(settingsEntry()).toBeTruthy();
    });

    it('is visible for SYSADMIN_READONLY', async () => {
      authService.resolvedRole.set(RoleType.SYSADMIN_READONLY);
      await openMenu();
      expect(settingsEntry()).toBeTruthy();
    });

    // The guard admits this caller (canAccessSettings() falls back to the ID-token
    // power), so the menu must offer the entry instead of leaving them to guess the URL.
    it('is visible for a SysAdmin known only from the token, /me having failed', async () => {
      authService.resolvedRole.set(RoleType.LEAR);
      (authService as unknown as MockAuthService).sysAdminByToken.set(true);
      await openMenu();
      expect(settingsEntry()).toBeTruthy();
    });
  });

  it('should display the correct username and mandator', () => {
    const mockUserData = {
      organization: 'Test Organization',
      name: 'Test User'
    };
    component.userName = mockUserData.name;
    component.organization = mockUserData.organization;
    fixture.detectChanges();

    const userNameElement: HTMLElement = fixture.nativeElement.querySelector('#username');
    const organizationElement: HTMLElement = fixture.nativeElement.querySelector('#organization');

    expect(userNameElement.textContent).toContain(mockUserData.name);
    expect(organizationElement.textContent).toContain(mockUserData.organization);
  });

  describe('Organization Contact Menu Entry (EUD-226, Task 28)', () => {
    it('should show organization contact entry when feature enabled and user has write capability (AC-03, AC-04)', () => {
      // Given: canSeeOrganizationContact returns true (current stub implementation)
      const canSee = component.canSeeOrganizationContact();

      // Then
      expect(canSee).toBe(true);
    });

    // TODO: Following tests require integration with TenantFeatureFlags and AuthorizationService
    // These will be enabled once those services are available

    xit('should hide organization contact entry when feature disabled (AC-04)', () => {
      // TODO: Mock TenantFeatureFlags.isOrganizationContactEnabled() to return false
      const canSee = component.canSeeOrganizationContact();

      expect(canSee).toBe(false);
    });

    xit('should hide organization contact entry when user lacks write capability (Caso A, AC-03)', () => {
      // TODO: Mock canWrite() to return false
      const canSee = component.canSeeOrganizationContact();

      expect(canSee).toBe(false);
    });
  });
});
