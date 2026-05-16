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

- `KNOWN_TENANTS` list duplicated here and in Wallet PWA — keep in sync (tech debt EUDI-048).
- All HTTP calls propagate `X-Tenant-Id` via `TenantHttpInterceptor`.

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
