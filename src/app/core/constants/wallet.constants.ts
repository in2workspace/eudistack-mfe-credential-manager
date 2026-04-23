// Atlassian-style same-origin wallet routing.
// The wallet SPA is hosted at `<origin>/wallet/` on every tenant, so we derive
// its URL from `window.location.origin` rather than a build-time env var.
export const WALLET_BASE_URL = `${globalThis.location.origin}/wallet`;
export const WALLET_SAME_DEVICE_URL = `${WALLET_BASE_URL}/protocol/callback`;
