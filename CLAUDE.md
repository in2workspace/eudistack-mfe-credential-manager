# MFE Credential Manager — Repo Guide for Claude

> **Per-repo CLAUDE.md.** Loaded only when working inside this repo. The
> SDD Constitution lives in `../eudistack-platform-dev/CLAUDE.md`.

## Identity

Angular 19 micro-frontend (MFE) for the **Portal Console** that
provides credential issuance management to tenant administrators
(create offers, manage templates, audit emissions).

Loaded via Module Federation by `eudistack-portal-console` (shell).

## Tech stack

- **Angular 19** standalone components
- **Module Federation** (consumed by portal-console shell)
- **Angular Material** (Material 3)
- **TypeScript** strict mode
- **@ngx-translate** for i18n
- **angular-auth-oidc-client** for OIDC
- **Jest** + Testing Library
- **ESLint** + Angular ESLint

## Architecture

Standalone components. Routes lazy-loaded. Strict conventions:
`../eudistack-platform-dev/.claude/rules/frontend-conventions.md`.

## Multi-tenancy

Resolved **client-side by hostname**, not by an `X-Tenant-Id` header. There is
no tenant HTTP interceptor: the backend derives the tenant from the host and
from the OIDC token.

- `TenantService` (`src/app/core/services/tenant.service.ts`) is the single source of truth. `resolve()` runs once at bootstrap via `APP_INITIALIZER` in `src/main.ts`, before the OIDC config is built.
- Resolution order:
  1. **Canonical host** — first hostname label, minus an optional env suffix (`ENV_SUFFIXES` = `-stg`, `-dev`, `-pre`), matched against `KNOWN_TENANTS`.
  2. **Custom domain** — `GET /assets/tenants/custom-domain.json` (deploy-time asset, see `CustomDomainConfig`) maps `domains[hostname] → { tenantId, envId }` and `tenants[tenantId].env[envId] → { issuer, verifier, wallet }`.
- Exposed as signals: `tenant()`, `canonical()`, `iamUrl()`, `walletUrl()`, `defaultWalletUrl()`. `environment.iam_url` always wins over the JSON.
- Unresolved tenant → `tenant()` is `''` → `tenantGuard` redirects to `/tenant-not-found`; `buildFallbackUrl()` rewrites the host to `FALLBACK_TENANT` (`sandbox`).
- `KNOWN_TENANTS` lives in `src/app/core/constants/tenants.constants.ts` and is **duplicated** in `eudistack-core-wallet-pwa` (same path). Any change here MUST be mirrored there until EUDI-048 moves the list to the edge (API Gateway).

## Common commands

> **Do NOT `ng serve`** — use `make up` from `eudistack-platform-dev`.

| Task | Command |
|------|---------|
| Install | `npm ci` |
| Production build | `npm run build` |
| Tests | `npm test` |
| Tests with coverage | `npm test -- --coverage` |
| Lint | `npx eslint .` |
| Federation expose check | `npx ng build && npx http-server dist/eudistack-mfe-credential-manager` (smoke load) |

## Where to find specs

`../eudistack-platform-dev/docs/EUDISTACK-NNN-*/EUDISTACK-MMM/`. Figma
page **06 Issuer**.

## Git workflow

- **Squash merge to `main`.** Conventional Commits + Story footer.

## References

- Constitution: [`../eudistack-platform-dev/CLAUDE.md`](../eudistack-platform-dev/CLAUDE.md)
- Skills: `angular-conventions`, `figma-ux-review`, `commit-conventions`
- Rules: `frontend-conventions`
