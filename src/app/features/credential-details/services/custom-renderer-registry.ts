import { InjectionToken, Type } from '@angular/core';
import { DetailsPowerComponent, detailsPowerToken } from '../components/details-power/details-power.component';
import { CompliantCredentialsComponent, compliantCredentialsToken } from '../components/compliant-credentials/compliant-credentials.component';
import { Power, CompliantCredential } from 'src/app/core/models/entity/lear-credential';

export interface CustomClaimRenderer {
  component: Type<any>;
  token: InjectionToken<any>;
  transformValue?: (rawValue: any) => any;
}

export interface SchemaOverride {
  /** Overrides keyed by claim name (last path segment, e.g. "power", "gx:compliantCredentials") */
  claimOverrides?: Record<string, CustomClaimRenderer>;
}

const powerOverride: CustomClaimRenderer = {
  component: DetailsPowerComponent,
  token: detailsPowerToken,
  transformValue: (powers: Power[]) => powers ?? [],
};

const OVERRIDES: Record<string, SchemaOverride> = {
  'learcredential.employee.w3c': {
    claimOverrides: { power: powerOverride },
  },
  'learcredential.employee.sd': {
    claimOverrides: { power: powerOverride },
  },
  'learcredential.machine.w3c': {
    claimOverrides: { power: powerOverride },
  },
  'learcredential.machine.sd': {
    claimOverrides: { power: powerOverride },
  },
  'gx.labelcredential.w3c': {
    claimOverrides: {
      'gx:compliantCredentials': {
        component: CompliantCredentialsComponent,
        token: compliantCredentialsToken,
        transformValue: (creds: CompliantCredential[]) => creds ?? [],
      },
    },
  },
};

export function getOverrideForConfigId(configId: string): SchemaOverride | undefined {
  // Try exact match first, then prefix match (strip version suffix)
  if (OVERRIDES[configId]) return OVERRIDES[configId];

  const prefix = configId.replace(/\.\d+$/, '');
  return OVERRIDES[prefix];
}