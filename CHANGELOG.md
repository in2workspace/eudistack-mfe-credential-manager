# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.3] - 2026-04-30

### Changed
- Simplified credential offer URL extraction to support HTTPS wallet URL format directly

## [3.5.2] - 2026-04-30

### Added

- Add ARIA label to navbar menu and hide decorative SVGs from screen readers (PRB-002)


## [3.5.1] - 2026-04-29

### Fixed

- Populate root `email` from `mandator.email` for `LearCredentialMachine` issuance requests (fix delivery 400).

### Added

- Test case in `issuance-request-factory.service.spec.ts` to validate the new email population logic.

### Fixed (EUDI-094 multi-tenant rollout)

- No code change required. The runtime-derived `client_id`
  (`vc-auth-client-{hostname-first-label}`) is now honoured end-to-end
  against the verifier once `clients.yaml` registers the per-tenant
  entries with the env suffix (`-sandbox-stg`, `-cgcom-stg`, `-kpmg-stg`).
  Login flow validated on STG post-verifier redeploy (2026-04-23).

## [3.5.0] - 2026-04-28

### Added

- **Página de refresco de oferta de credencial** (`credential-offer/refresh/:token`) — nueva ruta pública en el MFE que sustituye la plantilla Thymeleaf del backend. Muestra una página de confirmación con look & feel por tenant (logo, colores CSS variables). El usuario pulsa "Enviar nueva oferta" para disparar el `POST` al backend; los escáneres de email ATP no activan el reenvío al seguir el enlace `GET`.
- Traducciones añadidas para la nueva página en inglés, español y catalán (`credential-offer-refresh.*`).

## [3.4.1] - 2026-04-27

### Fixed (V3 multi-tenant rollout)

- **Credential type labels in management table** (`credential-management.component.ts/.html`) now resolve versioned W3C keys with fallback logic (`.N -> .1`) so raw i18n keys are no longer shown.
- **Cross-tenant details domain** (`credential-details/components/details-power/*`, `credential-details/services/custom-renderer-registry.ts`) now displays the real domain from credential `power` data instead of the active browser tenant (platform view bug).
- **Country selector ordering** (`shared/services/country.service.ts`) now sorts by translated country label (locale-aware) instead of translation key order.
- **Issuance type restriction for KPMG** (`credential-issuance.service.ts`) now limits available types to `learcredential.employee` to prevent unsupported machine issuance errors.
- **Responsive horizontal overflow in credential table** (`credential-management.component.scss`) now keeps horizontal scroll inside the table container to avoid top-bar white-gap artifacts on narrow viewports.
- **Duplicate field ids in dynamic issuance forms** (`dynamic-field.component.ts/.html`, `credential-issuance.component.html`) now use full field paths for control ids, fixing incorrect focus jumps between repeated fields (e.g., mandatee vs mandator).

### Tests

- Updated and validated unit tests in `credential-management.component.spec.ts`.
- Updated and validated unit tests in `country.service.spec.ts`.
- Updated and validated unit tests in `credential-issuance.service.spec.ts`.
- Updated and validated unit tests in `details-power.component.spec.ts`.
- Updated and validated unit tests in `dynamic-field.component.spec.ts`.

## [3.4.0] - 2026-04-23

### Changed (EUDI-094 — auto-deploy to all tenants on release)

- **`.github/workflows/deploy.yml`** — eliminado el input `tenant`. El deploy publica un build único a `s3://.../issuer/` e invalida todas las CloudFront STG del entorno (en lugar de una sola por tenant).
- **`.github/workflows/release.yml`** — el release dispara `deploy.yml` automáticamente tras el tag (`--ref main`) sin parametrizar tenant.

## [3.3.0] - 2026-04-23

### Changed (EUDI-094 — wallet URL derived from origin)

