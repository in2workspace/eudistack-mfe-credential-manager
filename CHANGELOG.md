# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **EUD-38 — allowlist de licencias unificada**: `.github/license-policy.json` es ahora la transcripción íntegra de `conv-quality-security-gates.md` §16.1, idéntica en los trece repositorios con gate. Añade `LGPL-2.1-only`, la grafía SPDX vigente del mismo permiso que `LGPL-2.1`, que ya estaba admitido: `logback` 1.5.34 la declara así y el gate la bloqueaba por la grafía, no por la licencia.

### Added

- **CI — control de composición de software (SCA)**
  - **Trivy** añadido a `pr.yml`: escaneo `fs` de la raíz del repositorio (lee `package-lock.json`), severidad `HIGH,CRITICAL`, con caché de la base de vulnerabilidades, informe JSON como artefacto y `config/trivy/.trivyignore` para riesgos aceptados documentados. El parser npm de Trivy omite las dependencias de desarrollo por defecto, así que el escaneo refleja lo que llega al navegador.
  - **`exit-code: 0` de forma deliberada:** entra como línea base, todavía no como puerta. El árbol de dependencias de producción arrastra advisories HIGH en `@angular/common`, `@angular/core` y `@angular/compiler`. Un bump de patch a `19.2.25` (última 19.x publicada) cierra CVE-2026-50170 y CVE-2026-50171; las seis restantes (CVE-2026-54266, 54267, 54268, 68945 y 69151) solo tienen fix en `20.3.25+`, `21.2.17+` o `22.x`, así que limpiar el árbol exige la subida de major de Angular. Se girará a `1` cuando esa subida aterrice o cuando los riesgos aceptados queden listados en `.trivyignore`.
  - **SBOM CycloneDX** (`@cyclonedx/cyclonedx-npm@6.0.1`, spec 1.6, solo dependencias de producción) generado en `ci-cd.yml`, publicado como artefacto con 90 días de retención y adjuntado al GitHub Release como `sbom.cdx.json`.
  - **Dependabot**: configuración de actualizaciones para `npm` y `github-actions`. Tener las alertas activadas no basta — sin fichero de configuración el grafo de dependencias no estaba produciendo alertas en este repositorio.
  - `config/trivy/**` añadido al `paths-ignore` de `ci-cd.yml`: cambiar la lista de exclusiones es un cambio de política, no un despliegue.


### Fixed
- **Home Wallet links** - Show the correct Wallet link using the resolved URL from `TenantService`.
- **The issuance screen no longer shows the "no forms enabled" message while its catalogue is still loading.** `CredentialIssuanceService`'s constructor starts two loads — the tenant's issuance UI policy and the issuer metadata — and had no state for "not answered yet": until both settle the type list is empty and neither `loadFailed()` is raised, so the selector's else-branch rendered **EC-01** ("there are no credential forms enabled for your organization, contact your tenant administrator") for the length of the metadata round trip, announced it through `aria-live`, and only then swapped it for the selector. `loadMetadata()` is not memoized, so this was the guaranteed behaviour of every first visit, not an occasional race. New `isLoadingCatalog$` — seeded `true`, cleared in the `forkJoin`'s `finalize()` so that a stream failure could never leave a spinner running in place of the empty state it replaces — drives a third template branch: spinner + `credentialIssuance.loadingCatalog` (`ca`/`en`/`es`; `fi.json` has no `credentialIssuance` section). The branches test the type list **before** the flag, because `CredentialIssuerMetadataService` holds its configurations for the whole session: a later visit re-runs the load with a catalogue already in hand and must keep the selector on screen rather than blink back through the spinner. EC-01 and EC-04 are untouched once the loads settle. Covered by three service tests (in flight, settled, both loads failed) and two component tests; the policy load in `credential-issuance.service.spec.ts` is now a promise the test releases itself, since an already-resolved one settled the `forkJoin` between `beforeEach` and the test body and left no in-flight window to assert on.
- **`ServeErrorInterceptor` no longer opens an error dialog for a failed static asset.** Requests whose path matches `(^|/)assets/` are logged and rethrown, like the IAM endpoint already was. Every asset the app fetches — `theme.json`, the i18n bundles, `custom-domain.json`, and now `issuance-ui.json` — is read by code that owns a fallback for its absence, so the failure is already handled where it means something. Surfacing it globally put a bare "not found" in front of the user on **every page load**, including home and the post-login landing, while the screen behind it worked; an unpublished `issuance-ui.json` made that visible. API paths are unaffected: the match is on segment boundaries, so `/admin/v1/credential-assets` still raises the dialog.

### Removed

- **`core/helpers/pinned-issuable-versions.ts` (hardcoded issuance version floor)**
  - Its job — "never offer a superseded version of a lineage, whatever the metadata declares" — was a global map in code, needed because `credential_configurations_supported` mixes the read catalogue (superseded versions the details screen needs to resolve already-issued credentials) with the issuance catalogue. With the per-tenant policy document deciding which lineages get a form, and the issuer guaranteeing that a lineage a tenant can still issue always carries its current version, the relative rule (`keepLatestCredentialConfigurations`) is enough on its own. This is the one-step removal the file's own header described.
  - `ISSUANCE_CREDENTIAL_TYPES_ARRAY` **stays**: it is not tenant policy but the declaration of what this build can draw a form for, and it is the source of the `IssuanceCredentialType` union. A new `schema-providers-parity.spec.ts` asserts that the providers registered in `main.ts` match it exactly, so the two cannot drift — a registered-but-unlisted type would never be offered, and a listed-but-unregistered one would throw in `IssuanceSchemaBuilder.getBuilder()` the moment an Operator selected it.

### Added

- **EUD-220 — SBOM CycloneDX and License Gate**: Added CycloneDX 1.6 SBOM generation (`npm run sbom`), CI license compliance gate (`license-gate.yml`), and automated SBOM asset attachment to GitHub Releases. The evaluator is vendored at `.github/scripts/license-gate.mjs` with its own `node --test` suite, which the gate workflow runs before evaluating anything: this repository verifies itself without depending on any other one. Free-text upstream license names resolve through a reviewed SPDX equivalence table instead of piling up as expiring exceptions, and the `CODEOWNERS` rules that protect the policy, the exception register and the evaluator sit at the END of the file, because GitHub applies the last matching pattern.

