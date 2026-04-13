import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AuthService } from 'src/app/core/services/auth.service';
import { ThemeService } from 'src/app/core/services/theme.service';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let debugElement: DebugElement;
  let mockAuthService: jest.Mocked<AuthService>;

  mockAuthService = {
    getMandator: () => of(null),
    getName() {
      return of('Name');
    },
    logout() {
      return of(void 0);
    },
    hasAdminOrganizationIdentifier() {
      return true;
    },
    hasPower: () => true,
  } as jest.Mocked<any>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [
        NoopAnimationsModule,
        RouterOutlet,
        TranslateModule.forRoot(),
        AppComponent,
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: {} } } },
        { provide: ThemeService, useValue: { snapshot: { branding: { logoUrl: null } } } },
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    debugElement = fixture.debugElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have title "Credential-issuer-ui"', () => {
    expect(component.title).toBe('Credential-issuer-ui');
  });

  it('should contain a router-outlet in the template', () => {
    const routerOutlet = debugElement.query(By.css('router-outlet'));
    expect(routerOutlet).not.toBeNull();
  });

  it('should always render the navbar', () => {
    const navbar = debugElement.query(By.css('app-navbar'));
    expect(navbar).not.toBeNull();
  });

});