- **`src/app/core/constants/wallet.constants.ts`** (nuevo) — Expone `WALLET_BASE_URL` y `WALLET_SAME_DEVICE_URL` derivados de `globalThis.location.origin`. Alinea el wallet con la estrategia Atlassian-style same-origin (`<tenant>-stg.eudistack.net/wallet`) ya usada por `iam_url`.
- **`home.component.ts`**, **`credential-offer-onboarding.component.ts`**, **`credential-offer.component.ts`**, **`credential-offer-dialog.component.ts`** — sustituidos `environment.wallet_url` / `environment.wallet_url_test` por las constantes dinámicas. Los deeplinks (`/protocol/callback?credential_offer_uri=…`) se generan ahora por tenant sin necesidad de build-time vars.

### Removed

- **`wallet_url`** y **`wallet_url_test`** en `environment.ts`, `environment.deployment.ts`, `global.d.ts`, `assets/env.template.js`, `assets/env.js` y `deploy.yml`. Las GitHub vars `WALLET_URL` / `WALLET_URL_TEST` dejan de ser necesarias (eliminables desde el repo settings).

### Added (EUDI-094 — runtime OIDC client_id per tenant)

- **`assets/env.template.js`** — nueva sustitución `${CLIENT_ID_PREFIX}`. Si está presente, el runtime compone `client_id = prefix + tenant` (patrón `vc-auth-client-<tenant>`); si está vacío, cae al `${CLIENT_ID}` fijo. Replica el contrato ya usado en dev local.
- **`.github/workflows/deploy.yml`** — pasa `CLIENT_ID_PREFIX: ${{ vars.CLIENT_ID_PREFIX }}` al paso de envsubst.

### Tests

- **`credential-offer-onboarding.component.spec.ts`**, **`credential-offer.component.spec.ts`** — actualizados para validar la derivación dinámica (`WALLET_BASE_URL` / `WALLET_SAME_DEVICE_URL`) en lugar del env estático.

## [3.2.2] - 2026-04-23

### Fixed (EUDI-064 post-release — env suffix in tenant resolution)

- **`tenants.constants.ts`** — `resolveTenant()` ahora elimina los sufijos de entorno `-stg`, `-dev`, `-pre` antes del lookup en `KNOWN_TENANTS`. Motivación: en STG el host es `sandbox-stg.eudistack.net` y el guard `isKnownTenant` devolvía `false`, redirigiendo al usuario a `/tenant-not-found`. Replica la lógica que ya hace `TenantDomainWebFilter` en el backend (core-issuer).
- **`buildFallbackUrl()`** — preserva el sufijo de entorno del host actual al reconstruir la URL de fallback. Evita que un usuario en STG salte a PROD (p.ej. `patata-stg.eudistack.net` → `sandbox-stg.eudistack.net`, no `sandbox.eudistack.net`).
- **`auth.service.ts`**, **`theme.service.ts`** — sustituidos los `hostname.split('.')[0]` ad-hoc por `resolveTenant()`. Centraliza la resolución y elimina divergencia con backend.
- **`index.html`** — favicon apuntaba a un placeholder `data:;base64,=` vacío; ahora apunta a `assets/favicon.svg` como default (el `ThemeService` lo sobreescribe en runtime).
- **`tenant-not-found.component`** — añadido logo EUDIStack en la pantalla (antes sólo había texto).

## [3.2.1] - 2026-04-21

### Changed (format selector always visible per tenant)

- **`credential-issuance.component.html`** — The "select credential format" radio group is now rendered whenever a credential type is selected, regardless of how many formats are enabled for the current tenant. The gate `@if(availableFormats.length > 1)` was changed to `> 0`. Motivation: with per-tenant filtering through `/.well-known/openid-credential-issuer`, tenants restricted to a single format (e.g. `kpmg` → SD-JWT only, `dome` → W3C only) previously saw no format indicator at all. Now the single available option renders as a selected radio, giving the user explicit confirmation of the format being issued and keeping the UI consistent across tenants.

## [3.2.0] - 2026-04-21

### Added (EUDI-065 Fase 8)