### Changed

- **EUD-221 — `@ngx-translate/http-loader` aligned to `16.0.1`**: was pinned to `^8.0.0`, resolving `8.0.0`, which publishes `"SEE LICENSE IN LICENSE"` instead of a machine-readable SPDX identifier (SPDX License List / SPDX License Expressions), an auditability gap under NIS2 Art. 21.2(d) and CRA Annex I Part II. `16.0.1` declares `MIT` explicitly and is already the version used by `eudistack-mfe-login`/`eudistack-cgcom-mfe-issuance-portal`, same loader instantiation signature. No application code change, no observable behavior change.

### Added

- **Per-tenant issuance UI policy, published as configuration**
  - **What it fixes.** Which credentials the issuance form offers was decided by the issuer metadata (already tenant-scoped) *and* by hardcoded lists in the front end. The UI legitimately offers a **narrower** set than the API — some credentials are meant to be issued through the API only — but that narrowing is a UI concern: it must not be hardcoded, must not be pushed into the issuer's credential profiles (the backend has no business knowing what this UI can draw), and cannot live in `environment.ts`, since one environment serves many tenants with different answers.
  - **Source.** New document `/assets/tenants/issuance-ui.json`, published by `eudistack-platform-assets` (`s3 sync tenants/` + CloudFront invalidation, `max-age=300`) on the same shared per-tenant prefix `custom-domain.json` already uses — so a change is a PR to that repo, not a redeploy of this MFE. Shape: a `default` block plus per-tenant overrides, each carrying `allowedCredentials`. Centralised rather than one file per tenant folder because the list is near-identical across tenants, `platform`/`sandbox` have no folder at all, and a tenant with no entry must fall back to the default instead of 404ing.
  - **Swappable source by construction.** `core/services/issuance-ui-policy.loader.ts` is the only file in the feature that imports `HttpClient`; it exports a single function whose signature is expressed in domain terms (`(http, tenant) => Observable<IssuanceUiPolicy | null>`). Moving the policy to a per-tenant `theme.json` (once EUD-217 migrates branding) or to an issuer endpoint is a rewrite of that one file — no injection token, no adapter hierarchy, and no change to the domain, the service, its consumers or their tests.
  - **Entries are lineages, matched by equality.** An entry is `<type>.<format-family>` (`learcredential.employee.w3c`), i.e. a configuration id minus its trailing version. The format is part of the identity, so allowing a type in one format says nothing about the others, and a bare type matches nothing. **TEMPORARY, and documented as such in `issuance-ui-policy.model.ts`:** entries carry no version because `keepLatestCredentialConfigurations` picks the newest the metadata declares, which is only right while the issuer always declares the current version of anything a tenant can still issue. If that guarantee ever breaks, the fix is a version floor in the document (the pinned-versions algorithm, fed per tenant from configuration), not a new hardcoded map.
  - **It only ever narrows.** The filter is applied inside `CredentialIssuerMetadataService.latestConfigurations`, before the newest-of-lineage rule, so it feeds both `getIssuableCredentialTypes()` and `findConfigurationsForType()` from one place. A configuration the issuer did not advertise cannot be added back by the document, and `getConfigurationById()` still resolves everything the metadata carried, so credentials already issued under a withheld lineage keep rendering on the details screen.
  - **Warmed up at bootstrap, awaited only where it matters.** `main.ts` starts `IssuanceUiPolicyService.load()` after `TenantService.resolve()` (it needs `tenant()`) but does **not** await it, so the fetch rides along with the theme without putting a retrying, fail-closed request in front of the first paint. `CredentialIssuanceService` — the only consumer — awaits the same memoized promise alongside `loadMetadata()`. A tenant whose policy is unreachable therefore reaches its issued credentials with no delay at all: listing and reading them go through `getConfigurationById()` / `getAllConfigurations()`, which read the metadata untouched by the policy. Only starting a new issuance is affected. There is no background retry re-applying a late answer once resolved — a selector that changes under the user's pointer is worse than a deterministic one (EUD-217 AD-4/EC-03).
  - **Fail-closed, with retries.** Unreachable after retries, timed out, malformed, or with nothing to say about the tenant all end at the same empty `DEFAULT_ISSUANCE_UI_POLICY` **and** raise `loadFailed()`: nothing is offered, and `CredentialIssuanceService.isCatalogUnavailable$` turns that into the existing "catalogue unavailable" message rather than a bare empty selector (component, template and i18n unchanged). Because that outcome costs a tenant its whole issuance screen for the session, the loader retries twice with a 300/600 ms backoff over a per-attempt 800 ms budget (~3.3 s worst case, mirroring `TenantService`'s handling of `custom-domain.json`). An `allowedCredentials: []` the document actually declares is a valid policy, not a failure, and keeps the "no types enabled" message.
  - **Tests.** `issuance-ui-policy.spec.ts` (tenant entry over default, explicit empty list as a real policy, declared-but-all-invalid as a broken document, lineage equality against prefixes and unversioned ids), `issuance-ui-policy.loader.spec.ts` (URL, retry recovery and exhaustion, per-attempt budget), `issuance-ui-policy.service.spec.ts` (memoisation, no re-fetch, every failure path landing on the same fail-closed outcome, never rejecting), plus new blocks in `credential-issuer-metadata.service.spec.ts` (narrowing per lineage, per format family, empty policy, intersection never a union, ids still resolvable) and `credential-issuance.service.spec.ts` (policy failure surfaces as EC-04).
  - **Not changed:** the catalogue screen and its hardcoded `credential-type-visibility.ts` — a separate concern tracked on its own.

- **EUD-226 — Gestionar el contacto de la organización para notificaciones del ciclo de vida (US-07)**
  - **Organization contact form (FR-19, AC-01, AC-02)**: New `/organization-contact` route with `OrganizationContactComponent`. Displays a reactive form with email input (required, validated with `Validators.email`), a Save button, and success/error feedback. Loads existing contact on mount; shows empty field if no contact exists (EC-01). Validation errors block submit (ES-01). On successful update, displays success message; on error, displays error message without losing form state (ES-04, ES-05).
  - **API integration (FR-17)**: `OrganizationContactService` with `fetchContact(orgId): Observable<OrganizationContact>` (GET `{serverUrl}/api/v1/organizations/{id}/contact`) and `updateContact(orgId, email): Observable<void>` (PUT, same path). Handles 400/403/404/5xx errors and timeouts (ES-04, ES-05). The URL is built from `TenantService.serverUrl` + a new `API_PATH.ORGANIZATIONS` entry, not a hardcoded relative path: the OIDC config's `secureRoutes: [serverUrl]` is what `AuthInterceptor` matches to attach the Bearer, so a relative URL would 401 once the tenant feature flag is enabled — same reasoning already documented on `CredentialCatalogService`.
  - **Authorization guard (AC-03, AC-04)**: `organizationContactGuard` now delegates to `PoliciesService.checkOrganizationContactPolicy()`, the same async pattern as `settingsGuard`/`checkSettingsPolicy()` — it awaits `authCheckComplete$` then `AuthService.resolveRole$()` before evaluating `canAccessOrganizationContact()`/`canWriteOrganizationContact()`, and denies through the shared "Access Denied" dialog + redirect. Fixes a race where a synchronous read of those predicates (their previous shape) would deny any caller who navigated or reloaded directly into `/organization-contact` before `GET /api/v1/me` answered — `AuthService`'s own `resolveRole$()` doc already warned guards must not read `roleType()`-derived predicates synchronously for exactly this reason. `NavbarComponent.canSeeOrganizationContact` was unaffected (a reactive `computed()`, not a one-time guard read).
  - **`orgId` wired to the real session (closes prior known limitation)**: `OrganizationContactComponent` now reads `AuthService.organizationIdentifier()` instead of the `'placeholder-org-id'` stub — populated by the same `GET /api/v1/me` round trip the guard already waits on, so it is resolved by the time the route activates.
  - **Subscription teardown**: `OrganizationContactComponent`'s two HTTP subscriptions now use `takeUntilDestroyed(DestroyRef)`, so a load/save response arriving after the component is destroyed no longer touches component state.
  - **Model**: `OrganizationContact { email: string | null }` interface in `core/models/entity/organization-contact.ts`.
  - **i18n (AC-01, AC-02, EC-01, ES-01)**: Added keys in `es.json`, `en.json`, `fi.json` for page title, email label, save button, success/error messages, and menu entry. Finnish (`fi.json`) translations for PRH Finland tenant. `fi.json` only carries this Story's keys (18 of the ~404 keys `en.json`/`es.json` have) — `fi` is not yet registered in any active locale selector, so this is latent, not a rendering bug today; revisit before `fi` is ever offered as a selectable locale.
  - **Tests**: Service, component, guard, and navbar unit tests, all passing under Jest (82/82 suites, 1065/1065 tests, 88.1% coverage). `organization-contact.guard.spec.ts` now tests delegation only (mirroring `accessLevel.guard.spec.ts`); the real policy logic (feature-disabled deny, Caso A deny, Caso B/C allow, role-resolution ordering) is covered in `policies.service.spec.ts` under `checkOrganizationContactPolicy`. `organization-contact.service.spec.ts`'s four error-path tests (`fetchContact`/`updateContact` × 5xx/timeout) were false-positive: an `expect()` thrown inside a bare `subscribe({ error: ... })` callback never reaches Jest, so they passed regardless of the assertion. Rewritten with `done`/try-catch, and the timeout assertion corrected — Angular's `HttpClient` has no `timeout()` operator here, so a connection-level failure surfaces as a status-0 `HttpErrorResponse`, never a `TimeoutError`.
  - **Status:** `/code-review EUD-226` (2026-08-18) returned **APPROVED** for this Story's scope (tender/demo deliverable). The backend authorization decision logic (Caso A / cross-org denial) is correct against a legitimately-issued token, but `eudistack-enterprise-issuer` has no signature-verified JWT infrastructure yet — a pre-existing platform gap out of scope for this Story. **`features.organization_contact.enabled` must stay `false` in every environment until that platform gap is closed.** See `docs/EUD-5-gestion-ciclo-vida-portal/EUD-226/quality-report.md` and `tech-debt.md` TD-4.
  - **Deferred from GitHub PR review, tracked not fixed**: (1) `organizationContactGuard` denies via `router.navigate()` + `false` (through `PoliciesService.denyAndRedirect()`) rather than returning a `UrlTree` — matches the existing `checkSettingsPolicy()`/`checkOnboardingPolicy()` pattern, so changing it is a cross-cutting change to all three policy-backed guards, not something to do inside this Story alone. (2) The form uses plain HTML inputs/buttons instead of Angular Material (`mat-form-field`, `matInput`, `mat-error`) like the rest of the MFE — a UX/visual-consistency change deferred to design review, not a functional defect.

- **EUD-72 — Credential catalogue settings screen (US-02)**
  - **Screen and route.** New `/settings/catalog` lazy route with `CredentialCatalogComponent`: one `mat-slide-toggle` per credential type of the tenant's registry, a "Save changes" button pinned below a scrolling list, and skeleton / load-error / forbidden / not-configured / save-error states (AC-01, AC-02). `/settings` now redirects to `catalog` — without it the sidenav rendered over an empty content pane (§8 O-4).
  - **API.** `CredentialCatalogService` (`getCatalog()` / `updateCatalog(ids)`) against `GET|PUT /admin/v1/credential-catalog`, replace-all semantics; `API_PATH.CREDENTIAL_CATALOG` added. The URL is built from `TenantService.serverUrl` — not `environment.server_url` — because `AuthInterceptor` only attaches the Bearer to URLs matching the OIDC `secureRoutes`, whose value is that same `serverUrl`. No tenant header is sent: the Issuer resolves the tenant from the request host.
  - **Models.** `catalog.models.ts`: `CredentialCatalogEntry` / `UpdateCredentialCatalogRequest` mirroring the backend DTOs, plus `CredentialCatalogRow` (an entry decorated with the format family and version read off its id) and `FORMAT_FAMILY_LABEL_KEYS`. The format label keys are reused from `credentialIssuance.format.*` so the same product name ("W3C VC Data Model v2.0", "SD-JWT VC") reads identically on both screens; an unmapped token is rendered raw rather than dropped.
  - **Authorization inside the screen.** Read from `AuthService.roleType()` (resolved by `GET /api/v1/me`) rather than inferred from the guard: the sidenav entry is hidden from a LEAR (the API answers 403 on both verbs), and the platform-tenant SysAdmin (`SYSADMIN_READONLY`) gets the screen read-only — toggles disabled, no Save — matching the backend, which lets that role read but not write. A 403 still renders a dedicated state as defence in depth. `loadError` and `saveError` are separate signals so a failed `PUT` keeps the edited list on screen instead of discarding the admin's changes.
  - **Save reloads the list.** A successful `PUT` is followed by a fresh `GET`: the response never echoes the stored set, and the backend does not always persist exactly what was sent, so re-reading is the only way for the screen to show reality. A `persisted` flag tells a failed `PUT` (keep the edited toggles, show `saveError`) apart from a failed reload (fall back to the retryable load-error state, never claim the save failed).
  - **EC-01 — an empty selection is allowed, and means nothing can be issued.** Switching every toggle off sends an empty set. That is a legitimate configuration, not an error: its only consequence is that the tenant can no longer issue any credential type. A `role="alert"` warning next to the button states that consequence instead of blocking the save. Emptiness is measured on the full registry, not on the visible rows: a superseded version left enabled keeps the payload non-empty, so warning on the visible rows would announce a loss of issuance that is not actually happening.
  - **Only the newest version of each credential type is offered.** New `core/helpers/credential-configuration-id.ts` reads the `<type>.<format-family>.<version>` grammar of issuer configuration ids (`parseCredentialConfigurationId`, `keepLatestCredentialConfigurations`, `keepLatestCredentialConfigurationIds`). Versioning is per *lineage* — type **plus** format — so `learcredential.employee.w3c.2` supersedes `...w3c.1` but never `...sd.1`; the format is part of the identity of the thing being versioned. Unversioned ids are dropped rather than passed through, relative order is preserved, and ties keep the first occurrence. Placed in `core/` because the issuance form's type selector is the next consumer, so both screens agree on "newest" by construction. `features/credential-details/legacy/legacy-credential-support.ts` deliberately keeps its own parser: it is documented as temporary/removable-in-one-step and applies a different policy (unversioned ids compete as version 0). **Technical debt:** the client should not have to infer this — the Issuer should
  return legacy and still-issuable configurations already distinguished (a
  `deprecated`/`issuable` flag per entry) rather than leaving the UI to derive it
  from the id convention.
  - **Per-tenant credential-type visibility.** New `core/helpers/credential-type-visibility.ts` hides types that belong to one organisation from the others' screens (`doctorid` → CGCOM, `gx.labelcredential` and `learcredential.machine` → DOME); `sandbox` and `platform` see the whole registry. Matching is on segment boundaries, so a future `doctoridentity.w3c.1` is not caught by the `doctorid` rule; restrictions are opt-in (an unlisted type is visible everywhere) so a new type is never invisible the day it ships; an empty or unresolved tenant sees only unrestricted types. This is presentation only — the issuer decides what a tenant may actually issue. **Technical debt:** the allowlist is hardcoded in the front end and must move to configuration (served by the Issuer per tenant); tracked for its own ticket.
  - **Both filters are presentation only.** `entries()` keeps the registry as the backend returned it and the `PUT` is built from it, so a hidden row (restricted type or superseded version) carries its stored state through untouched — under replace-all semantics, omitting it would turn "this row is hidden" into "this row is now disabled". `visibleEntries` tracks the tenant signal as well as `entries`, so a late tenant resolution re-filters instead of leaving a restricted row on screen. Emptiness is judged *after* filtering: a registry with nothing renderable hits the same "no credential type found" dead end as the 404. Preserving a superseded version's stored state is not only about replace-all: the backend returns legacy and current configurations indiscriminately, and the front end still needs the legacy ones to know how to render the fields of credentials already issued under them — so disabling one as a side effect of hiding it could break the details view of existing credentials, not just future issuance.
  - **Row layout.** Each row shows display name · format · version badge on one line, with the name ellipsised and the toggle never shrinking. `displayName` alone is ambiguous — two formats of the same type share it — so the toggle's accessible name carries name, format and version (`catalog.toggle-aria`, `catalog.version`), resolved once in the template so badge and accessible name cannot diverge.
  - **Unsaved changes.** New shared `UnsavedChangesService` + `guardUnloadWhileUnsaved()` (`shared/services/unsaved-changes.service.ts`), extracted from `CredentialIssuanceService` so the issuance form and the catalog challenge in-app navigation and browser unloads identically; each screen still owns *what counts as a change*. The catalog route gained `canDeactivate: [canDeactivateGuard]` — toggles live in memory until the `PUT` succeeds. `confirm()` rather than a `MatDialog` because `canDeactivate` must answer synchronously; the `beforeunload` handler only calls `preventDefault()`, since browsers suppress `confirm()` there and ignore custom messages.
  - **Settings shell.** The "Schemes" and "Trust Framework" sidenav links were removed: neither section exists — schemes reused the issuance form as a placeholder and Trust Framework navigated out of Settings to `/organization/credentials`. `.settings__container` now has a *definite* `height: 90dvh` (with a `90vh` fallback) instead of `min-height`: Material styles `mat-drawer-content` as `height: 100%; overflow: auto`, and a percentage against an auto-height parent resolves back to auto, so the whole chain collapsed to content height and the catalog's save button ended up below the fold. `:host { display: block }` removes the stray line-height gap under the sidenav container.
  - **i18n.** `catalog.*` and `sidenav.catalog` added in `es`, `en` and `ca`, later extended with `catalog.version`, `catalog.error.not-configured.*` and a shared `unsavedChanges.leaveAlert`; `catalog.description`, `catalog.empty-set-warning` and `catalog.toggle-aria` reworded to match the empty-selection warning and the format/version row.
  - **Tests.** `credential-catalog.service.spec.ts` (GET/PUT payloads, URL from `TenantService`, 400/403/500 propagation) and `credential-catalog.component.spec.ts` (toggle rendering and accessible names, save-button enablement, EC-01 warning and blocked save, load / forbidden / not-configured / save-error states, retry, read-only SysAdmin, reload-after-save paths, version and per-tenant filtering, unsaved-changes prompt). New `credential-configuration-id.spec.ts` and `credential-type-visibility.spec.ts` for the helpers, and a new `settings.routes.spec.ts` for the default redirect and the `canDeactivate` wiring. `settings.component.spec.ts` covers nav-link visibility per role.

### Changed

- **EUD-72 — `/settings` is gated by role, not by a TMF power**
  - `PoliciesService.checkSettingsPolicy()` no longer requires `hasPower('CredentialIssuer','Configure')`. It awaits the backend's verdict via `AuthService.resolveRole$()` (`GET /api/v1/me`) and admits any non-LEAR role, with `isSysAdmin()` kept as a token-based fallback for when `/me` fails. The Issuer resolves administrators from `Onboarding/Execute` + `admin_organization_id` (TenantAdmin) or `System/Administration` (SysAdmin) and **never reads `CredentialIssuer/Configure`**, so the old check locked genuine tenant admins out of Settings — and therefore out of the catalogue — while letting a LEAR holding the unused power through to a screen the API answers with 403 (§2.3/§7.2).
  - `navbar.component.ts`: the Settings menu entry now uses `canSeeSettings = roleType() !== LEAR`, the same predicate as the guard and `SettingsComponent.canSeeCatalog`, so menu, guard and API finally agree. The previously documented discrepancy (entry stricter than the guard, gated on a power the API ignores) is gone. The entry appears one round trip after login, which is invisible in practice since it lives inside a click-triggered `mat-menu`.
  - `AuthService`: `roleType` became a `computed` over a new writable `resolvedRole` signal, which is `null` until `/me` answers — a state that must stay distinguishable from LEAR, because guards running at navigation time would otherwise deny every administrator who arrives first. `resolveRole$()` exposes that verdict as a one-shot observable, triggering the fetch if nothing has and deduping against an in-flight call; a failed `/me` still *resolves* (to LEAR) so navigation never hangs. Logout resets it to `null`, not to LEAR, so a second login in the same tab re-asks the backend. Note the asymmetry documented in the code: deny-if-not-admin predicates (`roleType() !== LEAR`) fail safe while unresolved, deny-if-read-only ones (`!== SYSADMIN_READONLY`) read as permissive — new screens needing that distinction must read `resolvedRole()` and handle `null`.
  - `PoliciesService`: the denial path (dialog → optional logout → redirect → `false`) was extracted into `denyAndRedirect()`, shared by the onboarding and settings policies.
  - Tests: `auth.service.spec.ts` and `policies.service.spec.ts` cover `resolveRole$()` (dedup, failure-resolves-to-LEAR, reset on logout) and the role-based settings gate; `navbar.component.spec.ts` covers the Settings entry per role. Because `resolvedRole$` is `toObservable`-backed and therefore effect-driven, specs must await a tick rather than expect a synchronous value.

### Added - 04-08-2026

- **EUD-71 — Select form and issue credential (issuer's default form)**: the Credential Manager issuance screen already existed end-to-end; this Story closes three conformance gaps against the SRS without building any new endpoint.
  - **AD-1 — Catalog of forms without hardcoding (FR-01/FR-04)**: removed `CredentialIssuanceService.resolveCredentialTypesByTenant()` (special-cased `KPMG` + static `ISSUANCE_CREDENTIAL_TYPES_ARRAY` as source, with its `TODO` to remove the hardcoding). `CredentialIssuerMetadataService.getIssuableCredentialTypes()` now derives the issuable-type list from `credential_configurations_supported` (metadata already tenant-filtered on the backend). `CredentialIssuanceService.credentialTypesArr$`/`isCatalogUnavailable$` are reactive signals that distinguish "tenant with no forms enabled" from "catalog unavailable" (new `hasMetadataLoadFailed()`), always fail-closed — with no metadata, the selector stays empty and never falls back to a hardcoded list. `CredentialIssuanceComponent` adds an accessible empty state (`role="status"`, `aria-live="polite"`).
  - **AD-2 — Form fields derived from the credential definition (FR-10/FR-02)**: new `claims-to-schema.mapper.ts` (pure function) transforms the selected config's `credential_metadata.claims[]` into form fields, labeling from `display[].name` for the active locale with `path.join('.')` as fallback. Wired into `LearCredentialEmployeeSchemaProvider` for the `mandatee` group (the `mandator` and `power` groups stay out of scope — static side data and a custom component, respectively). If the definition carries no capturable claims, a provisional employee field set is used as a bridge until EUD-58 publishes the definitive schema — isolated to a single point to minimize future rework. Added `label?: string` to the field view-model and its fallback in `DynamicFieldComponent`, without which the metadata-derived label could not render.
  - **AD-3 — Issuance result: success/failure only (FR-09)**: removed the branch that opened `CredentialOfferDialogComponent` (offer URI/QR) after a 2xx — offer delivery belongs to Epic EUD-3. After a 2xx the success dialog is always shown. The `CredentialOfferDialogComponent` component is kept (no other consumers in the repo) for that future Epic.
  - **Observable issuance failure (AC-06, real gap closed)**: `DialogWrapperService.openDialogWithCallback()` only logged the error to console, leaving the Operator with no failure confirmation at all. `CredentialIssuanceService.submitCredentialPayload()` adds `catchError` + a new failure dialog (`openFailedCreateDialog()`, i18n keys `create-error-dialog`) without resetting the form, plus a `timeout(30s)` so the Operator is never left indefinitely stuck if the Issuer doesn't respond (ES-05).
  - **Security**: removed a PII console dump (`console.error(formValue)`) in `CredentialIssuanceComponent.onSubmit()` on invalid-form submit.
  - **Test coverage**: 191 tests across the credential-issuance area (new/updated: `credential-issuer-metadata.service.spec.ts`, `credential-issuance.service.spec.ts`, `credential-issuance.component.spec.ts`, `claims-to-schema.mapper.spec.ts`, `issuance-schema-builder.spec.ts`, `lear-credential-employee-issuance-schema-provider.spec.ts`).

## [3.5.32] - 06-08-2026

### Added

- **EUD-73 — Validate the form before issuing** (FR-07, FR-08): client-side validation blocks the issuance trigger with contextual per-field feedback when a required field is empty or its value doesn't match the declared basic type (date/number). Adds `FieldValidationRuleResolver` (generic safe-deploy rule seam, AC-06/EC-01/EC-02), `BasicTypeValidators.date()`/`.numeric()` (AC-03/ES-01), `controlType: 'date'` support with `aria-describedby`/`role="alert"` accessibility (NFR-A-EUD73-01), a whitespace-only fix to the `required` validator (EC-03), and fail-closed hardening of the submit gate for a missing schema/type (ES-02/AC-04/ES-03).

### Changed

- **EUD-73 (post-merge with EUD-71)**: `LearCredentialEmployeeSchemaProvider` now derives its required `mandatee` keys from `FieldValidationRuleResolver` instead of its own hardcoded list, consolidating into a single source of truth without changing observable behavior.

## [3.5.31] - 06-08-2026

### Fixed

- **SSO reuse still intermittently failing for custom-domain tenants after 3.5.30 (EUDISTACK-548)**: memoizing `TenantService.resolve()` only guaranteed its two independent callers (`main.ts`'s `APP_INITIALIZER` and `TenantAwareStsConfigLoader.loadConfigs()`) agreed *within* one page load — it didn't help across the two *separate* page loads the silent-SSO round trip actually involves (the page that launches `authorize()`, and the page that receives its callback), each making its own fresh `/assets/tenants/custom-domain.json` fetch. A persistent failure of that fetch on just one of the two still let the resolved `tenant`/OIDC `clientId` differ between them, reproducing `"could not find matching config for state X"` — confirmed live against STG (`dome-marketplace-lcl.org`) even with 3.5.30 already deployed. Canonical tenants (`<tenant>.stg.eudistack.net` / `*.127.0.0.1.nip.io`) never hit this, since their resolution is synchronous from the hostname — which is also why it was never reproducible locally. Fixed by caching the resolved result in `sessionStorage`: once the first page load in a tab resolves successfully, every later page load in the same tab (including the SSO callback) reads the cached value synchronously with no network call, closing the race entirely.

## [3.5.30] - 06-08-2026

### Fixed

- **SSO reuse intermittently failing on custom-domain tenants (e.g. `dome-marketplace-lcl.org`) with `"could not find matching config for state X"` (EUDISTACK-548)**: `TenantService.resolve()` is called independently from `main.ts`'s `APP_INITIALIZER` and from `TenantAwareStsConfigLoader.loadConfigs()` on every page load, each firing its own `/assets/tenants/custom-domain.json` fetch with no memoization. The resolved `tenant` feeds directly into the OIDC `clientId`, which keys the PKCE state `angular-auth-oidc-client` stores in `sessionStorage` — a transient failure of that one fetch (STG network blip, cold CDN cache) on either the page that launches the silent-SSO redirect or the page that receives its callback silently left `tenant` empty (the failure path had zero logging), producing a different `clientId` between the two independent page bootstraps and breaking the state lookup. Confirmed via a live STG repro with an automated browser. Fixed by memoizing `resolve()` (one fetch per page load, shared by both call sites), retrying the fetch (2 retries, linear backoff) to reduce the odds of a transient failure winning the race, and logging the failure instead of swallowing it silently. Added `tenant.service.spec.ts` (previously untested).

## [3.5.29] - 03-08-2026

### Fixed

- **RP-Initiated Logout not actually terminating the SSO session (EUDISTACK-551)**: `AuthService.logout()` called `oidcSecurityService.logoffLocal()`, which only clears this tab's tokens and never reaches the Verifier's `end_session_endpoint` — the Single Logout back-channel notification to other apps never fired. Switched to `oidcSecurityService.logoff()` (RP-Initiated Logout). Local cleanup (`sessionStorage.clear()`) is now deferred to the error-fallback path only — it was previously wiping the `id_token` the library needs to build `id_token_hint` before `logoff()` could read it, silently turning "Log out" into a no-op.
- **SSO reuse (US-03, EUDISTACK-548) intermittently failing on a direct deep link** (e.g. `/organization/credentials`) with `"could not find matching config for state X"` or a token-exchange `invalid_grant`: two independent auto-login mechanisms — the app's own `trySilentSsoOnce()` and the library's `AutoLoginPartialRoutesGuard` — both fired an `authorize()` call on the same page load, racing to write the same PKCE `sessionStorage` bucket. Removed `AutoLoginPartialRoutesGuard` from the routes; `trySilentSsoOnce()` already covers the same case.
- **False "Access Denied" dialog + forced logout racing the SSO-reuse redirect**: `PoliciesService.executePolicy()` (backing `basicGuard`/`settingsGuard`) evaluated `hasPower()`/`isSysAdmin()` before the app's own auth check had resolved. Added `AuthService.authCheckComplete$`, which guards now wait on before evaluating powers — refined further so it also stays pending while a silent-SSO redirect has just been launched but not yet navigated away (that redirect is asynchronous; PKCE `code_challenge` generation uses Web Crypto).
- **Navbar user menu disappearing after a hard refresh**: `NavbarComponent` lives in the root shell and mounts before `checkAuth$()` resolves; `getMandator()`/`getName()` used `take(1)`, capturing the still-empty value and never updating. Switched to `takeUntilDestroyed()`.

## [3.5.28] - 24-07-2026

### Added

- **Calidalia tenant**: added `'calidalia'` to `KNOWN_TENANTS` (`tenants.constants.ts`) so the tenant guard resolves the hostname instead of redirecting to `/tenant-not-found`.

## [3.5.27] - 22-07-2026

### Added

- **EUD-98 — Know the result of the revocation and leave a trace of the reason**
  - i18n: `credentialDetails.revokeCredentialSuccess.message` (es/en/ca) now explicitly confirms the credential's status was published to the revocation list, not just "revoked" (AC-05). No code change — `executeCredentialBackendAction` already consumes this key via `translate.instant`.
  - Tests: new `revokeCredential (callback behaviour)` spec in `credential-actions.service.spec.ts`, asserting the success dialog shows the `revokeCredentialSuccess` i18n keys and that a revoke error never shows a misleading success dialog (AC-05, AC-06 regression — `handleRevocationError` coverage already present from EUD-97).

### Fixed [3.5.26] - 22-07-2026

- **Public credential-offer pages bounced to home / dashboard by the silent-SSO redirect**
  - Visiting `credential-offer` or `credential-offer-refresh/:token` without a session briefly rendered the page and then redirected away: `AuthService`'s constructor runs `checkAuth$()` at bootstrap on every route, and when not authenticated it fired `trySilentSsoOnce()` (a full-page `prompt=none` redirect to the Verifier). The Verifier replied `error=login_required` and sent the browser to the fixed `redirectUrl` (app root → `home`), discarding the original offer URL.
  - `AuthService`: added `isOnPublicRoute()` and gated `trySilentSsoOnce()` behind it, so the silent-SSO redirect is skipped on the auth-guard-free public routes. The helper reads `location.pathname` (not `router.url`) because it runs from the constructor before the Angular router has resolved the initial navigation.
  - `iam.constants.ts`: new `PUBLIC_ROUTE_PREFIXES`, matched with an anchored `startsWith` against `location.pathname`. Since `pathname` includes the app baseHref, both the app-relative (`/credential-offer`, `/credential-offer-refresh`) and `/issuer`-prefixed variants are listed. Kept in sync with the auth-guard-free routes in `app.routes.ts`.
  - Tests: added `AuthService` specs covering `isOnPublicRoute()` (public vs protected paths) and that `checkAuth$()` skips the silent-SSO redirect on public routes while still firing it on protected ones.

### Changed [3.5.25] - 21-07-2026

- Only show the revocation button for credentials whose credential status is of type `BitstringStatusListEntry`. This hides the button for legacy credentials that have `PlainListEntity` credential status.

## [3.5.24] - 21-07-2026

### Fixed

- Navbar logout button disappearing after closing the "Credential revoked" dialog (also reproducible after signing, withdrawing or archiving a credential): removed the same unnecessary `location.reload()` call — already fixed in `CredentialIssuanceService` in 3.5.21 — that remained in `CredentialActionsService.executeCredentialBackendAction()`, shared by `signCredential`, `revokeCredential`, `withdrawCredential` and `archiveCredential`. The full-page reload raced the OIDC re-authentication against the navbar rendering `userName`. The list refresh is already handled by `CredentialManagementComponent.ngOnInit()` on route navigation.
- Updated `credential-actions.service.spec.ts` to drop the now-obsolete `window.location.reload` assertion/mock.

## [3.5.23] - 21-07-2026

### Fixed

- **Render legacy (pre-versioned) credentials in the details view**
  - Migrated credentials store a legacy `credential_configuration_id` (e.g. `LEAR_CREDENTIAL_EMPLOYEE`) that no longer matches the issuer metadata, so `CredentialDetailsService.resolveSchema` threw `No schema available for credential ...` and neither the schema nor the display name resolved.
  - Added a self-contained, removable legacy compatibility layer in `credential-details/legacy/legacy-credential-support.ts`:
    - `matchLegacyConfig`: resolves a credential by matching its VC `type[]` against `credential_definition.type`, choosing the highest version that still declares the legacy type name (employee → `w3c.3`, machine → `w3c.2`, label → `w3c.1`).
    - `normalizeLegacyCredential`: rewrites DOME v1 data shapes so existing renderers work unchanged — `tmf_domain`/`tmf_function`/`tmf_action` → `domain`/`function`/`action` (which previously crashed `DetailsPowerComponent`), and `mandator.emailAddress` → `email`.
  - `CredentialDetailsService`: wired the fallback into `resolveSchema` and `credentialDisplayName$`, guarded so it runs only when the exact metadata lookup fails; the original `throw` is kept when nothing matches.
  - `CredentialIssuerMetadataService`: added generic `getAllConfigurations()` accessor.
  - Tests: new `legacy-credential-support.spec.ts`; added `resolveSchema` legacy-fallback specs and extended the metadata mock in `credential-details.service.spec.ts`.

## [3.5.22] - 16-07-2026

### Added

- **EUD-97 — Protect revocation against non-revocable states and out-of-scope credentials**
  - `CredentialProcedureService`: new `handleRevocationError`, chained after `handleError` in `revokeCredential`. Maps `409` → "credential not revocable" dialog, `403` → "not authorized" dialog, using the existing `openErrorInfoDialog` pattern. Unlike `handleCredentialOfferError`, it does **not** redirect — the operator stays on the credential detail view so the reason for the denial remains visible (AC-07, AC-08).
  - `i18n`: added `error.revocation.notRevocable` / `error.revocation.forbidden` keys in `es.json`, `en.json`, `ca.json`.
  - Tests: new specs for `handleRevocationError` (409/403) in `credential-procedure.service.spec.ts`, verifying the correct dialog opens and no navigation occurs.
  - Confirmed existing `statusHasRevokeCredentialButton` (`actions-helpers.ts`) already returns `true` only for `VALID` — defense-in-depth for EC-02, already covered by `actions-helpers.spec.ts`.

## [3.5.21] - 10-07-2026

### Fixed


- Navbar logout button disappearing after closing the credential-offer QR dialog: removed the unnecessary `location.reload()` call in `CredentialIssuanceService.submitCredentialPayload()`, which forced a full-page reload and raced the OIDC re-authentication against the navbar rendering `userName`. The list refresh is already handled by `CredentialManagementComponent.ngOnInit()` on route navigation.


### Added

- `AuthService`: when `checkAuth$()` resolves as not authenticated, attempt a one-shot silent SSO check via a full-page redirect with `prompt=none` (`trySilentSsoOnce`), guarded by a `sessionStorage` flag so it only runs once per browser session. This lets a session already established on another tenant app (sharing the same root-domain cookie) be picked up without showing the QR login unnecessarily; the Verifier's `frame-ancestors` CSP prevents doing this via a silent iframe renew.

## [3.5.20] - 07-07-2026

### Fixed


- In issuances table pages, do not throw blocking error when an issuance object doesn't include a required field. Treat it as empty instead.

## [3.5.19] - 07-07-2026

### Reverted

- Reverted accidental overwrite of wallet and OIDC config files caused by merging EUD-129 branch over EUD-94 work: `oidc-config.builder.ts`, `tenant-aware-sts-config.loader.ts`, `iam.constants.ts`, `wallet.constants.ts`, `server-error-interceptor.ts`, `credential-issuer-metadata.service.ts`, `credential-procedure.service.ts`, `me.service.ts`, `tenant.service.ts`, `credential-offer-refresh.service.ts`, `credential-offer-onboarding.component.ts/html`, `credential-offer.component.ts/html`, `configuration.repository.ts`, `credential-offer-dialog.component.ts/html`, `navbar.component.ts`, `environments/environment.ts`, `global.d.ts`.
- Restored `package-lock.json` to the state of the EUD-94 branch, undoing the lockfile overwrite introduced by the EUD-129 merge.

## [3.5.18] - 02-07-2026

### Added

- **EUD-94 — Filter and sort credential set**
  - `CredentialManagementComponent`: added status filter (`mat-select`) alongside the text search input.
  - `CredentialManagementComponent`: implemented compound filtering (`applyCompoundFilter`) using JSON serialization to filter by text and status simultaneously (AND evaluation).
  - `CredentialManagementComponent`: split generic empty state into three distinct states: "Load Error" (API failure), "No Credentials" (empty tenant), and "No Matches" (filters applied but no results, includes a "Clear filters" button).
  - `i18n`: added translations for the new filter dropdown, options, and empty states in `ca.json`, `en.json`, and `es.json`.

### Fixed

- **EUD-129 — SoD AC-08 refinement: SYSADMIN vs Caso A distinction**
  - `AuthService`: added `isSysAdminRole` signal (set from `GET /api/v1/me` `role === 'SYSADMIN'`) and `organizationIdentifier` signal to distinguish system admins mapped as `TENANT_ADMIN` from actual Caso A credentials.
  - `CredentialDetailsService.canWrite`: Caso A (TENANT_ADMIN + multi_org + not SYSADMIN) can now action only credentials belonging to their own organization; system admins retain full write access in multi_org tenants.
  - `CredentialManagementComponent.canWrite`: Caso A can create credentials (only `SYSADMIN_READONLY` is blocked); the org-level restriction applies only to actions on existing credentials.
  - Test specs updated: `mockAuthService` extended with `roleType`, `tenantType`, `isSysAdminRole` and `organizationIdentifier` signals; `credential-details.component.spec.ts` mock extended with `showArchiveCredentialButton$`; `credential-management.routes.spec.ts` updated for 3 routes (added `archived`).

## [3.5.17] - 25-06-2026

### Added

- **EUD-129 — Archive terminated procedures (FR-14, FR-15, FR-16)**
  - `CredentialProcedureService.archiveCredential()`: new method `PATCH /api/v1/issuances/{id}` with `{ status: 'ARCHIVED' }` (AC-03).
  - `CredentialActionsService.openArchiveCredentialDialog()`: explicit confirmation dialog with async callback; definitive with no reverse action (AC-03).
  - `CredentialDetailsService.showArchiveCredentialButton$`: computed signal that shows the button only on terminal states (`WITHDRAWN`, `REVOKED`, `EXPIRED`) with `canWrite` (AC-01, AC-02, AC-08).
  - "Archive" button in `CredentialDetailsComponent` — visible only on terminal states, hidden in "Archived" context (AC-01, AC-02, AC-06).
  - New `ArchivedCredentialsComponent` view with route `archived`: lists exclusively `ARCHIVED` procedures for the tenant, without lifecycle actions, with an informative empty state (AC-04, AC-05, AC-06, AC-09, EC-01).
  - "Archived" navigation tab in both the main view and the archived view (AC-05).
  - i18n keys in `es.json`, `en.json` and `ca.json`: confirmation dialog, success message, button label, tab title and empty state (AC-03, AC-05).

## Added (15-06-2026)

- Added `cgcom` to the list of known tenants.

## [3.5.10] - 15-06-2026

### Added (15-06-2026)

- **`TenantService`**: a new signal-based service that centralizes tenant resolution. On initialization, the app first tries to resolve the tenant from `window.location.hostname` (existing behavior). If the hostname is not recognized, it performs a `GET assets/tenants/custom-domain.json` request and looks up the hostname as a key in the domain-to-tenant map, validating that the resolved value is a known tenant. The tenant is resolved **before** the theme is loaded (`TenantService.resolve()` → `ThemeService.load()`).

### Changed (15-06-2026)

- `ThemeService`, `AuthService`, and the `TenantNotFound` flow in `tenantGuard` now read the tenant from the `TenantService.tenant()` signal instead of calling `resolveTenant(window.location.hostname)` directly.
- The functions from `tenants.constants.ts` (`resolveTenant`, `buildFallbackUrl`, `stripEnvSuffix`, etc.) have been moved to `TenantService` as private/public methods. The constants (`KNOWN_TENANTS`, `FALLBACK_TENANT`, `MFE_HOME_PATH`, `ENV_SUFFIXES`) remain in `tenants.constants.ts`.
- Client configuration now runs after the tenant has been resolved, since when no `CLIENT_ID` value is provided, the client ID is configured as `CLIENT_ID_PREFIX` + tenant.

## [3.5.9] - 2026-05-28

### Changed

- Migrated Angular build from legacy `browser` builder (`@angular-devkit/build-angular:browser`) to the new `application` builder (`@angular-devkit/build-angular:application`). Output now lands in `dist/{name}/browser/`, which aligns the CI/CD pipeline with the expected artifact path.

## [3.5.8] - 2026-05-28

### Added

- Updated GHA

## [3.5.7] - 2026-05-22

### Added

- Added subject title label for en, es, ca on the credential detail page.

## [3.5.6] - 2026-05-18

- Hid the "on behalf of" button in simple tenants by updating the computed visibility guard to evaluate the newly exposed `tenantType`.

## [3.5.5] - 2026-05-13

### Fixed

- **Credential Issuance**: Fixed a role mismatch between the frontend UI and backend validation. Restricted powers (`Onboarding/Execute` and `Certification`) are now always available in the power selector for `sysAdmin`, and only available to `TenantAdmin` users when issuing a credential _on behalf of_.

### Added

- New link on the `tenant-not-found` screen to access the knowledge base.
- Adaptation in `home` of the knowledge base link applying the same methodology as wallet PWA 3.4.0 (dynamic derivation of `KNOWLEDGE_BASE_URL` from the origin at runtime).

### Changed

- Improved eudistack logo image contrast: switched to dark logo for better readability.

## [3.5.4] - 2026-05-11

### Fixed

- Fixed "New Credential on behalf" button not appearing on the initial load of the credentials page.

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
