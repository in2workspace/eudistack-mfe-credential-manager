import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CredentialOfferRefreshService } from '../credential-offer-refresh.service';
import { environment } from 'src/environments/environment';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';

describe('CredentialOfferRefreshService', () => {
  let service: CredentialOfferRefreshService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CredentialOfferRefreshService,
      ]
    });

    service = TestBed.inject(CredentialOfferRefreshService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should POST to the correct URL with null body', () => {
    const token = 'abc-123';
    const expectedUrl = `${environment.server_url}${API_PATH.CREDENTIAL_OFFER_REFRESH}/${token}`;

    service.refreshCredentialOffer(token).subscribe();

    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null);
  });

  it('should propagate HTTP errors to the caller', () => {
    const token = 'bad-token';
    let error: unknown;

    service.refreshCredentialOffer(token).subscribe({
      error: (err) => { error = err; }
    });

    httpMock.expectOne(`${environment.server_url}${API_PATH.CREDENTIAL_OFFER_REFRESH}/${token}`)
      .flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(error).toBeTruthy();
  });
});