- **`MeService`** (`src/app/core/services/me.service.ts`) + **`MeResponse`** DTO. Llama `GET /api/v1/me` del Issuer para resolver el rol del caller contra el tenant actual. El backend usa `tenant_config.admin_organization_id` (per-tenant), así que el frontend nunca conoce ese valor.
- **`AuthService.refreshRoleFromBackend()`** invocado tras `checkAuth$` y `handleLoginCallback`. Mapea el `UserRole` del backend a `RoleType` del frontend: `SYSADMIN + readOnly → SYSADMIN_READONLY`; `SYSADMIN + !readOnly → TENANT_ADMIN`; `TENANT_ADMIN → TENANT_ADMIN`; `LEAR → LEAR`.

### Changed (breaking — internal)

- **`environment.admin_organization_id` eliminado** (`environment.ts`, `environment.deployment.ts`). `global.d.ts`, `env.js`, `env.template.js` y `.github/workflows/deploy.yml` ya no referencian `ADMIN_ORGANIZATION_ID`. `AuthService.getUserRole()` lee del signal `roleType` (alimentado por el backend); `hasAdminOrganizationIdentifier()` deriva del mismo signal.
- **`RoleType.LER` eliminado** (semánticamente ≡ `LEAR`: un LER es un padre LEAR autoemitido). `accessLevel.guard.ts` simplificado — `basicGuard`/`settingsGuard` delegan directamente en `PoliciesService`.

### Migration

- El Issuer debe exponer `GET /api/v1/me` (disponible desde core-issuer `3.3.0`).
- En deploy, eliminar la variable `ADMIN_ORGANIZATION_ID` de GitHub Actions (`vars.ADMIN_ORGANIZATION_ID`). El MFE ya no la consume.

## [3.1.3] - 2026-04-21

### Changed (EUDI-065: cross-tenant rejection UX)

- **`AuthService.rejectCrossTenantSession`** replaces the silent logout triggered by `checkAuth$` and `handleLoginCallback` when the session belongs to a different tenant. It now resets the authenticated state, navigates to `/home` so the dialog is not shown over the protected dashboard (the OIDC library auto-navigates to `postLoginRoute` before our gate reacts), and reuses the existing **"Access Denied"** dialog (`error.policy.title` / `error.policy.message`) already shown by the accessLevel guards. On dismiss, the user is logged out. A re-entrancy flag prevents double dialogs when both gates fire.
- Unit tests updated to await the router-promise chain that now precedes the logout.

## [3.1.2] - 2026-04-21

### Fixed (EUDI-065: cross-tenant session reuse)

- **`AuthService.checkAuth$`** (the bootstrap path invoked on every app start) now applies the same tenant-domain gate as `handleLoginCallback`. Previously only the OIDC callback validated the power's `domain`; after a successful login in one tenant the silent `checkAuth()` on a different tenant's subdomain found an existing valid session and promoted the user to authenticated, skipping the domain check and granting access across tenants even in incognito (since the OIDC storage was shared by same parent domain).
- Shared gate extracted into `AuthService.isAuthorizedForCurrentTenant()` so the OIDC callback and the bootstrap path cannot drift.

## [3.1.1] - 2026-04-21

### Fixed (EUDI-065: cross-tenant TenantAdmin bypass)

- **`AuthService.handleLoginCallback`** now requires the `Onboarding/Execute` power's `domain` to match the current tenant (`window.location.hostname.split('.')[0]`, case-insensitive). Previously the login gate only matched `function + action`, so a credential issued for `domain=KPMG` was accepted on `dome.<host>` and granted access to the DOME Credential Manager. SysAdmin bypass (`organization/EUDISTACK/System/Administration`) preserved.
- **`AuthService.getUserRole`** now only resolves `TENANT_ADMIN` when the user also holds an `Onboarding/Execute` power scoped to the current tenant, closing the same bypass at the UI role-resolution layer.
- **`AuthService.hasPower`** gained an optional `tmfDomain` parameter for domain-scoped power checks; previous two-arg calls remain unchanged.

