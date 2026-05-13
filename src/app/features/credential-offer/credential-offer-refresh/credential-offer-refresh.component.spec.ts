import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { CredentialOfferRefreshComponent } from './credential-offer-refresh.component';
import { CredentialOfferRefreshService } from './services/credential-offer-refresh.service';
import { ThemeService } from 'src/app/core/services/theme.service';

const TOKEN = 'test-token-123';

function buildActivatedRoute(token: string = TOKEN) {
  return {
    snapshot: { paramMap: convertToParamMap({ token }) }
  };
}

describe('CredentialOfferRefreshComponent', () => {
  let component: CredentialOfferRefreshComponent;
  let refreshService: jest.Mocked<CredentialOfferRefreshService>;

  const themeServiceMock = {
    snapshot: { branding: { logoUrl: 'https://example.com/logo.png' } }
  };

  beforeEach(async () => {
    refreshService = {
      refreshCredentialOffer: jest.fn()
    } as unknown as jest.Mocked<CredentialOfferRefreshService>;

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CredentialOfferRefreshComponent],
      providers: [
        { provide: ActivatedRoute, useValue: buildActivatedRoute() },
        { provide: CredentialOfferRefreshService, useValue: refreshService },
        { provide: ThemeService, useValue: themeServiceMock },
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CredentialOfferRefreshComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in idle state', () => {
    expect(component.state()).toBe('idle');
  });

  it('should read token from route params on init', () => {
    expect((component as any).token).toBe(TOKEN);
  });

  it('should expose logoSrc from ThemeService snapshot', () => {
    expect(component.logoSrc).toBe('https://example.com/logo.png');
  });

  it('should set logoSrc to null when ThemeService snapshot has no logo', async () => {
    await TestBed.resetTestingModule();

    const emptyThemeMock = { snapshot: null };

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CredentialOfferRefreshComponent],
      providers: [
        { provide: ActivatedRoute, useValue: buildActivatedRoute() },
        { provide: CredentialOfferRefreshService, useValue: refreshService },
        { provide: ThemeService, useValue: emptyThemeMock },
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CredentialOfferRefreshComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.logoSrc).toBeNull();
  });

  describe('sendOffer()', () => {
    it('should transition to success state on successful POST', () => {
      refreshService.refreshCredentialOffer.mockReturnValue(of(undefined as void));

      component.sendOffer();

      expect(refreshService.refreshCredentialOffer).toHaveBeenCalledWith(TOKEN);
      expect(component.state()).toBe('success');
    });

    it('should transition to error state when POST fails', () => {
      refreshService.refreshCredentialOffer.mockReturnValue(throwError(() => new Error('Network error')));

      component.sendOffer();

      expect(refreshService.refreshCredentialOffer).toHaveBeenCalledWith(TOKEN);
      expect(component.state()).toBe('error');
    });

    it('should set loading state before the request resolves', () => {
      const states: string[] = [];
      let resolveRequest!: () => void;

      refreshService.refreshCredentialOffer.mockReturnValue(
        new Observable<void>(observer => {
          resolveRequest = () => { observer.next(); observer.complete(); };
        })
      );

      component.sendOffer();
      states.push(component.state());

      resolveRequest();
      states.push(component.state());

      expect(states).toEqual(['loading', 'success']);
    });
  });
});
