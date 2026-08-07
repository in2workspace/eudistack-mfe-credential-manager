import { APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { environment } from 'src/environments/environment';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { ServeErrorInterceptor } from './app/core/interceptors/server-error-interceptor';
import { AuthInterceptor, AuthModule, StsConfigLoader } from 'angular-auth-oidc-client';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { RouterModule } from "@angular/router";
import { routes } from "./app/app.routes";
import { httpTranslateLoader } from "./app/core/services/translate-http-loader.factory";
import { overrideDefaultValueAccessor } from './app/core/overrides/value-accessor.overrides';
import { CREDENTIAL_SCHEMA_PROVIDERS } from './app/features/credential-issuance/services/issuance-schema-builders/issuance-schema-builder';
import { LearCredentialEmployeeSchemaProvider } from './app/features/credential-issuance/services/issuance-schema-builders/lear-credential-employee-issuance-schema-provider';
import { LearCredentialMachineIssuanceSchemaProvider } from './app/features/credential-issuance/services/issuance-schema-builders/lear-credential-machine-issuance-schema-provider';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatPaginatorIntlService } from './app/shared/services/mat-paginator-intl.service';
import { ThemeService } from './app/core/services/theme.service';
import { TenantService } from './app/core/services/tenant.service';
import { IssuanceUiPolicyService } from './app/core/services/issuance-ui-policy.service';
import { oidcConfigFactory } from './app/core/auth/oid-config.factory';

function initializeApp(
  tenantService: TenantService,
  themeService: ThemeService,
  issuanceUiPolicyService: IssuanceUiPolicyService,
): () => Promise<void> {
  return async () => {
    // The tenant is the prerequisite of everything tenant-scoped: the policy needs tenant()
    // to pick its entry, and the theme will need it too once branding moves per tenant.
    await tenantService.resolve();

    // Started here but NOT awaited: the request rides along with the theme fetch, so in the
    // normal case the issuance screen finds it already resolved. Awaiting it would put a
    // retrying, fail-closed fetch of a document only ONE screen needs in front of the first
    // paint — a tenant whose policy is unreachable must still reach its issued credentials
    // without delay. Whoever needs it awaits the same memoized promise (see
    // CredentialIssuanceService), so nothing renders against a half-loaded policy.
    void issuanceUiPolicyService.load();

    await themeService.load();
  };
}

overrideDefaultValueAccessor();

bootstrapApplication(AppComponent, {
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        {
            provide: APP_INITIALIZER,
            useFactory: initializeApp,
            deps: [TenantService, ThemeService, IssuanceUiPolicyService],
            multi: true
        },
        {
            provide: CREDENTIAL_SCHEMA_PROVIDERS,
            useClass: LearCredentialEmployeeSchemaProvider,
            multi: true
        },
        {
            provide: CREDENTIAL_SCHEMA_PROVIDERS,
            useClass: LearCredentialMachineIssuanceSchemaProvider,
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
            loader: {
                provide: StsConfigLoader,
                useFactory: oidcConfigFactory,
                deps: [TenantService]
            }
        })),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ServeErrorInterceptor, multi: true },
        provideAnimations(),
    ]
})
  .catch(err => console.error(err));
