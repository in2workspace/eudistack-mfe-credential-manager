import { computed, inject, Injectable, Injector, Signal, signal, WritableSignal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialStatus, CredentialType, LEARCredential, CredentialProcedureDetails, LifeCycleStatus, CREDENTIAL_TYPES_ARRAY } from 'src/app/core/models/entity/lear-credential';
import { ComponentPortal } from '@angular/cdk/portal';
import { EvaluatedExtendedDetailsField, ViewModelSchema, EvaluatedViewModelSchema, DetailsField, EvaluatedDetailsField, CustomDetailsField, EvaluatedExtendedDetailsGroupField } from 'src/app/core/models/entity/lear-credential-details';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { CredentialActionsService } from './credential-actions.service';
import { DynamicSchemaBuilder } from './dynamic-schema-builder.service';
import { StatusClass } from 'src/app/core/models/entity/lear-credential-management';
import { statusHasSignCredentialButton, credentialTypeHasSignCredentialButton, statusHasRevokeCredentialButton, credentialTypeHasRevokeCredentialButton, statusHasWithdrawCredentialButton, credentialTypeHasWithdrawCredentialButton } from '../helpers/actions-helpers';
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
  public credentialType$ = computed<CredentialType | undefined>(() => {
    const vc = this.credential$();
    return vc ? this.getCredentialType(vc) : undefined;
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

  //BUTTONS
  public showSignCredentialButton$ = computed<boolean>(()=>{
    const type = this.credentialType$();
    const status = this.lifeCycleStatus$();

    return !!(
      status
      && statusHasSignCredentialButton(status)
      && type 
      && credentialTypeHasSignCredentialButton(type)
    );
  });

  public showRevokeCredentialButton$ = computed<boolean>(()=>{
    const type = this.credentialType$();
    const status = this.lifeCycleStatus$();

    return !!(
      status
      && statusHasRevokeCredentialButton(status)
      && type 
      && credentialTypeHasRevokeCredentialButton(type)
    );
  });

  public enableRevokeCredentialButton$ = computed<boolean>(() => {
    return !!this.credentialStatus$();
  });

  public showWithdrawCredentialButton$ = computed<boolean>(() => {
    const type = this.credentialType$();
    const status = this.lifeCycleStatus$();

    return !!(
      status
      && statusHasWithdrawCredentialButton(status)
      && type
      && credentialTypeHasWithdrawCredentialButton(type)
    );
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

    const procedureId = this.credentialProcedureDetails$()?.procedure_id;
    if(!procedureId){
      console.error("Couldn't get procedure id from vc.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }
    const listId = this.getCredentialListId();
    if(!listId){
      console.error("Couldn't get credential list from vc.");
      this.dialog.openErrorInfoDialog(DialogComponent, 'error.unknown_error');
      return;
    }
    return this.actionsService.openRevokeCredentialDialog(procedureId, listId);
  }

  private getProcedureId(): string{
    return this.procedureId$();
  }

  private getCredential(): LEARCredential | undefined{
    return this.credentialProcedureDetails$()?.credential?.vc;
  }

  private getCredentialListId(): string {
    const statusListCredential = this.getCredential()?.credentialStatus?.statusListCredential;

    if (!statusListCredential) {
      console.error('No Status List Credential found in vc: ');
      console.error(this.getCredential());
      return "";
    }

    const parts = statusListCredential.split('/');
    const id = parts.at(-1);

    return id ?? "";
  }


  
  private loadCredentialDetails(): Observable<CredentialProcedureDetails> {
    return this.credentialProcedureService.getCredentialProcedureById(this.procedureId$());
  }

  private getCredentialType(cred: LEARCredential): CredentialType{
    // W3C credentials have type[] array; SD-JWT credentials have vct string
    const vct = (cred as any).vct as string | undefined;
    if(vct && CREDENTIAL_TYPES_ARRAY.includes(vct as CredentialType)){
      return vct as CredentialType;
    }
    const type = cred.type?.find((t): t is CredentialType => CREDENTIAL_TYPES_ARRAY.includes(t as CredentialType));
    if(!type) throw new Error('No credential type found in credential');
    return type;
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
