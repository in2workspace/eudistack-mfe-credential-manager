import { Theme } from '../models/theme.model';
import { defaultTheme } from './default-theme';

/** Only `#RGB` and `#RRGGBB` reach CSS: anything else could inject declarations into `:root`. */
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Generic placeholder the shared `theme.json` files use; every interface rewrites it to the tenant's folder. */
const TENANT_ASSET_PLACEHOLDER = 'assets/tenant/';
const TENANT_ASSETS_PREFIX = '/assets/tenants/';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** A valid hex color, expanded to `#RRGGBB` so every later calculation handles one format; else null. */
function color(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || !HEX_COLOR.test(candidate)) {
    return null;
  }
  if (candidate.length === 4) {
    const [, r, g, b] = candidate;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return candidate;
}

/**
 * Rewrites `/assets/tenant/x` or `assets/tenant/x` to `/assets/tenants/{tenant}/x`, as the
 * Login, the Wallet and the issuance portal do. Paths already under `/assets/tenants/`
 * and any other value are kept as they are.
 */
function tenantAsset(value: unknown, tenant: string): string | null {
  const path = text(value);
  if (!path || path.startsWith(TENANT_ASSETS_PREFIX)) {
    return path;
  }
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return normalized.startsWith(TENANT_ASSET_PLACEHOLDER)
    ? `${TENANT_ASSETS_PREFIX}${tenant}/${normalized.slice(TENANT_ASSET_PLACEHOLDER.length)}`
    : path;
}

/** The tenant's languages, or null when the block is unusable as a whole (no list, or a default outside it). */
function languages(value: unknown): Theme['i18n'] | null {
  if (!isObject(value) || !Array.isArray(value['available'])) {
    return null;
  }
  const available = value['available']
    .map(text)
    .filter((lang): lang is string => lang !== null);
  const defaultLang = text(value['defaultLang']);
  if (available.length === 0 || !defaultLang || !available.includes(defaultLang)) {
    return null;
  }
  return { defaultLang, available };
}

/**
 * Builds the portal theme from a tenant's `theme.json` (EUD-341).
 *
 * Never throws. Without a `branding` object the whole EUDIStack theme applies; otherwise
 * each field is validated on its own and an invalid one falls back to its EUDIStack value
 * without invalidating the rest.
 *
 * `content` always stays EUDIStack's: the portal takes only the brand and the languages
 * from the tenant (EUD-341, decision P-6 pending with the order's author). Today that
 * keeps the revocation help link on the EUDIStack knowledge base.
 */
export function resolveTenantTheme(descriptor: unknown, tenant: string): Theme {
  const fallback = defaultTheme();
  if (!isObject(descriptor) || !isObject(descriptor['branding'])) {
    return fallback;
  }
  const branding = descriptor['branding'];
  const base = fallback.branding;

  return {
    branding: {
      name: text(branding['name']) ?? base.name,
      primaryColor: color(branding['primaryColor']) ?? base.primaryColor,
      primaryContrastColor: color(branding['primaryContrastColor']) ?? base.primaryContrastColor,
      secondaryColor: color(branding['secondaryColor']) ?? base.secondaryColor,
      secondaryContrastColor: color(branding['secondaryContrastColor']) ?? base.secondaryContrastColor,
      logoUrl: tenantAsset(branding['logoUrl'], tenant) ?? base.logoUrl,
      // No EUDIStack fallback: a dark EUDIStack logo next to the tenant's brand would mix both.
      logoDarkUrl: tenantAsset(branding['logoDarkUrl'], tenant),
      faviconUrl: tenantAsset(branding['faviconUrl'], tenant) ?? base.faviconUrl,
    },
    content: fallback.content,
    i18n: languages(descriptor['i18n']) ?? fallback.i18n,
  };
}
