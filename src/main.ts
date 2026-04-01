import { APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { environment } from 'src/environments/environment';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { ServeErrorInterceptor } from './app/core/interceptors/server-error-interceptor';
import { AuthInterceptor, AuthModule } from 'angular-auth-oidc-client';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { RouterModule } from "@angular/router";
import { routes } from "./app/app.routes";
import { httpTranslateLoader } from "./app/core/services/translate-http-loader.factory";
import { overrideDefaultValueAccessor } from './app/core/overrides/value-accessor.overrides';
import { IAM_PARAMS, IAM_POST_LOGIN_ROUTE, IAM_POST_LOGOUT_URI, IAM_REDIRECT_URI } from './app/core/constants/iam.constants';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatPaginatorIntlService } from './app/shared/services/mat-paginator-intl.service';
import { ThemeService } from './app/core/services/theme.service';

function initializeTheme(themeService: ThemeService): () => Promise<void> {
  return () => themeService.load();
}

overrideDefaultValueAccessor();

bootstrapApplication(AppComponent, {
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        {
            provide: APP_INITIALIZER,
            useFactory: initializeTheme,
            deps: [ThemeService],
            multi: true
        },
        {
            provide: MatPaginatorIntl,
            useClass: MatPaginatorIntlService
        },
        importProvidersFrom(BrowserModule, RouterModule.forRoot(routes), TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: httpTranslateLoader,
                deps: [HttpClient]
            }
        }), AuthModule.forRoot({
            config: {
                logLevel: 1, // DEBUG: temporary to diagnose auth flow
                postLoginRoute: IAM_POST_LOGIN_ROUTE,
                authority: environment.iam_url,
                redirectUrl: IAM_REDIRECT_URI,
                postLogoutRedirectUri: IAM_POST_LOGOUT_URI,
                clientId: environment.client_id ?? IAM_PARAMS.CLIENT_ID,
                scope: IAM_PARAMS.SCOPE,
                responseType: IAM_PARAMS.GRANT_TYPE,
                silentRenew: true,
                useRefreshToken: true,
                historyCleanupOff: false,
                ignoreNonceAfterRefresh: true,
                triggerRefreshWhenIdTokenExpired: false,
                autoUserInfo: false,
                secureRoutes: [environment.server_url, environment.iam_url].filter((route): route is string => route !== undefined),
            },
        })),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ServeErrorInterceptor, multi: true },
        provideAnimations(),
    ]
})
  .catch(err => console.error(err));