### Fixed

- **Home logo**: removed `<a href="/">` wrapper that triggered a full browser navigation and lost the `:4443` port through nginx's root 302 redirect, landing on a non-existent origin.
- **Wallet icon 404**: replaced the broken relative path `../../../assets/icons/wallet.png` with `assets/icons/wallet.png`, which now resolves against the MFE `<base href="/">` under `/issuer/` instead of the host root.
- **Wallet URL tenant-aware**: `walletUrl` on the Home landing is now derived from `window.location.origin` (`${origin}/wallet/`) instead of the static `environment.wallet_url`, so the QR and "Go to wallet" link follow the current tenant subdomain automatically.
- **Docs link**: `theme.json#content.knowledgeBaseUrl` now points to `https://in2workspace.github.io/eudistack-platform-docs/` so the "Docs" and "Learn more" links have a valid target.
- `AuthService` spec: removed two tests for `resolveRole` (method deleted in 6752953, EUDI-065).
- `CredentialDetailsService` spec: provided a mock `AuthService` — the service now injects it since 0737343 (EUDI-065) added `canWrite = getUserRole() !== SYSADMIN_READONLY`, which caused `NullInjectorError: No provider for _HttpClient` transitively through `OidcSecurityService`.
- `CredentialManagementComponent` spec: added `getUserRole` to the `AuthService` mock and updated the admin-flag assertion — `ngOnInit` calls `getUserRole()` instead of `hasAdminOrganizationIdentifier()` since 0737343.
- `LearCredentialMachineIssuanceSchemaProvider` spec: updated the `power.custom.data` assertion to match the intentional alignment with Employee schema in 4ec3633 (EUDISTACK-160): `Onboarding` now `isAdminRequired: true`, added `ProductOffering`, and `Attest` action in `Certification`.

## [3.0.1] - 2026-04-17

### Changed
- Simplified the `extractCredentialOfferHttpsUrl` logic by leveraging the native URL API, improving robustness and maintainability.

### Removed
- Remove unused dependencies("@angular-builders/jest") from the project.

## [3.1.0] - 2026-04-20

### Added (EUDI-064: Tenant validation)

- **`tenantGuard`** — Angular route guard that validates the tenant exists before rendering protected routes.
- **`TenantNotFoundComponent`** — user-friendly error page for unknown tenant subdomains.
- **`tenants.constants`** — central registry of valid tenants.
- Guard applied to `home`, `settings`, `organization/credentials`, and `credential-offer` routes.
- i18n keys for tenant-not-found page (ca/en/es).

### Added (EUDI-065: Role-based UI visibility)

- **`UserRole` enum extended** with `SYSADMIN_READONLY` and `TENANT_ADMIN` values.
- **`AuthService.getUserRole()`** — resolves role from token powers + hostname:
  - SysAdmin from `platform` subdomain → `SYSADMIN_READONLY`
  - SysAdmin from any other subdomain → `TENANT_ADMIN`
  - `organizationId == admin_organization_id` → `TENANT_ADMIN`
  - Otherwise → `LEAR`
- **Platform read-only view** — "New credential" and "New credential (on behalf)" buttons hidden; credential details accessible but Withdraw/Revoke/Sign buttons hidden.
- **TenantAdmin** sees "New credential (on behalf)" button; **LEAR** only sees "New credential".

### Fixed (EUDI-064)

- **Remove `iam_url` from `secureRoutes`** — prevents Bearer token on `/oidc/token` endpoint (was causing 401 on multi-tenant login).
- **Add tenant column** to credential management table (shown dynamically when cross-tenant data is present).

### Deprecated

- **`AuthService.hasAdminOrganizationIdentifier()`** — use `getUserRole()` instead.

### Fixed

- Fix incorrect labels in Issuer UI and correct Spanish i18n typos
- Unified light blue buttons to primary color 
- Fix credential details grouping to display section titles using the second-to-last key to handle different path depths.
- Sort credential list by updated date (desc by default)
- Fix oversized header, correct i18n translation and normalize countrie names
- Fix incorrect "serial number" label (previously shown as "identity-document")

