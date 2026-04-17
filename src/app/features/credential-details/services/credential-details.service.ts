import { computed, inject, Injectable, Injector, Signal, signal, WritableSignal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialStatus, LEARCredential, CredentialProcedureDetails, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { ComponentPortal } from '@angular/cdk/portal';
import { EvaluatedExtendedDetailsField, ViewModelSchema, EvaluatedViewModelSchema, DetailsField, EvaluatedDetailsField, CustomDetailsField, EvaluatedExtendedDetailsGroupField } from 'src/app/core/models/entity/lear-credential-details';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { CredentialActionsService } from './credential-actions.service';
import { DynamicSchemaBuilder } from './dynamic-schema-builder.service';
import { StatusClass } from 'src/app/core/models/entity/lear-credential-management';
import { statusHasSignCredentialButton, statusHasRevokeCredentialButton, statusHasWithdrawCredentialButton } from '../helpers/actions-helpers';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';


@Injectable() //provided in component
export class CredentialDetailsService {
  // CREDENTIAL DATA
  public procedureId$ = signal<string>('');
  public credentialProcedureDetails$ = signal<CredentialProcedureDetails | undefined>(undefined);
  public lifeCycleStatus$ = computed<LifeCycleStatus | undefined>(() => {
    return this.credentialProcedureDetails$()?.lifeCycleStatus;
  });
  public email$ = computed<string | undefined>(() => {
    return this.credentialProcedureDetails$()?.email;
  });
  public credential$ = computed<LEARCredential | undefined>(() => {
    const credentialProcedureData = this.credentialProcedureDetails$();
    return credentialProcedureData?.credential?.vc;
  });
  public credentialValidFrom$ = computed<string>(() => {
    return this.credential$()?.validFrom ?? '';
  });
  public credentialValidUntil$ = computed<string>(() => {
    return this.credential$()?.validUntil ?? '';
  });
  public credentialType$ = computed<string | undefined>(() => {
    return this.credentialProcedureDetails$()?.credential_configuration_id;
  });
  public credentialDisplayName$ = computed<string>(() => {
    const configId = this.credentialType$();
    if (!configId) return '';
    const config = this.metadataService.getConfigurationById(configId);
    const displays = config?.credential_metadata?.display;
    if (displays?.length) {
      const lang = navigator?.language?.split('-')[0] ?? 'en';
      return displays.find(d => d.locale === lang)?.name
        ?? displays.find(d => d.locale === 'en')?.name
        ?? displays[0].name
        ?? configId;
    }
    return configId;
  });
  public lifeCycleStatusClass$: Signal<StatusClass | undefined>;
  public credentialStatus$ = computed<CredentialStatus | undefined>(() => {
    return this.credential$()?.credentialStatus;
  })

  //MODELS
  public sideViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined> = signal(undefined);
  // Currently this contains the Credential Subject data
  public mainViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined> = signal(undefined);
  public showSideTemplateCard$ = computed<boolean>(() =>
    Boolean(this.sideViewModel$()?.length)
  );

  //BUTTONS — hidden when platform read-only view
  private readonly canWrite = inject(AuthService).getUserRole() !== RoleType.SYSADMIN_READONLY;

  public showSignCredentialButton$ = computed<boolean>(() => {
    const status = this.lifeCycleStatus$();
    return this.canWrite && !!status && statusHasSignCredentialButton(status);
  });

  public showRevokeCredentialButton$ = computed<boolean>(() => {
    const status = this.lifeCycleStatus$();
    return this.canWrite && !!status && statusHasRevokeCredentialButton(status);
  });

  public enableRevokeCredentialButton$ = computed<boolean>(() => {
    return !!this.credentialStatus$();
  });

  public showWithdrawCredentialButton$ = computed<boolean>(() => {
    const status = this.lifeCycleStatus$();
    return this.canWrite && !!status && statusHasWithdrawCredentialButton(status);
  });

  public showActionsButtonsContainer$ = computed<boolean>(() => {
    return this.showSignCredentialButton$() || this.showRevokeCredentialButton$() || this.showWithdrawCredentialButton$()
  });

  private readonly actionsService = inject(CredentialActionsService);
  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly metadataService = inject(CredentialIssuerMetadataService);
  private readonly dynamicSchemaBuilder = inject(DynamicSchemaBuilder);
  private readonly dialog = inject(DialogWrapperService);
  private readonly statusService = inject(LifeCycleStatusService);

  public constructor(){
    this.lifeCycleStatusClass$ = computed<StatusClass | undefined>(() => {
      const status = this.lifeCycleStatus$();
      if(!status) return 'status-default';
      return this.statusService.mapStatusToClass(status)
    });
  }

  public setProcedureId(id: string) {
    this.procedureId$.set(id);
  }

  public loadCredentialModels(injector: Injector): void {
    forkJoin([
      this.loadCredentialDetails(),
      this.metadataService.loadMetadata(),
    ]).subscribe(([data]) => {
      this.credentialProcedureDetails$.set(data);
      const vc = this.credential$();
      if(!vc) throw new Error('No credential found.');

      // Dynamic schemas use rawVc (format-aware paths); hardcoded schemas use normalized vc
      const { schema, vcForEvaluation } = this.resolveSchema(data, vc);
      const mappedSchema = this.evaluateSchemaValues(schema, vcForEvaluation);
      this.setViewModels(mappedSchema, injector);
    });
  }

  private resolveSchema(data: CredentialProcedureDetails, vc: LEARCredential): { schema: ViewModelSchema; vcForEvaluation: LEARCredential } {
    const configId = data.credential_configuration_id;
    if (configId) {
      const config = this.metadataService.getConfigurationById(configId);
      if (config?.credential_metadata?.claims?.length) {
        const rawVc = (data.rawVc ?? vc) as LEARCredential;
        return {
          schema: this.dynamicSchemaBuilder.buildSchema(configId, config, rawVc),
          vcForEvaluation: rawVc,
        };
      }
    }

    throw new Error(
      `No schema available for credential "${configId ?? 'unknown'}". ` +
      `Ensure credential_metadata.claims is configured in the issuer.`
    );
  }

  public openSignCredentialDialog(): void {
    const procedureId = this.getProcedureId();
    return this.actionsService.openSignCredentialDialog(procedureId);
  }

  public openWithdrawCredentialDialog(): void {
    if(this.lifeCycleStatus$() !== 'DRAFT'){
      console.error("Only credentials with status DRAFT can be withdrawn.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }

    const procedureId = this.getProcedureId();
    if(!procedureId){
      console.error("Couldn't get procedure id from vc.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }
    return this.actionsService.openWithdrawCredentialDialog(procedureId);
  }

  public openRevokeCredentialDialog(): void{
    if(this.lifeCycleStatus$() !== 'VALID'){
      console.error("Only credentials with status VALID can be revoked.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }
    if(!this.credentialStatus$()){
      console.error("Only credentials with statusCredential field can be revoked.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }

    const issuanceId = this.credentialProcedureDetails$()?.procedure_id;
    if(!issuanceId){
      console.error("Couldn't get issuance id from credential.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }
    return this.actionsService.openRevokeCredentialDialog(issuanceId);
  }

  private getProcedureId(): string{
    return this.procedureId$();
  }

  private loadCredentialDetails(): Observable<CredentialProcedureDetails> {
    return this.credentialProcedureService.fetchCredentialProcedureById(this.procedureId$());
  }

private evaluateSchemaValues(
  schema: ViewModelSchema,
  credential: LEARCredential
): EvaluatedViewModelSchema {
  const evaluateFields = (fields: DetailsField[]): EvaluatedDetailsField[] =>
    fields.map(field => this.evaluateField(field, credential));

  const mainEvaluated = evaluateFields(schema.main);

  const sideEvaluated = evaluateFields(schema.side)
    .filter(field => this.shouldIncludeSideField(field));

  return {
    main: mainEvaluated,
    side: sideEvaluated
  };
}

private evaluateField(
  field: DetailsField,
  credential: LEARCredential
): EvaluatedDetailsField {
  const evaluateCustom = (custom: CustomDetailsField) => ({
    ...custom,
    value: this.safeCompute(custom.value, credential, custom.token.toString())
  });
  

  if (field.type === 'key-value') {
    const keyValueField = field;
    const evaluatedKeyValueField: EvaluatedDetailsField = {
      ...keyValueField,
      value: this.safeCompute(keyValueField.value, credential, keyValueField.key),
      custom: keyValueField.custom ? evaluateCustom(keyValueField.custom) : undefined
    };
    return evaluatedKeyValueField;
  }


  const rawGroup = field.value;
  let children: DetailsField[];
  try {
    children = typeof rawGroup === 'function'
      ? rawGroup(credential)
      : rawGroup;
  } catch (e) {
    console.error(`Error evaluating group "${field.key}":`, e);
    children = [];
  }

  return {
    ...field,
    value: children.map(child => this.evaluateField(child, credential)),
    custom: field.custom ? evaluateCustom(field.custom) : undefined
  };
}

  private safeCompute<T>(
    raw: T | ((c: LEARCredential) => T),
    credential: LEARCredential,
    fieldKey?: string
  ): T | null {
    try {
      const val = typeof raw === 'function'
        ? (raw as (c: LEARCredential) => T)(credential)
        : raw;
      return val || null;
    } catch (e) {
      const keyPart = fieldKey ? ' "' + fieldKey + '"' : '';
      console.error(`Error when mapping${keyPart}:`, e);
      return null;
    }
  }

  private shouldIncludeSideField(field: EvaluatedDetailsField): boolean {
  if (field.key !== 'issuer') {
    return true;
  }

  if (field.type === 'key-value') {
    return field.value !== null;
  }

  const children = Array.isArray(field.value)
    ? field.value
    : [];

  const allChildrenNull = children.every(child => {
    if (child.type === 'key-value') {
      return child.value === null;
    }
    return true;
  });

  return !allChildrenNull;
}

  // add "portal" prop to fields
  private extendFields(fields: EvaluatedDetailsField[], injector: Injector): EvaluatedExtendedDetailsField[] {
      return fields.map((field) => {
        let extended: EvaluatedExtendedDetailsField = { ...field };
  
        if (field.custom) {
          const childInjector = Injector.create({
            parent: injector,
            providers: [
              { provide: field.custom.token, useValue: field.custom.value }
            ]
          });
  
          extended.portal = new ComponentPortal(
            field.custom.component,
            null,
            childInjector
          );
        }
  
        if (field.type === 'group') {
          const groupField = field;
          extended = { ...extended } as EvaluatedExtendedDetailsGroupField;
          extended.value = this.extendFields(groupField.value, injector);
        }
  
        return extended;
      });
    }

  private setViewModels(schema: EvaluatedViewModelSchema, injector: Injector){
    const extendedMainSchema = this.extendFields(schema.main, injector);
    const extendedSideSchema = this.extendFields(schema.side, injector);
    
    this.mainViewModel$.set(extendedMainSchema);
    this.sideViewModel$.set(extendedSideSchema);     
  }

}
