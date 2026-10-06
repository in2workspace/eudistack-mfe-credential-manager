import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { CredentialOfferRefreshComponent } from './credential-offer-refresh.component';
import { CredentialOfferRefreshService } from './services/credential-offer-refresh.service';
import { ThemeService } from 'src/app/core/services/theme.service';
import { TenantService } from 'src/app/core/services/tenant.service';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';

const TOKEN = 'test-token-123';
const SERVER_URL = 'https://issuer.test';

// The real Spanish bundle, so the assertions check the copy users actually see.
const ES = jest.requireActual<Record<string, Record<string, string>>>('src/assets/i18n/es.json');
const COPY = ES['credential-offer-refresh'];

const CREDENTIAL_OFFER_GONE_PROBLEM = {
  type: 'credential_offer_gone',
  title: 'Credential offer gone',
  status: 410,
  detail: 'This credential offer can no longer be refreshed',
  instance: '2c5f74d6-66cc-4ff1-bb8a-7604232f75e7'
};

function useSpanish(): void {
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('es', ES);
  translate.use('es');
}

function buildActivatedRoute(token: string = TOKEN) {
  return {
    snapshot: { paramMap: convertToParamMap({ token }) }
  };
}

describe('CredentialOfferRefreshComponent', () => {
  let fixture: ComponentFixture<CredentialOfferRefreshComponent>;
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

    useSpanish();

    fixture = TestBed.createComponent(CredentialOfferRefreshComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function failWith(status: number, error: unknown): void {
    refreshService.refreshCredentialOffer.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error })));
    component.sendOffer();
    fixture.detectChanges();
  }

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

    it('should transition to already-active state on CREDENTIAL_ALREADY_ACTIVE problem details', () => {
      refreshService.refreshCredentialOffer.mockReturnValue(throwError(() => new HttpErrorResponse({
        status: 410,
        error: {
          type: 'credential_already_active',
          title: 'Credential already active',
          status: 410,
          detail: 'The credential is already active.',
          instance: 'd8f87c0a-e327-4dda-bfa9-5000cb8e1f1d'
        }
      })));

      component.sendOffer();

      expect(component.state()).toBe('already-active');
    });

    it('should transition to revoked state on 410 + credential_offer_gone problem details', () => {
      failWith(410, CREDENTIAL_OFFER_GONE_PROBLEM);

      expect(component.state()).toBe('revoked');
    });

    it.each([
      ['a 410 with another problem type', 410, { type: 'OFFER_EXPIRED', status: 410 }],
      ['a 410 without body', 410, null],
      ['a 404', 404, { type: 'NOT_FOUND', status: 404 }],
      ['a 500', 500, 'Internal Server Error'],
      ['a network failure', 0, new ProgressEvent('error')],
    ])('should transition to generic error state on %s', (_label, status, error) => {
      refreshService.refreshCredentialOffer.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status, error }))
      );

      component.sendOffer();

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

  describe('revoked screen (410 + credential_offer_gone)', () => {
    beforeEach(() => failWith(410, CREDENTIAL_OFFER_GONE_PROBLEM));

    it('should show "Credencial no disponible" as the single page heading', () => {
      const headings = host().querySelectorAll('h1, h2, h3, h4, h5, h6');

      expect(headings).toHaveLength(1);
      expect(headings[0].tagName).toBe('H1');
      expect(headings[0].textContent?.trim()).toBe('Credencial no disponible');
    });

    it('should show the revoked description', () => {
      expect(host().querySelector('p')?.textContent?.trim())
        .toBe('La credencial ya no está disponible. Ponte en contacto con tu organización para emitir una nueva.');
    });

    it('should not render the retry button', () => {
      expect(host().textContent).not.toContain(COPY['retry-btn']);
    });

    it('should not render any call to action or interactive element', () => {
      expect(host().querySelectorAll('button, a, input, select, textarea, [tabindex], [role="button"]')).toHaveLength(0);
    });

    it('should replace the generic error copy', () => {
      expect(host().textContent).not.toContain(COPY['error-title']);
      expect(host().textContent).not.toContain(COPY['error-description']);
    });

    it('should announce the title and description to assistive technology', () => {
      const alert = host().querySelector('[role="alert"]');

      expect(alert?.querySelector('h1')?.textContent?.trim()).toBe('Credencial no disponible');
      expect(alert?.querySelector('p')?.textContent?.trim())
        .toBe('La credencial ya no está disponible. Ponte en contacto con tu organización para emitir una nueva.');
    });

    it('should render the message without an icon', () => {
      expect(host().querySelector('.icon')).toBeNull();
    });
  });

  describe('generic error screen', () => {
    it.each([
      ['a 410 with another problem type', 410, { type: 'OFFER_EXPIRED', status: 410 }],
      ['a 500', 500, 'Internal Server Error'],
    ])('should keep showing the generic error with a retry button on %s', (_label, status, error) => {
      failWith(status, error);

      expect(host().querySelector('h1')?.textContent?.trim()).toBe(COPY['error-title']);
      expect(host().querySelector('button')?.textContent?.trim()).toBe(COPY['retry-btn']);
      expect(host().textContent).not.toContain(COPY['revoked-title']);
    });

    it('should retry the request when the retry button is clicked', () => {
      failWith(500, 'Internal Server Error');
      refreshService.refreshCredentialOffer.mockReturnValue(of(undefined as void));

      (host().querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(refreshService.refreshCredentialOffer).toHaveBeenCalledTimes(2);
      expect(component.state()).toBe('success');
    });
  });
});