## [3.0.0] - 2026-03-24

### Removed
- Hardcoded LEAR credential detail schemas (`LearCredentialEmployeeDetailsViewModelSchema`, `LearCredentialMachineDetailsViewModelSchema`). LEAR credential details are now rendered exclusively via the dynamic schema builder driven by `credential_metadata.claims` from the issuer.

## [2.1.13](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.13)
### Changed
- Update revocation endpoint and change the way the way the Credential Status List URL is obtained to make it compatible with BitstringStatusListEntry.

## [2.1.12](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.12)
### Changed
- Make color of texts in home and credential management pages customizable.

## [2.1.11](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.11)
### Changed
- UI adjustments in home and management page.

## [2.1.10](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.10)
### Changed
- Configure colors relying on a single environment variable, `THEME_NAME`, which determines which CSS bundle is loaded. Each theme encapsulates all its CSS variables in a dedicated bundle. Previously, theming was handled through four separate color environment variables.
- Button colors on the landing page are now configurable and depend on CSS variables defined in the selected theme bundle.

## [2.1.9](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.9)
### Changed
- Configure logo and favicon using the `ASSETS_BASE_URL` environment variable combined with asset-specific paths.


## [2.1.8](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.8)
### Added
- Altia and ISBE favicons.

### Changed
- Rename DOME favicon.

## [2.1.7](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.7)
### Changed
- Changed credential management labels

## [2.1.6](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.6)
### Added
- Allow signature for LEAR Credential Machine.

### Fixed
- Adjust scroll effect in home page so that the login button is clearly visible.
- Fix the texts in the Dashboard table footer.

## [2.1.5](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.5)
### Fixed
- English grammar and clarity fixes in home and credential offer stepper pages.

### Removed
- Outdated text in home page.

## [2.1.4](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.4)
### Changed
- Removed hardcoded "DOME" references.

## [2.1.3](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.3)
### Added
- Added environment variable `sys_admin` to set credential powers "domain" field and display it in issuance form and credential details page.

### Fixed
- Added translations for the country selector.

## [2.1.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.2)
### Added
- Admin organization identifier is now configurable.
- Get and display contact email in credential details page.
- Get and display organization identifier in management page.

### Changed 
- Changed "create-as-signer" route for "create-on-behalf".

### Fixed
- Add missing translations.


## [2.1.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.1)
### Added 
- Set language from browser or using the default from environment.

### Changed 
- Add missing translations.

## [2.1.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.1.0)
### Added 
- Admins can add Certification-upload power to LEARCredentialMachine.

### Changed
- When issuing LEARCredentialMachine as not-signer, set credential_owner_email with the mandatee email of the vc in the access token.
- Change "as Signer" for "(on behalf)" in Management page button.

### Fixed
- Label "engineVersion" in credential details page.

## [2.0.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v2.0.0)
### Added
- Credential revokation.
- Gx-label credentials view.
- LEARCredentialMachine Issuance.

### Fixed
- Fill LEARCredentialMachine Details fields correctly.
- Show "Send reminder" button for LEARCredentialMachine.
- Show spinner while sending LEARCredentialMachine issuance request.
- In LEARCredentialMachine issuance form, don't show missing key alert if key is already generated.
- Adjust credential type selector width so that the type can be read.
- In management page, align buttons.
- When opening credentials search bar, automatically select input box so user can write directly in it.

### Changed
- LEARCredentialEmployee model (mandator, mandatee, power).
- Normalize displayed texts from "LEARCredentialX" to "LEAR Credential X" across UI labels.
- Update api-path-constants endpoints.
- Issuer field can be string or object.

## [1.13.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.13.1)
### Fixed
- Fix error handling for auth errors.
- Don't show test Wallet URL in PRD environment.

## [1.13.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.13.0)
### Added
- Implementation of configure signature.

