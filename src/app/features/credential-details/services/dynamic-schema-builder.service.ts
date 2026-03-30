import { Injectable } from '@angular/core';
import { ClaimDefinitionDto, CredentialConfigurationDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import { DetailsGroupField, DetailsKeyValueField, ViewModelSchema } from 'src/app/core/models/entity/lear-credential-details';
import { getOverrideForConfigId, SchemaOverride } from './custom-renderer-registry';

@Injectable({ providedIn: 'root' })
export class DynamicSchemaBuilder {

  buildSchema(configId: string, config: CredentialConfigurationDto, credential: any): ViewModelSchema {
    const claims = config.credential_metadata?.claims ?? [];
    const override = getOverrideForConfigId(configId);

    const main = this.buildMainFields(claims, credential, override);
    const side = this.buildSideFields(credential);

    return { main, side };
  }

  private buildMainFields(
    claims: ClaimDefinitionDto[],
    credential: any,
    override?: SchemaOverride,
  ): DetailsGroupField[] {
    const groups = new Map<string, DetailsKeyValueField[]>();
    const overriddenClaims = new Map<string, string[]>();

    for (const claim of claims) {
      const { path } = claim;
      if (path.length === 0) continue;

      const claimKey = path[path.length - 1];

      if (override?.claimOverrides?.[claimKey]) {
        overriddenClaims.set(claimKey, path);
        continue;
      }

      this.addClaimToGroup(groups, claim, claimKey, path);
    }

    const result = this.groupsToFields(groups);
    this.appendOverriddenFields(result, overriddenClaims, override);
    return result;
  }

  private addClaimToGroup(
    groups: Map<string, DetailsKeyValueField[]>,
    claim: ClaimDefinitionDto,
    claimKey: string,
    path: string[],
  ): void {
    const groupKey = path.length > 1 ? path[path.length - 2] : '_root';
    const label = this.resolveDisplayName(claim);

    const valueMap = claim.value_map;
    const field: DetailsKeyValueField = {
      key: claimKey,
      label,
      type: 'key-value',
      value: (c: any) => {
        const raw = this.resolvePathValue(c, path);
        if (valueMap && typeof raw === 'string' && raw in valueMap) {
          return valueMap[raw];
        }
        return raw;
      },
    };

    const existing = groups.get(groupKey) ?? [];
    existing.push(field);
    groups.set(groupKey, existing);
  }

  private groupsToFields(groups: Map<string, DetailsKeyValueField[]>): DetailsGroupField[] {
    const result: DetailsGroupField[] = [];
    for (const [groupKey, fields] of groups) {
      result.push({
        key: groupKey === '_root' ? undefined : groupKey,
        type: 'group',
        value: fields,
      });
    }
    return result;
  }

  private appendOverriddenFields(
    result: DetailsGroupField[],
    overriddenClaims: Map<string, string[]>,
    override?: SchemaOverride,
  ): void {
    if (!override?.claimOverrides) return;

    for (const [claimKey, claimPath] of overriddenClaims) {
      const renderer = override.claimOverrides[claimKey];
      if (!renderer) continue;

      result.push({
        key: claimKey,
        type: 'group',
        custom: {
          component: renderer.component,
          token: renderer.token,
          value: (c: any) => {
            const raw = this.resolvePathValue(c, claimPath);
            return renderer.transformValue ? renderer.transformValue(raw) : raw;
          },
        },
        value: [],
      });
    }
  }

  private buildSideFields(credential: any): DetailsGroupField[] {
    const groups: DetailsGroupField[] = [];

    // Issuer group
    const issuer = credential?.issuer;
    if (issuer) {
      if (typeof issuer === 'string') {
        groups.push({
          key: 'issuer',
          type: 'group',
          value: [
            { key: 'id', type: 'key-value', value: () => issuer },
          ],
        });
      } else {
        const fields: DetailsKeyValueField[] = [];
        const fieldKeys = ['id', 'commonName', 'serialNumber', 'organization', 'organizationIdentifier', 'country'];

        for (const fk of fieldKeys) {
          if (issuer[fk] != null) {
            fields.push({
              key: fk,
              type: 'key-value',
              value: () => issuer[fk],
            });
          }
        }

        if (fields.length > 0) {
          groups.push({
            key: 'issuer',
            type: 'group',
            value: fields,
          });
        }
      }
    }

    // Credential Status group (status list link + index)
    const credentialStatus = credential?.credentialStatus;
    if (credentialStatus?.statusListCredential) {
      const statusFields: DetailsKeyValueField[] = [];

      statusFields.push({
        key: 'statusListCredential',
        type: 'key-value',
        value: () => credentialStatus.statusListCredential,
      });

      if (credentialStatus.statusListIndex != null) {
        statusFields.push({
          key: 'statusListIndex',
          type: 'key-value',
          value: () => String(credentialStatus.statusListIndex),
        });
      }

      if (credentialStatus.statusPurpose) {
        statusFields.push({
          key: 'statusPurpose',
          type: 'key-value',
          value: () => credentialStatus.statusPurpose,
        });
      }

      groups.push({
        key: 'credentialStatus',
        type: 'group',
        value: statusFields,
      });
    }

    return groups;
  }

  private resolvePathValue(obj: any, path: string[]): any {
    let current = obj;
    for (const segment of path) {
      if (current == null) return null;
      current = current[segment];
    }
    return current ?? null;
  }

  private resolveDisplayName(claim: ClaimDefinitionDto): string {
    const displays = claim.display;
    if (displays?.length) {
      const lang = navigator?.language?.split('-')[0] ?? 'en';
      return displays.find(d => d.locale === lang)?.name
        ?? displays.find(d => d.locale === 'en')?.name
        ?? displays[0].name;
    }
    return claim.path[claim.path.length - 1];
  }
}