// Wires the component to the real CredentialOfferRefreshService over HttpClient, so the
// whole path (POST, Angular-built HttpErrorResponse, state resolution, rendering) runs
// against the response shapes the backend actually returns.
describe('CredentialOfferRefreshComponent (HTTP integration)', () => {
  const url = `${SERVER_URL}${API_PATH.CREDENTIAL_OFFER_REFRESH}/${TOKEN}`;
  let fixture: ComponentFixture<CredentialOfferRefreshComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CredentialOfferRefreshComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: buildActivatedRoute() },
        { provide: TenantService, useValue: { serverUrl: SERVER_URL } },
        { provide: ThemeService, useValue: { snapshot: null } },
      ]
    }).compileComponents();

    useSpanish();
    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(CredentialOfferRefreshComponent);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function sendAndRespond(body: Parameters<TestRequest["flush"]>[0], init?: { status: number; statusText: string }): HTMLElement {
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    req.flush(body, init);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it('should show the revoked screen on 410 + credential_offer_gone', () => {
    const el = sendAndRespond(CREDENTIAL_OFFER_GONE_PROBLEM, { status: 410, statusText: 'Gone' });

    expect(fixture.componentInstance.state()).toBe('revoked');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Credencial no disponible');
    expect(el.querySelector('button')).toBeNull();
  });

  it('should keep the current generic flow on a different 410', () => {
    const el = sendAndRespond({ type: 'OFFER_EXPIRED', status: 410 }, { status: 410, statusText: 'Gone' });

    expect(fixture.componentInstance.state()).toBe('error');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(COPY['error-title']);
    expect(el.querySelector('button')?.textContent?.trim()).toBe(COPY['retry-btn']);
  });

  it('should keep the current generic flow on a 500', () => {
    const el = sendAndRespond('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(fixture.componentInstance.state()).toBe('error');
    expect(el.querySelector('button')?.textContent?.trim()).toBe(COPY['retry-btn']);
  });

  it('should show the success screen on a successful response', () => {
    const el = sendAndRespond(null);

    expect(fixture.componentInstance.state()).toBe('success');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(COPY['success-title']);
    expect(el.querySelector('button')).toBeNull();
  });
});