## [1.12.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.12.2)
### Fixed
- Changed default wallet URLs to ".eu"

## [1.12.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.12.1)
### Fixed
- Fixed error dialog messages for credential offer stepper.


## [1.12.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.12.0)
### Changed
- Adapt details page to 3 credential types (LEARCredentialEmployee, LEARCredentialMachine and VerifiableCertification)
- Add "basic information" in details page (credential type, validity, valid-from, valid-until)
- Change route to create procedure as signer from "create2/admin" to "create-as-signer"

## [1.11.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.11.0)
### Changed
- Refactored and renamed some environment variables
- Renamed some directories and files
- Moved some environment variables to application constants to remove unnecessary complexity
### Added
- Added some minor fixes

## [1.10.3](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.10.3)
### Modify
- Change CREDENTIAL_OFFER_URI env name to CREDENTIAL_OFFER_URL.

## [1.10.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.10.2)
### Fixed
- Fix error to handle email failure.

## [1.10.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.10.1)
### Fixed
- Fix error during credential detail visualization

## [1.10.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.10.0)
### Added
- Added button to sign credential when sync flux fails
### Fixed
- Small fixes

## [1.9.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.9.0)
### Added
- Access by role and policies.

## [1.8.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.8.2)
### Added
- Solution to spelling error.

## [1.8.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.8.1)
### Added
- Display credential issuer information in the credential detail view.

## [1.8.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.8.0)
### Added
- Compatibility with LEARCredential V2

## [1.7.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.7.1)
### Added
- When leaving credential offer stepper (after clicking "Leave" on refresh popup) and being redirected to home, show warning popup.
- Environment variable for knowledge wallet.
### Changed
- In Mandator, remove placeholders
- Restructuring the navbar.
### Fixed
- After logout, if the user tries to access the dashboard again, it redirects them back to the login.

## [1.7.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.7.0)
### Added
- Updating to Angular 18 and dependencies.
- Change in the navbar, with dropdown logout and settings.
- Creation of configuration component and policy verification.

## [1.6.3](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.6.3)
### Fixed
- In credential issuance form, after clicking on remove power icon, don't remove power if user clicks "Cancel"

### Changed
- In credential issuance form, remove back arrow
- In details page, make back arrow bigger
- In credential offer Step 1, center 

## [1.6.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.6.2)
### Fixed
- In credential offer stepper, when clicking refresh button, close popup and don't leave while it's refreshing

## [1.6.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.6.1)
### Added
- Added customized colors for navbar and logo.

## [1.5.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.5.0)
### Added
- Search bar in credentials dashboard
- Success popup after creating credential and after sending reminder
- In credential offer step 2, added popup to refresh offer when it is about to expire. If not refreshed, redirects to the home page.
- In details and credential issuance pages, "Back" button

### Changed
- In credentials dashboard, changed order of columns and added color to status indicators
- Send Reminder button is positioned at the bottom of the details page
- In navbar, organization name appears below the username
- Updated button styles in dashboard, form and stepper

## [1.4.3](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.4.3)
### Fixed
- Translations are applied to all components

## [1.4.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.4.2)
### Fixed
- In non-PRD environments, in the first step of the stepper, show a link to access the same-environment Wallet

## [1.4.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.4.1)
### Added
- Test Wallet url for getting credential offer through same-device flow in the same environment

## [1.4.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.4.0)
### Added
- Same-device flow: user can get credential with a signel device, without need to scan QR
- Stepper to get credential offer

## [1.3.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.3.0)
### Changed
- Add new attribute to the credentials view
- Disable the credential view for unknown credentials type

## [1.2.7](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.7)
### Added
- User is now redirected after send reminder
- A dialog with spinner appears while waiting for server response

### Changed
- Floating elements are unified, there is only dialogs with confirm and error styles.
- Unified styles (Blinker font, primary color)

### Fixed
- Sort arrow and header style corresponds to relative column state (sorting or not sorting)


## [1.2.6](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.6)
### Changed
- Refactor architecture to Standalone

