import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { inject, Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { TenantService } from '../services/tenant.service';

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
