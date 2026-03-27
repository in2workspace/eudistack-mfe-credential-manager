import { inject, Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ThemeService } from '../services/theme.service';
import { environment } from 'src/environments/environment';

/**
 * Injects the X-Tenant-Domain header on every API request to the issuer backend.
 *
 * On local dev and OVH, nginx injects this header via proxy_set_header.
 * On AWS (Amplify → ALB, no nginx), the MFE must add it explicitly.
 *
 * TEMPORARY WORKAROUND — remove when an API Gateway handles tenant resolution.
 * See: project_aws_stg_workarounds.md §4
 */
@Injectable()
export class TenantHeaderInterceptor implements HttpInterceptor {
  private readonly themeService = inject(ThemeService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const serverUrl = environment.server_url;
    if (!serverUrl || !req.url.startsWith(serverUrl)) {
      return next.handle(req);
    }

    const tenant = this.themeService.tenantDomain;
    if (!tenant) {
      return next.handle(req);
    }

    const cloned = req.clone({
      setHeaders: { 'X-Tenant-Domain': tenant },
    });
    return next.handle(cloned);
  }
}