## [1.2.5](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.5)
### Fixed
- When logging out, the cache is cleared, and the session with the identity provider is terminated

## [1.2.4](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.4)
### Fixed
- When selecting the power "Certification" with the action "Attest", it didn't allow the credential to be created.

## [1.2.3](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.3)
### Added
- Added profile env variable
### Fixed
- Fix error in vc serialization from the user data

## [1.2.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.2)
### Fixed
- In credential management, fix "New create credential" button to redirect to proper route
- In credential form as a signer, show mandator form and signer panel after refreshing
- In credential form, fix validation (add length and character restrictions and error messages)
- In credential form, don't allow user to introduce 'VAT-' prefix in organization identifier field
- In credential form, don't add prefix to phone number input after submitting
- In credential form, disable already added power options and show messages when user has no added power options or has a power option without selected action
- In credential form phone input, make label go up only after clicking

## [1.2.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.1)
### Changed
- Fix several bugs

## [1.2.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.2.0)
### Changed
- The authentication logic has been changed from Role-Based Access Control (RBAC) to Policy-Based Access Control (PBAC) to enhance granularity and flexibility in permission management.
### Fixed
- The literal "Product Offer" has been replaced with "ProductOffering" in the selection of powers.

## [1.1.8](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.8)
### Fixed
- In credential procedures table, differentiate active sort arrow

## [1.1.7](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.7)
### Changed
- In credential procedures list, add limit to name column width and change title to "Full name"
- In credential procedures list, change datetime format of "updated" column
- In credential procedures list, change pagination to 10/25/50 visible objects at a time.
### Fixed
- In credential procedures table, make sort arrow always visible
- Fix credential procedures table responsiveness

## [1.1.6](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.6)
### Fixed
- In credential form, show error 'already added option' every time is needed
- In credential procedures list, don't log them

## [1.1.5](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.5)
### Fixed
- In credential form, capitalize "mobile phone" placeholder
- In credential form, sort countries dropdown alphabetically
- In credential form, make phone-prefix and country validation independent

## [1.1.4](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.3)
### Fixed
- Redirect to credentials list after New Credential form submit

## [1.1.3](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.3)
### Fixed
- Scroll to see more button
- Fav icon

## [1.1.2](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.2)
### Fixed
- The display name of the user logged in is now using the first name and last name of the user instead of the email

## [1.1.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.1)
### Fixed
- In credential details page, show Send reminder button only if VC status is WITHDRAWN or PEND_DOWNLOAD

## [1.1.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.1.0)
### Added 
- Sorting by status, name, and updated date in the credentials list in Backoffice 
- Requirement of at least one power in the credential creation form 
### Changed
- Issuance API contract 
- Phone number optional in credential creation form
- Changed DomePlatform power to Certification ("Upload") power 
- Button "DOCS" on Home Page now points to the Knowledge Base
- Button "LearnMore" on Home Page now points to the Knowledge Base
- "Dome" text from powers now displayed with proper capitalization
### Removed
- In home wallet section, verifier link and introductory text
### Fixed 
- In home wallet section, QR and link were not set as env variable
- Entire row in credentials list is now clickable in Backoffice 
- Display of Mandator information in credential details view 
- Removed the power combo box from the credential details view as it was unnecessary 
- Placeholder text now displayed for Mandator in credential creation form (previously showed dummy data) 
- Prevented selection of the same power more than once in credential creation form 
- Restricted issuance without a signature in the Flux module 
- Hidden signer row and buttons based on user role
- Link to wallet added on Home Page 
- QR code linking to wallet added on Home Page 

## [1.0.1](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.0.1)
### Changed
- Make sorting of credentials list case-insensitive
- Save credential api path and contract

## [1.0.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v1.0.0)
### Added
-Authentication configuration
-Credential Creation
-Credential Managment
-Credential Issuance

## [0.6.0](https://github.com/in2workspace/in2-issuer-ui/releases/tag/v0.6.0)
### Added
- Landing Page
