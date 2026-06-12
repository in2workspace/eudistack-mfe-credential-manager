export const KNOWN_TENANTS: readonly string[] = [
  'dome',
  'kpmg',
  'sandbox',
  'platform',
  'eudistack',
  'localhost',
];

export const FALLBACK_TENANT = 'sandbox';
export const MFE_HOME_PATH = '/issuer/home';
export const ENV_SUFFIXES = ['-stg', '-dev', '-pre'] as const;
