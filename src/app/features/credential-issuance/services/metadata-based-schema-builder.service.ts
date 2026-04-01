import { inject, Injectable } from '@angular/core';
import { ClaimDefinitionDto, CredentialConfigurationDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import { 
  CredentialIssuanceViewModelSchema, 
  CredentialIssuanceViewModelGroupField, 
  CredentialIssuanceViewModelControlField,
  CredentialIssuanceViewModelField,
  SelectorOption,
  IssuanceStaticViewModel,
  IssuanceViewModelsTuple,
  CredentialIssuanceViewModelSchemaWithId,
  CredentialIssuanceViewModelGroupFieldWithId
} from 'src/app/core/models/entity/lear-credential-issuance';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class MetadataBasedSchemaBuilder {
  private readonly metadataService = inject(CredentialIssuerMetadataService);
  private readonly authService = inject(AuthService);

  /**
   * Builds issuance form schema from metadata configuration
   */
  buildSchemaFromMetadata(configId: string, onBehalf: boolean): IssuanceViewModelsTuple | null {
    const config = this.metadataService.getConfigurationById(configId);
    if (!config || !config.credential_metadata?.claims) {
      console.warn(`No metadata configuration found for configId: ${configId}`);
      return null;
    }

    const claims = config.credential_metadata.claims;
    const rawSchema = this.convertClaimsToSchema(claims);
    
    return this.separateStaticAndDynamicFields(rawSchema, onBehalf);
  }

  private convertClaimsToSchema(claims: ClaimDefinitionDto[]): CredentialIssuanceViewModelSchema {
    const groupsMap = new Map<string, CredentialIssuanceViewModelField[]>();
    const processedPaths = new Set<string>();

    for (const claim of claims) {
      if (!claim.path || claim.path.length === 0) continue;
      
      const pathKey = claim.path.join('.');
      if (processedPaths.has(pathKey)) continue;
      
      processedPaths.add(pathKey);
      
      const field = this.createFieldFromClaim(claim);
      if (!field) continue;

      const groupKey = this.determineGroupKey(claim.path);
      const existingFields = groupsMap.get(groupKey) || [];
      existingFields.push(field);
      groupsMap.set(groupKey, existingFields);
    }

    return this.convertGroupsMapToSchema(groupsMap);
  }

  private createFieldFromClaim(claim: ClaimDefinitionDto): CredentialIssuanceViewModelField | null {
    const fieldKey = claim.path[claim.path.length - 1];
    const displayName = this.getDisplayNameFromClaim(claim);
    
    // If the claim has a value_map, create a selector field
    if (claim.value_map && Object.keys(claim.value_map).length > 0) {
      return this.createSelectorField(fieldKey, claim);
    }

    // For simple fields, create text controls
    return this.createTextControlField(fieldKey, displayName);
  }

  private createSelectorField(fieldKey: string, claim: ClaimDefinitionDto): CredentialIssuanceViewModelControlField {
    const options: SelectorOption[] = Object.entries(claim.value_map || {}).map(([value, label]) => ({
      value,
      label
    }));

    return {
      key: fieldKey,
      type: 'control',
      controlType: 'selector',
      multiOptions: options,
      validators: [{ name: 'required' }]
    };
  }

  private createTextControlField(fieldKey: string, displayName: string): CredentialIssuanceViewModelControlField {
    // Determine if this should be a number field based on field name or type hints
    const controlType = this.shouldBeNumberField(fieldKey) ? 'number' : 'text';
    
    return {
      key: fieldKey,
      type: 'control',
      controlType,
      validators: [{ name: 'required' }]
    };
  }

  private shouldBeNumberField(fieldKey: string): boolean {
    // Common patterns for numeric fields
    const numericPatterns = ['age', 'year', 'number', 'count', 'amount', 'quantity'];
    const lowerKey = fieldKey.toLowerCase();
    return numericPatterns.some(pattern => lowerKey.includes(pattern));
  }

  private determineGroupKey(path: string[]): string {
    // If path length > 1, use the parent as group key
    if (path.length > 1) {
      return path[path.length - 2];
    }
    // Root level fields go to a default group
    return '_root';
  }

  private getDisplayNameFromClaim(claim: ClaimDefinitionDto): string {
    const displays = claim.display || [];
    if (displays.length === 0) {
      return claim.path[claim.path.length - 1];
    }

    // Try to get display in current locale, fall back to English, then first available
    const userLocale = navigator.language?.split('-')[0] || 'en';
    
    const localizedDisplay = displays.find(d => d.locale === userLocale) ||
                             displays.find(d => d.locale === 'en') ||
                             displays[0];
    
    return localizedDisplay.name;
  }

  private convertGroupsMapToSchema(groupsMap: Map<string, CredentialIssuanceViewModelField[]>): CredentialIssuanceViewModelSchema {
    const schema: CredentialIssuanceViewModelSchema = [];

    for (const [groupKey, fields] of groupsMap) {
      const group: CredentialIssuanceViewModelGroupField = {
        key: groupKey === '_root' ? 'main' : groupKey,
        type: 'group',
        display: this.determineDisplayType(groupKey),
        groupFields: fields
      };

      // Add static value getter for mandator group (common pattern from existing schemas)
      if (groupKey === 'mandator') {
        group.staticValueGetter = () => {
          const mandator = this.authService.extractRawMandator();
          return mandator ? { mandator: this.convertMandatorToKeyValueArray(mandator) } : null;
        };
      }

      schema.push(group);
    }

    return schema;
  }

  private determineDisplayType(groupKey: string): 'main' | 'side' | 'pref_side' {
    // Common patterns from existing schemas
    switch (groupKey.toLowerCase()) {
      case 'mandator':
        return 'pref_side'; // Shown in main when not onBehalf, side when onBehalf
      case 'mandatee':
        return 'main';
      default:
        return 'main';
    }
  }

  private convertMandatorToKeyValueArray(mandator: Record<string, any>): { key: string, value: string }[] {
    return Object.entries(mandator).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  }

  private separateStaticAndDynamicFields(
    rawSchema: CredentialIssuanceViewModelSchema,
    onBehalf: boolean
  ): IssuanceViewModelsTuple {
    const formViewModel: CredentialIssuanceViewModelSchemaWithId = [];
    const staticSchema: IssuanceStaticViewModel = {};

    for (const field of rawSchema) {
      // Add id for tracking in Angular template @for loops
      const fieldWithId: CredentialIssuanceViewModelGroupFieldWithId = { 
        ...field, 
        id: Math.random() * 1000 // NOSONAR - sufficient for UI tracking
      };

      if (this.shouldExtractStatic(fieldWithId, onBehalf)) {
        this.extractStaticData(fieldWithId, staticSchema);
        continue;
      }

      formViewModel.push(fieldWithId);
    }

    return [formViewModel, staticSchema];
  }

  private shouldExtractStatic(field: CredentialIssuanceViewModelGroupField, onBehalf: boolean): boolean {
    if (field.display === 'side') return true;
    if (field.display === 'pref_side' && !onBehalf) return true;
    return false;
  }

  private extractStaticData(field: CredentialIssuanceViewModelGroupField, staticSchema: IssuanceStaticViewModel): void {
    const getter = field.staticValueGetter;
    if (typeof getter === 'function') {
      const val = getter();
      if (val && typeof val === 'object') {
        Object.assign(staticSchema, val);
      } else {
        console.warn(`Could not get static value from field ${field.key ?? 'unknown'}`);
      }
    }
  }
}