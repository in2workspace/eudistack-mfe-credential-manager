import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { inject, Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { TenantService } from '../services/tenant.service';
import { API_PATH } from '../constants/api-paths.constants';

@Injectable()
export class ServeErrorInterceptor implements HttpInterceptor {
  private readonly dialog = inject(DialogWrapperService);
  private readonly translate = inject(TranslateService);
  private readonly tenantService = inject(TenantService);

  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // ignore IAM endpoint; its errors are handled in a lower level
        const iamUrl = this.tenantService.iamUrl();
        if (iamUrl && request.url.startsWith(iamUrl)) {
          this.logHandledSilentlyError(error);
          return throwError(() => error);
        }

        // Static assets never justify a dialog. Every one of them is fetched by code that
        // owns a fallback for its absence — the theme, the translations, the tenant
        // custom-domain map, the issuance UI policy — so a missing or not-yet-published file
        // degrades where it is read, on its own terms. Surfacing it here would put a bare
        // "not found" in front of a user who did nothing and can do nothing about it, on
        // every page load, while the screen behind it works.
        if (this.isStaticAsset(request.url)) {
          this.logHandledSilentlyError(error);
          return throwError(() => error);
        }

        // The credential catalog screen (EUD-72) renders its own error states —
        // forbidden/not-configured/generic-with-retry — for every failure shape this
        // endpoint can return, deliberately (see CredentialCatalogComponent). A blocking
        // modal here would sit on top of that screen and hide its "Reintentar" action,
        // which is exactly the failure this bug report describes: a dead-end dialog with
        // only "Cerrar" instead of a recoverable, in-context error.
        if (this.isCredentialCatalogEndpoint(request.url)) {
          this.logHandledSilentlyError(error);
          return throwError(() => error);
        }
        // The issuance submit (POST /api/v1/issuances) owns its failure UX: CredentialIssuanceService
        // opens the "could not create" dialog with the business reason when the Issuer gives one
        // (I-03). Answering here too would put a generic "forbidden"/"unknown" text in front of it --
        // the very message the bug report complained about.
        if (this.isIssuanceSubmit(request)) {
          this.logHandledSilentlyError(error);
          return throwError(() => error);
        }

        // The credential offer refresh screen renders its own outcome for every failure —
        // including functional ones such as credential_already_active — so a generic
        // "unknown error" dialog on top of it would contradict the in-page message.
        if (this.isCredentialOfferRefreshEndpoint(request.url)) {
          this.logHandledSilentlyError(error);
          return throwError(() => error);
        }
        let errorMessage: string;
        if (error.error instanceof ErrorEvent) {
          errorMessage = `Error: ${error.error.message}`;
        } else {
          errorMessage = this.getServerErrorMessage(error);
        }
        const translatedMessage = this.translate.instant(errorMessage);
        this.dialog.openErrorInfoDialog(DialogComponent, translatedMessage);

        return throwError(() => error);
      })
    );
  }

  /**
   * Whether the request targets a static asset rather than an API.
   *
   * Covers the three shapes in use: absolute paths under the shared tenant prefix
   * (`/assets/tenants/issuance-ui.json`), paths relative to this app's base href
   * (`assets/theme.json`, resolved as `/issuer/assets/...`), and fully qualified URLs. The
   * segment boundaries keep it from matching an API path that merely contains the word.
   */
  private isStaticAsset(url: string): boolean {
    const path = /^https?:\/\//.test(url) ? new URL(url).pathname : url;
    return /(^|\/)assets\//.test(path);
  }

  private isCredentialCatalogEndpoint(url: string): boolean {
    const path = /^https?:\/\//.test(url) ? new URL(url).pathname : url;
    return path.endsWith(API_PATH.CREDENTIAL_CATALOG);
  }

  private isIssuanceSubmit(request: HttpRequest<unknown>): boolean {
    if (request.method !== 'POST') return false;
    const path = /^https?:\/\//.test(request.url) ? new URL(request.url).pathname : request.url;
    return path.endsWith(API_PATH.PROCEDURES);
  }

  private isCredentialOfferRefreshEndpoint(url: string): boolean {
    const path = /^https?:\/\//.test(url) ? new URL(url).pathname : url;
    return path.includes(`${API_PATH.CREDENTIAL_OFFER_REFRESH}/`);
  }

  private getServerErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 404:
        return 'error.not_found';
      case 401:
        return 'error.unauthorized';
      case 403:
        return 'error.forbidden';
      case 500:
        return 'error.internal_server';
      default:
        return 'error.unknown_error';
    }
  }

  private logHandledSilentlyError(error: Error): void{
    console.error('Handled silently:');
    console.error(error);
  }
}
