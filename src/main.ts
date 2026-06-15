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
import { oidcConfigFactory } from './app/core/auth/oid-config.factory';

function initializeApp(tenantService: TenantService, themeService: ThemeService): () => Promise<void> {
  return async () => {
    await tenantService.resolve();
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
            deps: [TenantService, ThemeService],
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
